const express = require('express');
const {
  createVehicleInsurance,
  getVehicleInsurancePolicies,
  getVehicleInsuranceById,
  updateVehicleInsurance,
  deleteVehicleInsurance,
  toggleVehicleInsuranceStatus,
  getVehicleInsuranceStats,
  deleteDocument,
  getCustomersForDropdown,
  getCustomerById
} = require('../controllers/vehicleInsuranceController');
const { authenticate } = require('../middleware/auth');
const { uploadMiddleware, handleUploadError } = require('../middleware/upload');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get customers for dropdown (should be before parameterized routes)
router.get('/customers', getCustomersForDropdown);

// Get customer by ID for edit dialog
router.get('/customer/:customerId', getCustomerById);

// Vehicle Insurance CRUD Operations
router.post(
  '/',
  uploadMiddleware.vehicleInsuranceDocuments, // Use dedicated vehicle insurance upload middleware
  handleUploadError, // Handle upload errors
  createVehicleInsurance
);

router.get('/', getVehicleInsurancePolicies);
router.get('/stats', getVehicleInsuranceStats);
router.get('/:policyId', getVehicleInsuranceById);

router.put(
  '/:policyId',
  uploadMiddleware.vehicleInsuranceDocuments, // Use dedicated vehicle insurance upload middleware
  handleUploadError, // Handle upload errors
  updateVehicleInsurance
);

router.patch('/:policyId/toggle-status', toggleVehicleInsuranceStatus);
router.delete('/:policyId', deleteVehicleInsurance);

// Document management
router.delete('/:policyId/documents/:documentId', deleteDocument);

module.exports = router;
