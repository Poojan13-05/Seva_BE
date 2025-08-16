// src/app.js - UPDATED VERSION
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('express-async-errors');
require('dotenv').config();

const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const customerRoutes = require('./routes/customer'); // ✅ NEW: Customer routes
const { errorResponse } = require('./utils/responseHandler');
const logger = require('./utils/logger');

// CORS must be BEFORE other middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Body parsing middleware MUST come early
// ✅ UPDATED: Increased limits for file uploads and large customer data
app.use(express.json({ limit: '50mb' })); // Increased from 10mb to 50mb
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increased from 10mb to 50mb
app.use(cookieParser());

// Other middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));
app.use(compression());
app.use(morgan('combined'));

// Add request logging middleware
app.use((req, res, next) => {
  // Log request details but limit body size in logs to prevent spam
  const logBody = req.body && typeof req.body === 'object' 
    ? Object.keys(req.body).length > 0 
      ? '{ data present }' 
      : req.body
    : req.body;

  logger.info('Incoming request:', {
    method: req.method,
    url: req.originalUrl,
    body: logBody,
    headers: {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Bearer ***' : undefined,
      'content-length': req.headers['content-length']
    },
    ip: req.ip
  });
  next();
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/customers', customerRoutes); // ✅ NEW: Customer routes

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'Server is healthy', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    body: req.body ? 'Request body present' : 'No body' // Avoid logging sensitive data
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return errorResponse(res, 'Validation Error', 400, errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return errorResponse(res, `${field} already exists`, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired', 401);
  }

  // File upload errors (Multer)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 'File too large', 413, ['Maximum file size exceeded']);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return errorResponse(res, 'Too many files', 413, ['Maximum file count exceeded']);
  }

  // AWS S3 errors
  if (err.code === 'NoSuchBucket') {
    return errorResponse(res, 'Storage configuration error', 500);
  }

  // Request entity too large
  if (err.type === 'entity.too.large') {
    return errorResponse(res, 'Request too large', 413, ['Request payload exceeds maximum size']);
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  return errorResponse(res, message, statusCode);
});

module.exports = app;