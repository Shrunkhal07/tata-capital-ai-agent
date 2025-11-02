const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const customerRoutes = require('./routes/customers');
const offerRoutes = require('./routes/offers');
const kycRoutes = require('./routes/kyc');
const creditRoutes = require('./routes/credit');  

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Load data
let customers = require('./data/customers');
let loanOffers = require('./data/loan-offers');
let kycData = require('./data/kyc-data');
let creditReports = require('./data/credit-bureau');

// Routes
app.use('/api/customers', customerRoutes(customers, kycData, creditReports));
app.use('/api/offers', offerRoutes(loanOffers, customers));
app.use('/api/kyc', kycRoutes(kycData, customers));
app.use('/api/credit', creditRoutes(creditReports, customers));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is Running', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tata Capital Mock API Server running on http://localhost:${PORT}`);
  console.log(`📊 Endpoints available:`);
  console.log(`   GET  /api/customers`);
  console.log(`   GET  /api/customers/:phone`);
  console.log(`   GET  /api/offers`);
  console.log(`   POST /api/kyc/verify`);
  console.log(`   GET  /api/credit/:customerId`);
})

module.exports = app;

