// src/routes/customer.js
const express = require('express');
const { 
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  toggleCustomerStatus,
  getCustomerStats,
  exportCustomers,
  deleteDocument
} = require('../controllers/cutomerController');
const { authenticate } = require('../middleware/auth');
const { uploadMiddleware, handleUploadError } = require('../middleware/upload');
const { 
  validateCustomerCreation, 
  validateCustomerUpdate 
} = require('../middleware/customerValidation');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Customer CRUD Operations
router.post(
  '/', 
  uploadMiddleware.customerDocuments, // Handle file uploads
  handleUploadError, // Handle upload errors
  validateCustomerCreation, // Validate customer data
  createCustomer
);

router.get('/', getCustomers);
router.get('/stats', getCustomerStats);
router.get('/export', exportCustomers);
router.get('/:customerId', getCustomerById);

router.put(
  '/:customerId', 
  uploadMiddleware.customerDocuments, // Handle file uploads
  handleUploadError, // Handle upload errors
  validateCustomerUpdate, // Validate update data
  updateCustomer
);

router.patch('/:customerId/toggle-status', toggleCustomerStatus);
router.delete('/:customerId', deleteCustomer);

// Document management
router.delete('/:customerId/documents/:documentId', deleteDocument);

module.exports = router;