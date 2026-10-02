const express = require('express');
const router = express.Router();
const {
  shortenUrl,
  getMyUrls,
  getUrlAnalytics,
  deleteUrl
} = require('../controllers/urlController');
const { protect, optionalAuth } = require('../middlewares/auth');

router.post('/shorten', optionalAuth, shortenUrl);
router.get('/my-urls', protect, getMyUrls);
router.get('/:code/analytics', getUrlAnalytics);
router.delete('/:id', protect, deleteUrl);

module.exports = router;
