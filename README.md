# Shortly • Production URL Shortener & Real-Time Analytics API

A high-performance, production-ready URL Shortener and Click Analytics platform built with **Node.js, Express, MongoDB (Mongoose), JWT Authentication, and NanoID**.

This project implements **Project #2 (URL Shortener API)** and **Project #1 (Authentication API)** from the **"10 Backend Projects Every Student Should Build"** curriculum, architected using the **Forward Deployed Engineer (FDE)** production patterns.

---

## 🌟 Key Features

### 1. Authentication & Security (Infographic 5: Project #1)
- **User Registration & Login**: Bcrypt password hashing (10 salt rounds) and JWT token generation.
- **Role-Based Access Control (RBAC)**: Support for standard `user` and `admin` scopes.
- **Protection Middlewares**: Secure bearer token verification and optional guest mode.
- **Defense in Depth**: Helmet HTTP headers, CORS policies, and Express Rate Limiting (DoS prevention).

### 2. URL Shortening Engine (Infographic 5: Project #2)
- **Collision-Resistant Short Codes**: Crypto-random URL-safe alphanumeric code generation.
- **Custom Vanity Aliases**: Custom vanity slugs (e.g., `shortly/campus-market`) with duplicate detection.
- **Link Expiration Engine**: Automatic expiration handling (1, 7, 30, 90 days or permanent).
- **Embedded QR Code Generator**: Generates instant SVG/PNG QR code data URIs for mobile sharing.

### 3. Asynchronous Analytics Pipeline (Infographics 2 & 3)
- **High-Throughput 302 Redirection**: Redirects clients immediately without blocking on disk writes.
- **Non-blocking Event Capture**: Captures click telemetry (`IP`, `Referrer`, `Browser`, `OS`, `Device type`) using `setImmediate` event dispatching.
- **MongoDB Aggregation & Capping**: Embedded subdocuments capped with `$slice` for constant-time analytics queries.

### 4. Developer Observability & Telemetry (Infographics 2 & 4)
- **Health Check Endpoint**: `GET /health` with live database status and system uptime.
- **Structured Request Logging**: Morgan HTTP logger.
- **Native Test Suite**: Automated integration tests with Node 24's native `node:test` runner.
- **Interactive Web Client**: Glassmorphic dark UI dashboard served at `http://localhost:5000`.

---

## 📐 Alignment with Infographics & Srinath's Portfolio

| Infographic | Concept Applied | Project Implementation |
| :--- | :--- | :--- |
| **Infographic 5: 10 Backend Projects** | Projects #1 & #2 | Full Auth API + URL Shortener API with analytics |
| **Infographic 3: MongoDB vs SQL** | Document Schema & Indexing | Indexed lookups on `shortCode` and `user`, embedded click subdocuments |
| **Infographic 2: FDE Concepts** | Last-Mile & Non-blocking I/O | Instant 302 redirects while offloading telemetry to background write queues |
| **Infographic 4: AI Engineer Stack** | Observability & Testing | Health monitoring, standard JSON error envelopes, 100% test pass rate |
| **Srinath's GitHub Portfolio** | Bridges Frontend to Backend | Directly pairs with `campus-student-marketplace` and `srinath-portfolio-react` |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **MongoDB**: Local server running on `mongodb://127.0.0.1:27017`

### 2. Installation
```bash
git clone https://github.com/Srinath64312/url-shortener-analytics-api.git
cd url-shortener-analytics-api
npm install
```

### 3. Environment Variables
Create a `.env` file (copied from `.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/shortly_db
JWT_SECRET=super_secret_shortly_jwt_token_key_2026_production
BASE_URL=http://localhost:5000
NODE_ENV=development
```

### 4. Running the Server
```bash
# Start server
npm start

# Or with live reload
npm run dev
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser to access the interactive dashboard.

### 5. Running Automated Tests
```bash
npm test
```

---

## 📡 REST API Reference

### System Health
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | System health, database connection state, and uptime | Public |

### Authentication
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account | Public |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | Public |
| `GET` | `/api/auth/me` | Fetch currently logged in user profile | Bearer Token |
| `POST` | `/api/auth/logout` | Invalidate client session | Bearer Token |

### URL Operations
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/urls/shorten` | Shorten a URL (random code or custom alias) | Optional Auth |
| `GET` | `/api/urls/my-urls` | List paginated URLs owned by user | Bearer Token |
| `GET` | `/api/urls/:code/analytics` | Get aggregated click analytics & device breakdown | Public |
| `DELETE` | `/api/urls/:id` | Deactivate/remove a short URL | Bearer Token |

### Redirection
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/:code` | HTTP 302 redirect to original destination & log click | Public |

---

## 🧪 Test Suite Results

```bash
> node --test tests/api.test.js

✔ Unit: Code Generator & URL Validator (92ms)
✔ API: Health Check GET /health (120ms)
✔ API: User Registration POST /api/auth/register (259ms)
✔ API: User Login POST /api/auth/login (211ms)
✔ API: Shorten URL with Random Code POST /api/urls/shorten (53ms)
✔ API: Shorten URL with Custom Alias & Duplicate Prevention (32ms)
✔ API: Redirection & Click Event Tracking GET /:code (318ms)

ℹ tests 7
ℹ pass 7
ℹ fail 0
```

---

## 📄 License
MIT © Srinath
