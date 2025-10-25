const express = require('express');

module.exports = (loanOffers, customers) => {
  const router = express.Router();

  // Get all available offers
  router.get('/', (req, res) => {
    res.json({ 
      success: true, 
      data: loanOffers.offers,
      timestamp: new Date().toISOString()
    });
  });

  // Get personalized offers for customer
  router.get('/personalized/:phone', (req, res) => {
    const phone = req.params.phone.replace(/\+91/, '');
    const customer = customers.customers.find(c => 
      c.phone.replace(/\+91/, '') === phone
    );

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        error: 'Customer not found' 
      });
    }

    // Filter offers based on customer profile
    const eligibleOffers = loanOffers.offers.filter(offer => {
      const criteria = offer.eligibility_criteria;
      return (
        customer.credit_score >= criteria.min_credit_score &&
        customer.monthly_income >= criteria.min_monthly_income
      );
    });

    // Calculate personalized rates
    const personalizedOffers = eligibleOffers.map(offer => {
      // Adjust interest rate based on credit score
      let interestRate = (criteria.min_credit_score <= customer.credit_score && 
                         customer.credit_score <= 750) 
        ? offer.interest_rate_range[0] 
        : offer.interest_rate_range[1];
      
      // Credit score bonus
      if (customer.credit_score > 750) {
        interestRate -= 0.5;
      } else if (customer.credit_score < 650) {
        interestRate += 1.0;
      }

      return {
        ...offer,
        personalized_interest_rate: interestRate,
        eligible_amount: Math.min(
          customer.pre_approved_limit, 
          customer.monthly_income * 60 - customer.current_monthly_emi
        ),
        processing_fee: Math.round(
          (offer.personalized_interest_rate * customer.pre_approved_limit) / 100
        )
      };
    });

    res.json({
      success: true,
      customer_id: customer.customer_id,
      eligible_offers: personalizedOffers,
      recommended_offer: personalizedOffers[0] || null
    });
  });

  // Calculate EMI for specific offer
  router.post('/calculate-emi', (req, res) => {
    const { principal, rate, tenure_months } = req.body;
    
    // EMI Formula: P × r × (1+r)^n / ((1+r)^n - 1)
    const monthlyRate = rate / (12 * 100);
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure_months) / 
                (Math.pow(1 + monthlyRate, tenure_months) - 1);

    res.json({
      success: true,
      principal,
      monthly_interest_rate: monthlyRate * 100,
      tenure_months,
      monthly_emi: Math.round(emi),
      total_interest: Math.round((emi * tenure_months) - principal),
      total_payable: Math.round(emi * tenure_months)
    });
  });

  return router;
};
