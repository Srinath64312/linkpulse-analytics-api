const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const urlRoutes = require('./routes/urlRoutes');
const redirectRoutes = require('./routes/redirectRoutes');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');

const app = express();

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false // Disabled for serving the built-in interactive dashboard UI cleanly
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve public static dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Health Check Endpoint (FDE Concept: Production Observability)
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    database: {
      status: dbStatus,
      name: mongoose.connection.name || 'shortly_db'
    },
    version: '1.0.0'
  });
});

// Apply rate limiter to API routes
app.use('/api/', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);

// Short URL Redirection Route (Handles /:code)
app.use('/', redirectRoutes);

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
