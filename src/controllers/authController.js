const Admin = require('../models/Admin');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Please provide email and password', 400);
    }

    const admin = await Admin.findByEmailWithPassword(email);
    
    if (!admin) {
      logger.warn('Login attempt with non-existent email:', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return errorResponse(res, 'Invalid credentials', 401);
    }

    if (!admin.isActive) {
      logger.warn('Login attempt with inactive account:', {
        adminId: admin._id,
        email: admin.email,
        ip: req.ip
      });
      return errorResponse(res, 'Account is deactivated. Please contact super admin.', 401);
    }

    const isPasswordCorrect = await admin.comparePassword(password);
    
    if (!isPasswordCorrect) {
      logger.warn('Login attempt with incorrect password:', {
        adminId: admin._id,
        email: admin.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return errorResponse(res, 'Invalid credentials', 401);
    }

    await admin.updateLastLogin();

    const accessToken = generateToken(admin);
    const refreshToken = generateRefreshToken(admin);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    logger.info('Successful login:', {
      adminId: admin._id,
      email: admin.email,
      role: admin.role,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const adminData = {
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      phone: admin.phone,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt
    };

    successResponse(res, {
      admin: adminData,
      accessToken,
      tokenType: 'Bearer'
    }, 'Login successful', 200);

  } catch (error) {
    logger.error('Login error:', error);
    return errorResponse(res, 'Login failed', 500);
  }
};



const refreshToken = async (req, res) => {
  try {
    let refreshToken;

    if (req.cookies && req.cookies.refreshToken) {
      refreshToken = req.cookies.refreshToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      refreshToken = req.headers.authorization.split(' ')[1];
    }

    if (!refreshToken) {
      return errorResponse(res, 'Refresh token not provided', 401);
    }

    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    if (decoded.type !== 'admin-refresh') {
      return errorResponse(res, 'Invalid refresh token type', 401);
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return errorResponse(res, 'Admin not found or inactive', 401);
    }

    const newAccessToken = generateToken(admin);

    logger.info('Token refreshed:', {
      adminId: admin._id,
      email: admin.email,
      ip: req.ip
    });

    successResponse(res, {
      accessToken: newAccessToken,
      tokenType: 'Bearer'
    }, 'Token refreshed successfully', 200);

  } catch (error) {
    logger.warn('Refresh token verification failed:', {
      error: error.message,
      ip: req.ip
    });

    if (error.name === 'TokenExpiredError') {
      res.clearCookie('refreshToken');
      return errorResponse(res, 'Refresh token expired. Please login again.', 401);
    }
    
    return errorResponse(res, 'Invalid refresh token', 401);
  }
};

const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    
    if (!admin) {
      return errorResponse(res, 'Admin not found', 404);
    }

    const adminData = {
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      phone: admin.phone,
      lastLogin: admin.lastLogin,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };

    successResponse(res, { admin: adminData }, 'Admin profile retrieved successfully', 200);
  } catch (error) {
    logger.error('Get profile error:', error);
    return errorResponse(res, 'Failed to get profile', 500);
  }
};


const logout = async (req, res) => {
  try {
    res.clearCookie('refreshToken');

    logger.info('Admin logged out:', {
      adminId: req.admin._id,
      email: req.admin.email,
      ip: req.ip
    });

    successResponse(res, null, 'Logged out successfully', 200);
  } catch (error) {
    logger.error('Logout error:', error);
    return errorResponse(res, 'Logout failed', 500);
  }
};

module.exports = {
  login,
  refreshToken,
  getMe,
  logout
};
