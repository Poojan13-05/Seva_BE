// server.js
const app = require('./src/app');
const connectDB = require('./src/config/database');
const logger = require('./src/utils/logger');
const Admin = require('./src/models/Admin');

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

// Start server with proper initialization
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Ensure super admin exists after DB connection
    await ensureSuperAdmin();
    
    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
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
    process.exit(1);
  }
};

// Start the server
startServer();