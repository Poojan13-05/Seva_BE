// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('express-async-errors');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes will be added here
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/users', userRoutes);
// etc...

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Server is healthy', timestamp: new Date() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware will be added here
// app.use(errorHandler);

module.exports = app;