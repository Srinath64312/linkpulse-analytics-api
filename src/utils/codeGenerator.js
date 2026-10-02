const crypto = require('crypto');

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate a URL-friendly random unique string
 * @param {number} length 
 * @returns {string}
 */
const generateShortCode = (length = 7) => {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
};

/**
 * Validate URL string format
 * @param {string} urlString 
 * @returns {boolean}
 */
const isValidUrl = (urlString) => {
  try {
    const parsed = new URL(urlString);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (err) {
    return false;
  }
};

module.exports = {
  generateShortCode,
  isValidUrl
};
