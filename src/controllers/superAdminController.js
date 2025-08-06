const Admin = require('../models/Admin');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

const createAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can create admins', 403);
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return errorResponse(res, 'Admin with this email already exists', 400);
    }

    const newAdmin = await Admin.createAdmin({
      name,
      email,
      password,
      phone
    }, req.admin);

    logger.info('New admin created:', {
      createdBy: req.admin._id,
      newAdminId: newAdmin._id,
      newAdminEmail: newAdmin.email,
      ip: req.ip
    });

    const adminData = {
      id: newAdmin._id,
      email: newAdmin.email,
      name: newAdmin.name,
      role: newAdmin.role,
      phone: newAdmin.phone,
      isActive: newAdmin.isActive,
      createdAt: newAdmin.createdAt
    };

    successResponse(res, { admin: adminData }, 'Admin created successfully', 201);
  } catch (error) {
    logger.error('Create admin error:', error);
    return errorResponse(res, 'Failed to create admin', 500);
  }
};

const getAllAdmins = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can view all admins', 403);
    }

    const admins = await Admin.getAdminsList(req.admin);

    successResponse(res, { admins, count: admins.length }, 'Admins retrieved successfully', 200);
  } catch (error) {
    logger.error('Get admins error:', error);
    return errorResponse(res, 'Failed to retrieve admins', 500);
  }
};

const getAdminById = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can view admin details', 403);
    }

    const { adminId } = req.params;
    
    const admin = await Admin.findById(adminId)
      .select('-password -passwordResetToken -passwordResetExpire')
      .populate('createdBy', 'name email');

    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    if (admin.role === 'super_admin') {
      return errorResponse(res, 'Cannot view super admin details', 403);
    }

    successResponse(res, { admin }, 'Admin details retrieved successfully', 200);
  } catch (error) {
    logger.error('Get admin by ID error:', error);
    return errorResponse(res, 'Failed to retrieve admin details', 500);
  }
};

const updateAdmin = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can update admins', 403);
    }

    const { adminId } = req.params;
    const { name, email, phone, isActive } = req.body;

    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    if (admin.role === 'super_admin') {
      return errorResponse(res, 'Cannot update super admin', 403);
    }

    if (email && email !== admin.email) {
      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) {
        return errorResponse(res, 'Admin with this email already exists', 400);
      }
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { name, email, phone, isActive },
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -passwordResetExpire');

    logger.info('Admin updated:', {
      updatedBy: req.admin._id,
      updatedAdminId: admin._id,
      changes: { name, email, phone, isActive },
      ip: req.ip
    });

    successResponse(res, { admin: updatedAdmin }, 'Admin updated successfully', 200);
  } catch (error) {
    logger.error('Update admin error:', error);
    return errorResponse(res, 'Failed to update admin', 500);
  }
};

const toggleAdminStatus = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can change admin status', 403);
    }

    const { adminId } = req.params;

    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    if (admin.role === 'super_admin') {
      return errorResponse(res, 'Cannot change super admin status', 403);
    }

    await admin.toggleActiveStatus(req.admin);

    logger.info('Admin status changed:', {
      changedBy: req.admin._id,
      targetAdminId: admin._id,
      targetAdminEmail: admin.email,
      newStatus: admin.isActive,
      ip: req.ip
    });

    successResponse(res, { 
      admin: { 
        id: admin._id, 
        email: admin.email, 
        isActive: admin.isActive 
      } 
    }, `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`, 200);
  } catch (error) {
    logger.error('Toggle admin status error:', error);
    return errorResponse(res, 'Failed to change admin status', 500);
  }
};

const resetAdminPassword = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can reset admin passwords', 403);
    }

    const { adminId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return errorResponse(res, 'New password must be at least 6 characters', 400);
    }

    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    if (admin.role === 'super_admin') {
      return errorResponse(res, 'Cannot reset super admin password', 403);
    }

    admin.password = newPassword;
    admin.passwordResetToken = undefined;
    admin.passwordResetExpire = undefined;
    await admin.save();

    logger.info('Admin password reset:', {
      resetBy: req.admin._id,
      targetAdminId: admin._id,
      targetAdminEmail: admin.email,
      ip: req.ip
    });

    successResponse(res, {
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name
      }
    }, 'Admin password reset successfully', 200);
  } catch (error) {
    logger.error('Reset admin password error:', error);
    return errorResponse(res, 'Failed to reset admin password', 500);
  }
};

const deleteAdmin = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can delete admins', 403);
    }

    const { adminId } = req.params;

    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    if (admin.role === 'super_admin') {
      return errorResponse(res, 'Cannot delete super admin', 403);
    }

    await Admin.findByIdAndDelete(adminId);

    logger.info('Admin deleted:', {
      deletedBy: req.admin._id,
      deletedAdminId: admin._id,
      deletedAdminEmail: admin.email,
      ip: req.ip
    });

    successResponse(res, null, 'Admin deleted successfully', 200);
  } catch (error) {
    logger.error('Delete admin error:', error);
    return errorResponse(res, 'Failed to delete admin', 500);
  }
};

module.exports = {
  createAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  toggleAdminStatus,
  resetAdminPassword,
  deleteAdmin
};