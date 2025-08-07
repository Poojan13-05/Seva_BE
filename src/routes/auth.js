// src/routes/auth.js
const express = require('express');
const { 
  login, 
  refreshToken, 
  getMe, 
  logout
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', authLimiter, login);

router.post('/refresh', refreshToken);

router.get('/me', authenticate, getMe);

router.post('/logout', authenticate, logout);

module.exports = router;