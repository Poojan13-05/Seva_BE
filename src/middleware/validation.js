// src/middleware/validation.js
const { errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

// Validate admin creation data
const validateAdminCreation = (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    const errors = [];

    // Name validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    } else if (name.trim().length > 50) {
      errors.push('Name cannot exceed 50 characters');
    }

    // Email validation
    if (!email || typeof email !== 'string') {
      errors.push('Email is required');
    } else {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email.trim().toLowerCase())) {
        errors.push('Please enter a valid email address');
      }
    }

    // Password validation
    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    } else if (password.length > 100) {
      errors.push('Password cannot exceed 100 characters');
    }

    // Phone validation (optional)
    if (phone && typeof phone === 'string') {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone.trim())) {
        errors.push('Please enter a valid phone number');
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      logger.warn('Admin creation validation failed:', {
        errors,
        requestData: { name, email, phone },
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return errorResponse(res, 'Validation failed', 400, errors);
    }

    // Sanitize data
    req.body.name = name.trim();
    req.body.email = email.trim().toLowerCase();
    if (phone) {
      req.body.phone = phone.trim();
    }

    next();
  } catch (error) {
    logger.error('Validation middleware error:', error);
    return errorResponse(res, 'Validation error occurred', 500);
  }
};

// Validate bulk operations data
const validateBulkOperation = (req, res, next) => {
  try {
    const { adminIds, action } = req.body;
    const errors = [];

    // Admin IDs validation
    if (!adminIds || !Array.isArray(adminIds)) {
      errors.push('adminIds must be an array');
    } else if (adminIds.length === 0) {
      errors.push('adminIds array cannot be empty');
    } else if (adminIds.length > 100) {
      errors.push('Cannot process more than 100 admins at once');
    } else {
      // Validate each ID format
      const invalidIds = adminIds.filter(id => {
        return !id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id);
      });
      if (invalidIds.length > 0) {
        errors.push('All admin IDs must be valid MongoDB ObjectIds');
      }
    }

    // Action validation
    if (!action || typeof action !== 'string') {
      errors.push('Action is required');
    } else if (!['activate', 'deactivate', 'delete'].includes(action.toLowerCase())) {
      errors.push('Action must be one of: activate, deactivate, delete');
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      logger.warn('Bulk operation validation failed:', {
        errors,
        requestData: { adminIds: adminIds ? adminIds.length : 0, action },
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return errorResponse(res, 'Validation failed', 400, errors);
    }

    // Sanitize data
    req.body.action = action.toLowerCase();
    req.body.adminIds = [...new Set(adminIds)]; // Remove duplicates

    next();
  } catch (error) {
    logger.error('Bulk validation middleware error:', error);
    return errorResponse(res, 'Validation error occurred', 500);
  }
};

// Validate admin update data
const validateAdminUpdate = (req, res, next) => {
  try {
    const { name, email, phone, isActive } = req.body;
    const errors = [];

    // Name validation (if provided)
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        errors.push('Name must be a non-empty string');
      } else if (name.trim().length > 50) {
        errors.push('Name cannot exceed 50 characters');
      }
    }

    // Email validation (if provided)
    if (email !== undefined) {
      if (typeof email !== 'string') {
        errors.push('Email must be a string');
      } else {
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email.trim().toLowerCase())) {
          errors.push('Please enter a valid email address');
        }
      }
    }

    // Phone validation (if provided)
    if (phone !== undefined && phone !== null && phone !== '') {
      if (typeof phone !== 'string') {
        errors.push('Phone must be a string');
      } else {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phone.trim())) {
          errors.push('Please enter a valid phone number');
        }
      }
    }

    // isActive validation (if provided)
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      errors.push('isActive must be a boolean value');
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      logger.warn('Admin update validation failed:', {
        errors,
        requestData: { name: !!name, email: !!email, phone: !!phone, isActive },
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return errorResponse(res, 'Validation failed', 400, errors);
    }

    // Sanitize data
    if (name) req.body.name = name.trim();
    if (email) req.body.email = email.trim().toLowerCase();
    if (phone) req.body.phone = phone.trim();

    next();
  } catch (error) {
    logger.error('Update validation middleware error:', error);
    return errorResponse(res, 'Validation error occurred', 500);
  }
};

// Validate password reset data
const validatePasswordReset = (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const errors = [];

    // Password validation
    if (!newPassword || typeof newPassword !== 'string') {
      errors.push('New password is required');
    } else if (newPassword.length < 6) {
      errors.push('New password must be at least 6 characters long');
    } else if (newPassword.length > 100) {
      errors.push('New password cannot exceed 100 characters');
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      logger.warn('Password reset validation failed:', {
        errors,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return errorResponse(res, 'Validation failed', 400, errors);
    }

    next();
  } catch (error) {
    logger.error('Password reset validation middleware error:', error);
    return errorResponse(res, 'Validation error occurred', 500);
  }
};

module.exports = {
  validateAdminCreation,
  validateBulkOperation,
  validateAdminUpdate,
  validatePasswordReset
};