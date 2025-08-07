// src/routes/superAdmin.js
const express = require('express');
const { 
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  toggleAdminStatus,
  resetAdminPassword,
  deleteAdmin
} = require('../controllers/superAdminController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/admins', createAdmin);

router.get('/admins', getAllAdmins);

router.get('/admins/:adminId', getAdminById);

router.put('/admins/:adminId', updateAdmin);

router.patch('/admins/:adminId/toggle-status', toggleAdminStatus);

router.patch('/admins/:adminId/reset-password', resetAdminPassword);

router.delete('/admins/:adminId', deleteAdmin);

module.exports = router;