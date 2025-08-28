const express = require('express');
const { 
  createLifeInsurance,
  getLifeInsurancePolicies,
  getLifeInsuranceById,
  updateLifeInsurance,
  deleteLifeInsurance,
  toggleLifeInsuranceStatus,
  getLifeInsuranceStats,
  deleteDocument,
  getCustomersForDropdown,
  getCustomerById
} = require('../controllers/lifeInsuranceController');
const { authenticate } = require('../middleware/auth');
const { uploadMiddleware, handleUploadError } = require('../middleware/upload');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get customers for dropdown (should be before parameterized routes)
router.get('/customers', getCustomersForDropdown);

// Get customer by ID for edit dialog
router.get('/customer/:customerId', getCustomerById);

// Life Insurance CRUD Operations
router.post(
  '/', 
  uploadMiddleware.lifeInsuranceDocuments, // Handle file uploads
  handleUploadError, // Handle upload errors
  createLifeInsurance
);

router.get('/', getLifeInsurancePolicies);
router.get('/stats', getLifeInsuranceStats);
router.get('/:policyId', getLifeInsuranceById);

router.put(
  '/:policyId', 
  uploadMiddleware.lifeInsuranceDocuments, // Handle file uploads
  handleUploadError, // Handle upload errors
  updateLifeInsurance
);

router.patch('/:policyId/toggle-status', toggleLifeInsuranceStatus);
router.delete('/:policyId', deleteLifeInsurance);

// Document management
router.delete('/:policyId/documents/:documentId', deleteDocument);

module.exports = router;