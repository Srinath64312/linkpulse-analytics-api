const mongoose = require('mongoose');

const clickAnalyticsSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now
    },
    ip: {
      type: String,
      default: 'Unknown'
    },
    referrer: {
      type: String,
      default: 'Direct'
    },
    browser: {
      type: String,
      default: 'Unknown'
    },
    os: {
      type: String,
      default: 'Unknown'
    },
    device: {
      type: String,
      default: 'Desktop'
    },
    country: {
      type: String,
      default: 'Local/Internal'
    }
  },
  { _id: false }
);

const urlSchema = new mongoose.Schema(
  {
    originalUrl: {
      type: String,
      required: [true, 'Original URL is required'],
      trim: true
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    customAlias: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: 'Untitled Link',
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    clicks: {
      type: Number,
      default: 0
    },
    analytics: [clickAnalyticsSchema],
    expiresAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Helper method to check if URL is expired
urlSchema.methods.isExpired = function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

module.exports = mongoose.model('Url', urlSchema);
