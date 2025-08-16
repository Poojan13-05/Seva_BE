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

// ENHANCED: Get all admins with pagination, search, and filtering
const getAllAdmins = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can view all admins', 403);
    }

    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all', // all, active, inactive
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build search query
    const searchQuery = { role: 'admin' }; // Only get admins, not super_admin

    // Add search functionality
    if (search.trim()) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status !== 'all') {
      searchQuery.isActive = status === 'active';
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit))); // Max 100 per page
    const skip = (pageNumber - 1) * limitNumber;

    // Build sort object
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries
    const [admins, totalCount] = await Promise.all([
      Admin.find(searchQuery)
        .select('-password -passwordResetToken -passwordResetExpire')
        .populate('createdBy', 'name email')
        .sort(sortObject)
        .skip(skip)
        .limit(limitNumber),
      Admin.countDocuments(searchQuery)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    const pagination = {
      currentPage: pageNumber,
      totalPages,
      totalCount,
      limit: limitNumber,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? pageNumber + 1 : null,
      prevPage: hasPrevPage ? pageNumber - 1 : null
    };

    logger.info('Admins retrieved:', {
      requestedBy: req.admin._id,
      totalCount,
      page: pageNumber,
      search: search || 'none',
      status,
      ip: req.ip
    });

    successResponse(res, {
      admins,
      pagination,
      filters: {
        search,
        status,
        sortBy,
        sortOrder
      }
    }, 'Admins retrieved successfully', 200);

  } catch (error) {
    logger.error('Get admins error:', error);
    return errorResponse(res, 'Failed to retrieve admins', 500);
  }
};

// ENHANCED: Get admin statistics for dashboard
const getAdminStats = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can view admin statistics', 403);
    }

    const [
      totalAdmins,
      activeAdmins,
      inactiveAdmins,
      recentAdmins
    ] = await Promise.all([
      Admin.countDocuments({ role: 'admin' }),
      Admin.countDocuments({ role: 'admin', isActive: true }),
      Admin.countDocuments({ role: 'admin', isActive: false }),
      Admin.countDocuments({
        role: 'admin',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      })
    ]);

    const stats = {
      totalAdmins,
      activeAdmins,
      inactiveAdmins,
      recentAdmins,
      activePercentage: totalAdmins > 0 ? Math.round((activeAdmins / totalAdmins) * 100) : 0
    };

    successResponse(res, { stats }, 'Admin statistics retrieved successfully', 200);
  } catch (error) {
    logger.error('Get admin stats error:', error);
    return errorResponse(res, 'Failed to retrieve admin statistics', 500);
  }
};

// ENHANCED: Bulk operations for admins
const bulkUpdateAdmins = async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return errorResponse(res, 'Only super admin can perform bulk operations', 403);
    }

    const { adminIds, action } = req.body;

    if (!adminIds || !Array.isArray(adminIds) || adminIds.length === 0) {
      return errorResponse(res, 'Admin IDs array is required', 400);
    }

    if (!['activate', 'deactivate', 'delete'].includes(action)) {
      return errorResponse(res, 'Invalid action. Use: activate, deactivate, or delete', 400);
    }

    // Prevent operations on super admin
    const adminsToUpdate = await Admin.find({
      _id: { $in: adminIds },
      role: 'admin' // Only allow operations on regular admins
    });

    if (adminsToUpdate.length === 0) {
      return errorResponse(res, 'No valid admins found for the operation', 400);
    }

    let result;
    
    switch (action) {
      case 'activate':
        result = await Admin.updateMany(
          { _id: { $in: adminsToUpdate.map(a => a._id) } },
          { isActive: true }
        );
        break;
        
      case 'deactivate':
        result = await Admin.updateMany(
          { _id: { $in: adminsToUpdate.map(a => a._id) } },
          { isActive: false }
        );
        break;
        
      case 'delete':
        result = await Admin.deleteMany({
          _id: { $in: adminsToUpdate.map(a => a._id) }
        });
        break;
    }

    logger.info('Bulk admin operation performed:', {
      performedBy: req.admin._id,
      action,
      adminIds: adminsToUpdate.map(a => a._id),
      affectedCount: result.modifiedCount || result.deletedCount,
      ip: req.ip
    });

    successResponse(res, {
      action,
      requestedCount: adminIds.length,
      affectedCount: result.modifiedCount || result.deletedCount,
      skippedCount: adminIds.length - adminsToUpdate.length
    }, `Bulk ${action} operation completed successfully`, 200);

  } catch (error) {
    logger.error('Bulk update admins error:', error);
    return errorResponse(res, 'Failed to perform bulk operation', 500);
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
  getAdminStats,        // NEW
  bulkUpdateAdmins,     // NEW
  getAdminById,
  updateAdmin,
  toggleAdminStatus,
  resetAdminPassword,
  deleteAdmin
};