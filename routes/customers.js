const express = require('express');

module.exports = (customers, kycData, creditReports) => {
  const router = express.Router();

  // Get all customers (for testing)
  router.get('/', (req, res) => {
    res.json({ success: true, data: customers.customers });
  });

  // Get customer by phone
  router.get('/:phone', (req, res) => {
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

    // Enhance with KYC and Credit data
    const kycInfo = kycData.kyc_records[customer.customer_id] || {};
    const creditInfo = creditReports.credit_reports[customer.customer_id] || {};

    const enhancedCustomer = {
      ...customer,
      kyc: kycInfo,
      credit: creditInfo
    };

    res.json({ 
      success: true, 
      data: enhancedCustomer 
    });
  });

  // Create new customer inquiry
  router.post('/inquiry', (req, res) => {
    const { phone, name, email, loan_amount, purpose } = req.body;
    
    // Check if customer exists
    const existingCustomer = customers.customers.find(c => 
      c.phone.replace(/\+91/, '') === phone.replace(/\+91/, '')
    );

    if (existingCustomer) {
      return res.json({
        success: true,
        customer_exists: true,
        customer_id: existingCustomer.customer_id,
        pre_approved_limit: existingCustomer.pre_approved_limit,
        credit_score: existingCustomer.credit_score
      });
    }

    // Create new customer record (simplified)
    const newCustomerId = `C${String(customers.customers.length + 1).padStart(3, '0')}`;
    const newCustomer = {
      customer_id: newCustomerId,
      name: name || 'New Customer',
      phone,
      email: email || `${phone}@example.com`,
      loan_amount: loan_amount || 100000,
      purpose: purpose || 'Personal',
      created_at: new Date().toISOString(),
      status: 'NEW_INQUIRY'
    };

    // In production, this would save to database
    customers.customers.push(newCustomer);

    res.json({
      success: true,
      customer_exists: false,
      customer_id: newCustomerId,
      status: 'NEW_CUSTOMER',
      next_step: 'KYC_VERIFICATION'
    });
  });

  return router;
};
