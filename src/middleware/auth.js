const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

const generateToken = (admin) => {
  return jwt.sign(
    { 
      id: admin._id,
      role: admin.role,
      type: 'admin',
      email: admin.email,
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '7d',
      issuer: 'seva-consultancy',
      audience: 'seva-admin'
    }
  );
};


const generateRefreshToken = (admin) => {
  return jwt.sign(
    { 
      id: admin._id,
      role: admin.role,
      type: 'admin-refresh',
      email: admin.email,
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
      issuer: 'seva-consultancy',
      audience: 'seva-admin-refresh'
    }
  );
};


const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret, {
      issuer: 'seva-consultancy',
      audience: ['seva-admin', 'seva-admin-refresh']
    });
  } catch (error) {
    throw error;
  }
};


const authenticate = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    
    if (!token) {
      return errorResponse(res, 'Access denied. No token provided.', 401);
    }

    try {
      
      const decoded = verifyToken(token);

      if (decoded.type !== 'admin') {
        return errorResponse(res, 'Invalid token type.', 401);
      }

      const admin = await Admin.findById(decoded.id);
      if (!admin) {
        return errorResponse(res, 'Admin not found.', 401);
      }

      if (!admin.isActive) {
        return errorResponse(res, 'Admin account is deactivated.', 401);
      }

      req.admin = admin;
      req.adminId = admin._id;
      req.adminRole = admin.role;

      next();
    } catch (jwtError) {
      logger.warn('JWT verification failed:', {
        error: jwtError.message,
        token: token.substring(0, 20) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      if (jwtError.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token has expired. Please login again.', 401);
      } else if (jwtError.name === 'JsonWebTokenError') {
        return errorResponse(res, 'Invalid token format.', 401);
      } else if (jwtError.name === 'NotBeforeError') {
        return errorResponse(res, 'Token not yet valid.', 401);
      } else {
        return errorResponse(res, 'Token verification failed.', 401);
      }
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return errorResponse(res, 'Authentication failed.', 500);
  }
};



module.exports = {
  authenticate,
  generateToken,
  generateRefreshToken,
  verifyToken
};