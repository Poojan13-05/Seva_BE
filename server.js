// server.js - UPDATED WITH S3 VALIDATION
const app = require('./src/app');
const connectDB = require('./src/config/database');
const logger = require('./src/utils/logger');
const Admin = require('./src/models/Admin');
const { validateS3Config } = require('./src/middleware/upload'); // ✅ NEW: S3 validation

const PORT = process.env.PORT || 5000;

// Function to ensure super admin exists
const ensureSuperAdmin = async () => {
  try {
    logger.info('Checking for super admin...');
    await Admin.ensureSuperAdmin();
    logger.info('Super admin check completed');
  } catch (error) {
    logger.error('Error ensuring super admin:', error);
  }
};

// ✅ NEW: Function to validate S3 configuration
const validateAWSConfig = async () => {
  try {
    logger.info('Validating AWS S3 configuration...');
    
    // Check if required environment variables are set
    const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.warn('Missing AWS environment variables:', missingVars);
      logger.warn('File upload functionality will not work properly');
      return false;
    }
    
    // Validate S3 access
    await validateS3Config();
    logger.info('AWS S3 configuration validated successfully');
    return true;
  } catch (error) {
    logger.error('AWS S3 validation failed:', error.message);
    logger.warn('File upload functionality may not work properly');
    
    // In development, we might want to continue without S3
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Continuing in development mode without S3...');
      return false;
    }
    
    // In production, this might be critical
    throw error;
  }
};

// Start server with proper initialization
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Ensure super admin exists after DB connection
    await ensureSuperAdmin();
    
    // ✅ NEW: Validate AWS S3 configuration
    await validateAWSConfig();
    
    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Log configuration status
      logger.info('Configuration Status:', {
        database: '✅ Connected',
        superAdmin: '✅ Verified',
        awsS3: process.env.AWS_S3_BUCKET ? '✅ Configured' : '⚠️ Not configured',
        fileUploads: process.env.AWS_S3_BUCKET ? '✅ Enabled' : '⚠️ Disabled'
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Promise Rejection:', err);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT. Shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM. Shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    
    // Provide helpful error messages
    if (error.message.includes('S3')) {
      logger.error('💡 S3 Setup Help:');
      logger.error('1. Create an AWS account and S3 bucket');
      logger.error('2. Set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET');
      logger.error('3. Ensure your AWS user has S3 permissions');
      logger.error('4. Check the AWS setup guide in your documentation');
    }
    
    process.exit(1);
  }
};

// Start the server
startServer();