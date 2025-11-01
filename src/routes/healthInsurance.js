const express = require('express');
const {
  createHealthInsurance,
  getHealthInsurancePolicies,
  getHealthInsuranceById,
  updateHealthInsurance,
  deleteHealthInsurance,
  hardDeleteHealthInsurance,
  toggleHealthInsuranceStatus,
  getHealthInsuranceStats,
  deleteDocument,
  getCustomersForDropdown,
  getCustomerById
} = require('../controllers/healthInsuranceController');
const { authenticate, checkSuperAdmin } = require('../middleware/auth');
const { uploadMiddleware, handleUploadError } = require('../middleware/upload');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get customers for dropdown (should be before parameterized routes)
router.get('/customers', getCustomersForDropdown);

// Get customer by ID for edit dialog
router.get('/customer/:customerId', getCustomerById);

// Health Insurance CRUD Operations
router.post(
  '/',
  uploadMiddleware.healthInsuranceDocuments,
  handleUploadError,
  createHealthInsurance
);

router.get('/', getHealthInsurancePolicies);
router.get('/stats', getHealthInsuranceStats);
router.get('/:policyId', getHealthInsuranceById);

router.put(
  '/:policyId',
  uploadMiddleware.healthInsuranceDocuments,
  handleUploadError,
  updateHealthInsurance
);

router.patch('/:policyId/toggle-status', toggleHealthInsuranceStatus);
router.delete('/:policyId', deleteHealthInsurance);

// Hard delete (super admin only)
router.delete('/:policyId/hard', checkSuperAdmin, hardDeleteHealthInsurance);

// Document management
router.delete('/:policyId/documents/:documentId', deleteDocument);

module.exports = router;
