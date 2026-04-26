import app from './app';
import { connectDB } from './config/database';
import { nibssService } from './services/nibss.service';
import logger from './utils/logger';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('✅ MongoDB connected successfully');

    // Initialize NIBSS token
    await nibssService.initializeToken();
    logger.info('✅ NIBSS authentication token initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 GOBank Server running on port ${PORT}`);
      logger.info(`📖 API Docs: http://localhost:${PORT}/api/docs`);
      logger.info(`🏦 Bank: ${process.env.BANK_NAME} | Bank Code: ${process.env.BANK_CODE}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', err);
  process.exit(1);
});

startServer();
