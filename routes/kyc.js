const express = require('express');

module.exports = (kycData, customers) => {
  const router = express.Router();

  // Get KYC status for customer
  router.get('/:customerId', (req, res) => {
    const { customerId } = req.params;
    const kycRecord = kycData.kyc_records[customerId];

    if (!kycRecord) {
      return res.status(404).json({
        success: false,
        error: 'KYC record not found'
      });
    }

    // Calculate KYC completion score (0-100)
    let kycScore = 0;
    if (kycRecord.aadhaar_number) kycScore += 25;
    if (kycRecord.pan_number) kycScore += 25;
    if (kycRecord.address_proof) kycScore += 20;
    if (kycRecord.income_proof && kycRecord.income_proof !== 'Pending') kycScore += 20;
    if (kycRecord.bank_statement && kycRecord.bank_statement !== 'Not uploaded') kycScore += 10;

    const enhancedRecord = {
      ...kycRecord,
      completion_score: kycScore,
      documents_required: kycScore < 80 ? 
        getMissingDocuments(kycRecord) : [],
      status: kycScore >= 80 ? 'APPROVED' : 
              kycScore >= 50 ? 'PENDING' : 'NOT_STARTED'
    };

    res.json({
      success: true,
      data: enhancedRecord
    });
  });

  // Submit KYC documents
  router.post('/submit/:customerId', (req, res) => {
    const { customerId } = req.params;
    const { document_type, file_name, status } = req.body;

    if (!kycData.kyc_records[customerId]) {
      kycData.kyc_records[customerId] = {
        customer_id: customerId,
        aadhaar_number: null,
        pan_number: null,
        address_proof: null,
        income_proof: null,
        bank_statement: null,
        kyc_score: 0,
        verification_status: 'NOT_STARTED',
        last_verified: null,
        documents: []
      };
    }

    // Simulate document upload
    const documentRecord = {
      type: document_type,
      file_name,
      uploaded_at: new Date().toISOString(),
      status: status || 'PENDING_VERIFICATION',
      size: Math.floor(Math.random() * 5000) + 100, // KB
      verified: Math.random() > 0.3 // 70% success rate
    };

    kycData.kyc_records[customerId].documents = 
      kycData.kyc_records[customerId].documents || [];
    kycData.kyc_records[customerId].documents.push(documentRecord);

    // Update specific fields based on document type
    switch (document_type.toLowerCase()) {
      case 'aadhaar':
        kycData.kyc_records[customerId].aadhaar_number = 
          documentRecord.verified ? 'VERIFIED_AADHAAR' : null;
        break;
      case 'pan':
        kycData.kyc_records[customerId].pan_number = 
          documentRecord.verified ? 'VERIFIED_PAN' : null;
        break;
      case 'salary slip':
      case 'income proof':
        kycData.kyc_records[customerId].income_proof = 
          documentRecord.verified ? `Verified: ${file_name}` : 'Upload Failed';
        break;
      case 'bank statement':
        kycData.kyc_records[customerId].bank_statement = 
          documentRecord.verified ? `Verified: ${file_name}` : 'Upload Failed';
        break;
    }

    // Recalculate KYC score
    const updatedKyc = getKYCStatus(kycData.kyc_records[customerId]);
    kycData.kyc_records[customerId].kyc_score = updatedKyc.completion_score;
    kycData.kyc_records[customerId].verification_status = updatedKyc.status;

    res.json({
      success: true,
      customer_id: customerId,
      document_uploaded: documentRecord,
      updated_kyc_score: updatedKyc.completion_score,
      next_steps: updatedKyc.completion_score >= 80 ? 
        ['CREDIT_EVALUATION'] : getMissingDocuments(updatedKyc)
    });
  });

  // KYC verification endpoint
  router.post('/verify/:customerId', (req, res) => {
    const { customerId } = req.params;
    const kycRecord = kycData.kyc_records[customerId];

    if (!kycRecord) {
      return res.status(404).json({
        success: false,
        error: 'Customer KYC record not found'
      });
    }

    // Simulate verification process (5-10 second delay)
    setTimeout(() => {
      const verificationResult = {
        customer_id: customerId,
        verification_timestamp: new Date().toISOString(),
        aadhaar_verified: Math.random() > 0.1, // 90% success
        pan_verified: Math.random() > 0.05,    // 95% success
        address_verified: Math.random() > 0.15, // 85% success
        income_verified: kycRecord.income_proof && Math.random() > 0.2,
        overall_status: 'APPROVED',
        confidence_score: Math.floor(Math.random() * 20) + 80,
        issues: []
      };

      // Update KYC record
      kycData.kyc_records[customerId].verification_status = verificationResult.overall_status;
      kycData.kyc_records[customerId].last_verified = verificationResult.verification_timestamp;
      kycData.kyc_records[customerId].kyc_score = verificationResult.confidence_score;

      res.json({
        success: true,
        data: verificationResult
      });
    }, Math.random() * 5000 + 5000); // 5-10 seconds
  });

  function getMissingDocuments(kycRecord) {
    const missing = [];
    if (!kycRecord.aadhaar_number) missing.push('Aadhaar Card');
    if (!kycRecord.pan_number) missing.push('PAN Card');
    if (!kycRecord.address_proof) missing.push('Address Proof');
    if (!kycRecord.income_proof || kycRecord.income_proof === 'Pending') 
      missing.push('Income Proof (Salary Slip/ITR)');
    if (!kycRecord.bank_statement || kycRecord.bank_statement === 'Not uploaded') 
      missing.push('Bank Statement (3 months)');
    
    return missing;
  }

  function getKYCStatus(kycRecord) {
    let score = 0;
    if (kycRecord.aadhaar_number) score += 25;
    if (kycRecord.pan_number) score += 25;
    if (kycRecord.address_proof) score += 20;
    if (kycRecord.income_proof && kycRecord.income_proof !== 'Pending') score += 20;
    if (kycRecord.bank_statement && kycRecord.bank_statement !== 'Not uploaded') score += 10;

    return {
      completion_score: score,
      status: score >= 80 ? 'APPROVED' : score >= 50 ? 'PENDING' : 'NOT_STARTED',
      documents_required: getMissingDocuments(kycRecord)
    };
  }

  return router;
};
