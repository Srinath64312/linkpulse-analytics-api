const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { generateShortCode, isValidUrl } = require('../src/utils/codeGenerator');
const app = require('../src/app');
const User = require('../src/models/User');
const Url = require('../src/models/Url');

let server;
let baseUrl;

before(async () => {
  // Connect to local MongoDB test database
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shortly_test_db';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  // Clean test database
  await User.deleteMany({});
  await Url.deleteMany({});

  // Start temporary test server on random port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) server.close();
  await mongoose.connection.close();
});

test('Unit: Code Generator & URL Validator', () => {
  const code1 = generateShortCode(6);
  const code2 = generateShortCode(6);

  assert.equal(code1.length, 6);
  assert.equal(code2.length, 6);
  assert.notEqual(code1, code2);

  assert.equal(isValidUrl('https://github.com/Srinath64312'), true);
  assert.equal(isValidUrl('http://localhost:3000/dashboard'), true);
  assert.equal(isValidUrl('ftp://invalid-url.com'), false);
  assert.equal(isValidUrl('not-a-valid-url'), false);
});

test('API: Health Check GET /health', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.status, 'healthy');
  assert.equal(json.version, '1.0.0');
});

test('API: User Registration POST /api/auth/register', async () => {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Srinath',
      email: 'srinath.test@example.com',
      password: 'StrongPassword123!'
    })
  });

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.token);
  assert.equal(json.data.user.email, 'srinath.test@example.com');
});

test('API: User Login POST /api/auth/login', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'srinath.test@example.com',
      password: 'StrongPassword123!'
    })
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.token);
});

test('API: Shorten URL with Random Code POST /api/urls/shorten', async () => {
  const res = await fetch(`${baseUrl}/api/urls/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://github.com/Srinath64312',
      title: 'Srinath GitHub Profile'
    })
  });

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.shortCode);
  assert.ok(json.data.qrCode);
  assert.equal(json.data.originalUrl, 'https://github.com/Srinath64312');
});

test('API: Shorten URL with Custom Alias & Duplicate Prevention', async () => {
  // First creation with custom alias
  const res1 = await fetch(`${baseUrl}/api/urls/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://github.com/Srinath64312/campus-student-marketplace',
      customAlias: 'campus-market',
      title: 'Campus Student Marketplace'
    })
  });

  assert.equal(res1.status, 201);
  const json1 = await res1.json();
  assert.equal(json1.data.shortCode, 'campus-market');
  assert.equal(json1.data.customAlias, true);

  // Duplicate custom alias must return 400
  const res2 = await fetch(`${baseUrl}/api/urls/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalUrl: 'https://google.com',
      customAlias: 'campus-market'
    })
  });

  assert.equal(res2.status, 400);
  const json2 = await res2.json();
  assert.equal(json2.success, false);
});

test('API: Redirection & Click Event Tracking GET /:code', async () => {
  // Redirect should return HTTP 302 and redirect to target
  const res = await fetch(`${baseUrl}/campus-market`, {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://twitter.com'
    }
  });

  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://github.com/Srinath64312/campus-student-marketplace');

  // Allow short delay for async setImmediate click update to complete in MongoDB
  await new Promise((resolve) => setTimeout(resolve, 250));

  // Check analytics endpoint
  const analyticsRes = await fetch(`${baseUrl}/api/urls/campus-market/analytics`);
  assert.equal(analyticsRes.status, 200);

  const analyticsJson = await analyticsRes.json();
  assert.equal(analyticsJson.success, true);
  assert.equal(analyticsJson.data.totalClicks, 1);
  assert.ok(analyticsJson.data.breakdown.referrers['twitter.com'] >= 1);
});
