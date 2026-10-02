require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start HTTP server
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Shortly URL Shortener & Analytics API is running!`);
      console.log(`📡 Server Address: http://localhost:${PORT}`);
      console.log(`🩺 Health Check:   http://localhost:${PORT}/health`);
      console.log(`💻 Interactive UI: http://localhost:${PORT}`);
      console.log(`====================================================`);
    });

    // Graceful shutdown handling
    const shutdown = () => {
      console.log('\n[Server] Gracefully shutting down...');
      server.close(() => {
        console.log('[Server] HTTP connections closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error(`[Fatal] Failed to launch server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
