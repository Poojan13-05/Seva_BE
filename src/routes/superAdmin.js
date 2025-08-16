// src/routes/superAdmin.js
const express = require('express');
const { 
  createAdmin,
  getAllAdmins,
  getAdminStats,        // NEW
  bulkUpdateAdmins,     // NEW
  getAdminById,
  updateAdmin,
  toggleAdminStatus,
  resetAdminPassword,
  deleteAdmin
} = require('../controllers/superAdminController');
const { authenticate } = require('../middleware/auth');
const { 
  validateAdminCreation, 
  validateBulkOperation, 
  validateAdminUpdate, 
  validatePasswordReset 
} = require('../middleware/validation');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Admin CRUD Operations
router.post('/admins', validateAdminCreation, createAdmin);
router.get('/admins', getAllAdmins);                    // ENHANCED: Now supports pagination, search, filtering
router.get('/admins/stats', getAdminStats);             // NEW: Get admin statistics
router.post('/admins/bulk', validateBulkOperation, bulkUpdateAdmins); // NEW: Bulk operations

router.get('/admins/:adminId', getAdminById);
router.put('/admins/:adminId', validateAdminUpdate, updateAdmin);
router.patch('/admins/:adminId/toggle-status', toggleAdminStatus);
router.patch('/admins/:adminId/reset-password', validatePasswordReset, resetAdminPassword);
router.delete('/admins/:adminId', deleteAdmin);

module.exports = router;