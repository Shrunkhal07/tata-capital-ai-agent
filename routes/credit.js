const express = require('express');

module.exports = (creditReports, customers) => {
  const router = express.Router();

  // Get credit report for customer
  router.get('/:customerId', (req, res) => {
    const { customerId } = req.params;
    const creditReport = creditReports.credit_reports[customerId];

    if (!creditReport) {
      return res.status(404).json({
        success: false,
        error: 'Credit report not found'
      });
    }

    // Fetch customer details for context
    const customer = customers.customers.find(c => c.customer_id === customerId);

    // Calculate credit decision
    const creditDecision = calculateCreditDecision(creditReport, customer);

    const enhancedReport = {
      ...creditReport,
      customer_details: {
        name: customer?.name,
        monthly_income: customer?.monthly_income,
        current_emi: customer?.current_monthly_emi
      },
      decision: creditDecision,
      report_generated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: enhancedReport
    });
  });

  // Credit evaluation for loan application
  router.post('/evaluate/:customerId', (req, res) => {
    const { customerId } = req.params;
    const { requested_amount, tenure_months, purpose } = req.body;

    const creditReport = creditReports.credit_reports[customerId];
    const customer = customers.customers.find(c => c.customer_id === customerId);

    if (!creditReport || !customer) {
      return res.status(400).json({
        success: false,
        error: 'Customer data not found'
      });
    }

    // Calculate Debt-to-Income (DTI) ratio
    const currentDTI = (customer.current_monthly_emi / customer.monthly_income) * 100;
    const projectedEMI = calculateEMI(requested_amount, 10.5, tenure_months); // 10.5% average rate
    const projectedDTI = ((customer.current_monthly_emi + projectedEMI) / customer.monthly_income) * 100;

    // Credit evaluation logic
    const evaluation = {
      customer_id: customerId,
      requested_amount,
      tenure_months,
      purpose,
      credit_score: creditReport.cibil_score,
      current_dti: Math.round(currentDTI * 10) / 10,
      projected_dti: Math.round(projectedDTI * 10) / 10,
      max_approved_amount: Math.min(
        customer.pre_approved_limit,
        (customer.monthly_income * 0.5 - customer.current_monthly_emi) * tenure_months / 
        calculateEMI(1, 10.5, tenure_months) // EMI per unit amount
      ),
      decision: 'PENDING',
      reasons: [],
      conditions: [],
      timestamp: new Date().toISOString()
    };

    // Decision logic
    if (creditReport.cibil_score >= 750 && projectedDTI <= 40) {
      evaluation.decision = 'APPROVED';
      evaluation.approved_amount = requested_amount;
      evaluation.reasons = ['Excellent credit score', 'Low DTI ratio'];
    } 
    else if (creditReport.cibil_score >= 700 && projectedDTI <= 50) {
      evaluation.decision = 'APPROVED_CONDITIONAL';
      evaluation.approved_amount = Math.min(requested_amount * 0.8, evaluation.max_approved_amount);
      evaluation.reasons = ['Good credit profile', 'Acceptable DTI'];
      evaluation.conditions = ['Additional income verification may be required'];
    }
    else if (creditReport.cibil_score >= 650 && projectedDTI <= 60) {
      evaluation.decision = 'MANUAL_REVIEW';
      evaluation.approved_amount = Math.min(requested_amount * 0.6, evaluation.max_approved_amount);
      evaluation.reasons = ['Moderate credit profile', 'Borderline DTI'];
      evaluation.conditions = [
        'Manager approval required',
        'Additional collateral may be needed',
        'Higher interest rate applicable'
      ];
    }
    else {
      evaluation.decision = 'DECLINED';
      evaluation.reasons = ['Insufficient credit score', 'High DTI ratio', 'Payment history concerns'];
      evaluation.alternatives = [
        'Consider smaller loan amount',
        'Improve credit score before reapplying',
        'Explore secured loan options'
      ];
    }

    // Adjust based on payment history and inquiries
    if (creditReport.payment_history.includes('delay') || creditReport.inquiries_last_6m > 4) {
      if (evaluation.decision === 'APPROVED') {
        evaluation.decision = 'APPROVED_CONDITIONAL';
        evaluation.conditions.push('Monitor payment behavior closely');
      }
    }

    res.json({
      success: true,
      evaluation: evaluation
    });
  });

  function calculateCreditDecision(creditReport, customer) {
    const score = creditReport.cibil_score;
    const dti = (customer?.current_monthly_emi || 0) / (customer?.monthly_income || 1) * 100;
    const utilization = creditReport.utilization_ratio;
    const inquiries = creditReport.inquiries_last_6m;
    const defaults = customers?.defaults_count || 0;

    const factors = {
      score_weight: Math.min(score / 1000, 0.4), // Max 40%
      dti_weight: Math.max(0, (60 - dti) / 60 * 0.2), // Max 20%
      utilization_weight: Math.max(0, (1 - utilization / 100) * 0.15), // Max 15%
      inquiry_weight: Math.max(0, (1 - inquiries / 6) * 0.1), // Max 10%
      history_weight: defaults === 0 ? 0.15 : 0 // Max 15%
    };

    const totalScore = Object.values(factors).reduce((sum, weight) => sum + weight, 0);
    const category = totalScore >= 0.75 ? 'EXCELLENT' : 
                    totalScore >= 0.6 ? 'GOOD' : 
                    totalScore >= 0.45 ? 'FAIR' : 'POOR';

    return {
      category,
      total_score: Math.round(totalScore * 100),
      factors,
      recommendation: getRecommendation(totalScore, score, dti)
    };
  }

  function calculateEMI(principal, annualRate, tenureMonths) {
    const monthlyRate = annualRate / (12 * 100);
    return principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / 
           (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  }

  function getRecommendation(totalScore, score, dti) {
    if (totalScore >= 0.75) {
      return {
        status: 'FULL_APPROVAL',
        limit: 'Up to 100% of pre-approved limit',
        rate: 'Best available rates (8.5-10%)',
        processing_time: 'Instant approval'
      };
    } else if (totalScore >= 0.6) {
      return {
        status: 'CONDITIONAL_APPROVAL',
        limit: 'Up to 80% of pre-approved limit',
        rate: 'Standard rates (10-12%)',
        processing_time: '2-4 hours'
      };
    } else if (totalScore >= 0.45) {
      return {
        status: 'MANUAL_REVIEW',
        limit: 'Up to 50% of pre-approved limit',
        rate: 'Higher rates (12-14%)',
        processing_time: '24-48 hours',
        additional_docs: ['Bank statements', 'Income proof', 'Collateral details']
      };
    } else {
      return {
        status: 'DECLINED',
        reasons: ['Low credit score', 'High DTI', 'Poor payment history'],
        suggestions: [
          'Improve credit score (pay bills on time)',
          'Reduce existing debt',
          'Consider smaller loan amount',
          'Reapply after 6 months'
        ]
      };
    }
  }

  return router;
};
