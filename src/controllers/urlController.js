const Url = require('../models/Url');
const { generateShortCode, isValidUrl } = require('../utils/codeGenerator');
const QRCode = require('qrcode');
const { UAParser } = require('ua-parser-js');

/**
 * @desc    Shorten a new URL
 * @route   POST /api/urls/shorten
 * @access  Public / Optional Auth
 */
const shortenUrl = async (req, res, next) => {
  try {
    const { originalUrl, customAlias, title, expiresInDays } = req.body;

    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid original URL.'
      });
    }

    if (!isValidUrl(originalUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format. URL must start with http:// or https://'
      });
    }

    let shortCode;
    let isCustom = false;

    if (customAlias && customAlias.trim().length > 0) {
      const sanitizedAlias = customAlias.trim();
      // Only alphanumeric and dashes/underscores
      if (!/^[a-zA-Z0-9-_]+$/.test(sanitizedAlias)) {
        return res.status(400).json({
          success: false,
          message: 'Custom alias may only contain alphanumeric characters, underscores, and hyphens.'
        });
      }

      const existingAlias = await Url.findOne({ shortCode: sanitizedAlias });
      if (existingAlias) {
        return res.status(400).json({
          success: false,
          message: 'This custom alias is already in use. Please select a different one.'
        });
      }

      shortCode = sanitizedAlias;
      isCustom = true;
    } else {
      // Generate a collision-free short code
      let collision = true;
      while (collision) {
        shortCode = generateShortCode(6);
        const existing = await Url.findOne({ shortCode });
        if (!existing) {
          collision = false;
        }
      }
    }

    let expiresAt = null;
    if (expiresInDays && Number(expiresInDays) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000);
    }

    const newUrl = await Url.create({
      originalUrl,
      shortCode,
      customAlias: isCustom,
      title: title || originalUrl,
      user: req.user ? req.user.id : null,
      expiresAt
    });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const fullShortUrl = `${baseUrl}/${shortCode}`;

    // Generate QR code data URL
    const qrCode = await QRCode.toDataURL(fullShortUrl);

    res.status(201).json({
      success: true,
      message: 'Short URL created successfully.',
      data: {
        id: newUrl._id,
        originalUrl: newUrl.originalUrl,
        shortCode: newUrl.shortCode,
        shortUrl: fullShortUrl,
        customAlias: newUrl.customAlias,
        title: newUrl.title,
        clicks: newUrl.clicks,
        expiresAt: newUrl.expiresAt,
        createdAt: newUrl.createdAt,
        qrCode
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all URLs created by logged in user
 * @route   GET /api/urls/my-urls
 * @access  Private
 */
const getMyUrls = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const total = await Url.countDocuments({ user: req.user.id, isActive: true });
    const urls = await Url.find({ user: req.user.id, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-analytics');

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    const formattedUrls = urls.map((u) => ({
      id: u._id,
      originalUrl: u.originalUrl,
      shortCode: u.shortCode,
      shortUrl: `${baseUrl}/${u.shortCode}`,
      title: u.title,
      clicks: u.clicks,
      customAlias: u.customAlias,
      isExpired: u.isExpired(),
      expiresAt: u.expiresAt,
      createdAt: u.createdAt
    }));

    res.status(200).json({
      success: true,
      data: formattedUrls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed analytics for a short URL
 * @route   GET /api/urls/:code/analytics
 * @access  Public / Owner
 */
const getUrlAnalytics = async (req, res, next) => {
  try {
    const { code } = req.params;
    const url = await Url.findOne({ shortCode: code, isActive: true });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found.'
      });
    }

    // Aggregate analytics breakdown
    const referrers = {};
    const browsers = {};
    const os = {};
    const devices = {};
    const clicksByDate = {};

    url.analytics.forEach((item) => {
      // Referrer breakdown
      referrers[item.referrer] = (referrers[item.referrer] || 0) + 1;
      // Browser breakdown
      browsers[item.browser] = (browsers[item.browser] || 0) + 1;
      // OS breakdown
      os[item.os] = (os[item.os] || 0) + 1;
      // Device breakdown
      devices[item.device] = (devices[item.device] || 0) + 1;

      // Group clicks by YYYY-MM-DD
      const dateKey = new Date(item.timestamp).toISOString().split('T')[0];
      clicksByDate[dateKey] = (clicksByDate[dateKey] || 0) + 1;
    });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    res.status(200).json({
      success: true,
      data: {
        shortCode: url.shortCode,
        shortUrl: `${baseUrl}/${url.shortCode}`,
        originalUrl: url.originalUrl,
        title: url.title,
        totalClicks: url.clicks,
        isExpired: url.isExpired(),
        expiresAt: url.expiresAt,
        createdAt: url.createdAt,
        breakdown: {
          referrers,
          browsers,
          os,
          devices,
          clicksByDate
        },
        recentClicks: url.analytics.slice(-25).reverse()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a URL
 * @route   DELETE /api/urls/:id
 * @access  Private
 */
const deleteUrl = async (req, res, next) => {
  try {
    const url = await Url.findById(req.params.id);

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL not found.'
      });
    }

    // Check ownership or admin
    if (url.user && url.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this URL.'
      });
    }

    url.isActive = false;
    await url.save();

    res.status(200).json({
      success: true,
      message: 'Short URL deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Redirect to original URL and asynchronously record click
 * @route   GET /:code
 * @access  Public
 */
const redirectToOriginal = async (req, res, next) => {
  try {
    const { code } = req.params;

    // Ignore requests for static favicon or common files
    if (['favicon.ico', 'robots.txt'].includes(code)) {
      return res.status(404).end();
    }

    const url = await Url.findOne({ shortCode: code, isActive: true });

    if (!url) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Not Found</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px; background: #0f172a; color: #f8fafc; }
            h1 { font-size: 2.5rem; color: #ef4444; }
            p { font-size: 1.2rem; color: #94a3b8; }
            a { color: #38bdf8; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>404 - Link Not Found</h1>
          <p>The short link <strong>/${code}</strong> does not exist or has been removed.</p>
          <p><a href="/">Return to Shortly Home</a></p>
        </body>
        </html>
      `);
    }

    if (url.isExpired()) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Expired</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px; background: #0f172a; color: #f8fafc; }
            h1 { font-size: 2.5rem; color: #f59e0b; }
            p { font-size: 1.2rem; color: #94a3b8; }
            a { color: #38bdf8; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>410 - Link Expired</h1>
          <p>This shortened link expired on ${new Date(url.expiresAt).toLocaleDateString()}.</p>
          <p><a href="/">Create a new short link</a></p>
        </body>
        </html>
      `);
    }

    // Parse user agent
    const userAgentHeader = req.headers['user-agent'] || '';
    const parser = new UAParser(userAgentHeader);
    const uaResult = parser.getResult();

    const browser = uaResult.browser.name || 'Other';
    const os = uaResult.os.name || 'Other';
    const deviceType = uaResult.device.type ? uaResult.device.type.charAt(0).toUpperCase() + uaResult.device.type.slice(1) : 'Desktop';

    // Parse referrer
    let referrer = 'Direct';
    if (req.headers.referer) {
      try {
        const refUrl = new URL(req.headers.referer);
        referrer = refUrl.hostname;
      } catch (e) {
        referrer = req.headers.referer;
      }
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // Perform redirect immediately for lightning-fast user experience
    res.redirect(302, url.originalUrl);

    // Asynchronously update analytics and counter (FDE pattern: do not block client redirect)
    setImmediate(async () => {
      try {
        await Url.updateOne(
          { _id: url._id },
          {
            $inc: { clicks: 1 },
            $push: {
              analytics: {
                $each: [
                  {
                    timestamp: new Date(),
                    ip: String(ip),
                    referrer,
                    browser,
                    os,
                    device: deviceType
                  }
                ],
                $slice: -500 // Retain last 500 click logs for fast reads
              }
            }
          }
        );
      } catch (err) {
        console.error('[Analytics Update Error]:', err.message);
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  shortenUrl,
  getMyUrls,
  getUrlAnalytics,
  deleteUrl,
  redirectToOriginal
};
