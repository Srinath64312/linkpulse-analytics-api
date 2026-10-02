/**
 * LinkPulse • Enterprise URL Shortener & Analytics Frontend
 */

// Application State
let currentUser = null;
let authToken = localStorage.getItem('linkpulse_jwt') || null;
let authMode = 'login'; // 'login' or 'register'
let currentShortCode = null;
let currentShortUrl = null;
let currentQrData = null;
let userUrlsCache = [];
let activeLinkFilter = 'all';

// Chart.js Instances
let timelineChartInstance = null;
let referrerChartInstance = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuth();
  setupEventListeners();
  checkHealth();
  initEmptyCharts();
});

// Setup Form and Global Event Listeners
const setupEventListeners = () => {
  const form = document.getElementById('shortenForm');
  if (form) {
    form.addEventListener('submit', handleShortenSubmit);
  }

  const viewBtn = document.getElementById('viewAnalyticsBtn');
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      if (currentShortCode) {
        switchTab('analytics');
        loadAnalytics(currentShortCode);
      }
    });
  }
};

// ==========================================================================
// Theme Management (Dark / Light)
// ==========================================================================
const initTheme = () => {
  const savedTheme = localStorage.getItem('linkpulse_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
};

const toggleTheme = () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('linkpulse_theme', nextTheme);
  updateThemeIcon(nextTheme);
  
  // Re-render charts with updated theme colors if data exists
  if (currentShortCode) {
    loadAnalytics(currentShortCode);
  }
};

const updateThemeIcon = (theme) => {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
};

// ==========================================================================
// Tab Switching System
// ==========================================================================
const switchTab = (tabId) => {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.classList.remove('active');
  });

  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) {
    activePane.classList.add('active');
  }

  // Refresh tab-specific data
  if (tabId === 'links' && authToken) {
    loadUserUrls();
  }
};

// ==========================================================================
// System Health Check
// ==========================================================================
const checkHealth = async () => {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    const btn = document.getElementById('healthBtn');
    const statusText = document.getElementById('healthStatusText');
    if (data.status === 'healthy') {
      statusText.textContent = `Online • ${data.uptime}`;
      btn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    }
  } catch (err) {
    const statusText = document.getElementById('healthStatusText');
    statusText.textContent = 'Offline';
    const dot = document.querySelector('.status-dot');
    if (dot) {
      dot.style.backgroundColor = '#ef4444';
      dot.style.boxShadow = '0 0 8px #ef4444';
    }
  }
};

// ==========================================================================
// URL Shortening Handler
// ==========================================================================
const handleShortenSubmit = async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('shortenSubmitBtn');
  const originalUrl = document.getElementById('originalUrl').value.trim();
  const customAlias = document.getElementById('customAlias').value.trim();
  const expiresInDays = document.getElementById('expiresInDays').value;
  const title = document.getElementById('urlTitle').value.trim();

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳ Processing via NanoID & MongoDB...</span>';

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const payload = {
      originalUrl,
      customAlias: customAlias || undefined,
      expiresInDays: expiresInDays || undefined,
      title: title || undefined
    };

    const res = await fetch('/api/urls/shorten', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || 'Failed to shorten URL', '⚠️');
      return;
    }

    // Populate Results
    currentShortCode = data.data.shortCode;
    currentShortUrl = data.data.shortUrl;
    currentQrData = data.data.qrCode;

    const resultBox = document.getElementById('shortenResult');
    const linkEl = document.getElementById('shortLinkOutput');
    const origEl = document.getElementById('originalUrlOutput');
    const qrEl = document.getElementById('qrCodeImg');
    const aliasTag = document.getElementById('resultAliasTag');
    const expiryTag = document.getElementById('resultExpiryTag');

    linkEl.href = currentShortUrl;
    linkEl.textContent = currentShortUrl;
    origEl.textContent = `Destination: ${data.data.originalUrl}`;
    qrEl.src = currentQrData;

    aliasTag.textContent = data.data.customAlias ? 'Vanity Slug' : 'NanoID Code';
    expiryTag.textContent = data.data.expiresAt 
      ? `Expires ${new Date(data.data.expiresAt).toLocaleDateString()}` 
      : 'Permanent Link';

    resultBox.classList.remove('hidden');
    resultBox.scrollIntoView({ behavior: 'smooth' });
    showToast('✨ Short link generated and indexed!', '⚡');

    // Auto-update analytics search box
    document.getElementById('analyticsCodeInput').value = currentShortCode;

    if (currentUser) {
      loadUserUrls();
    }
  } catch (err) {
    showToast('Network error while communicating with server.', '❌');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-text">⚡ Generate Trackable Short Link</span>';
  }
};

// Clipboard Helpers
const copyShortLink = () => {
  if (!currentShortUrl) return;
  navigator.clipboard.writeText(currentShortUrl).then(() => {
    const copyLabel = document.getElementById('copyLabel');
    const copyIcon = document.getElementById('copyIcon');
    copyLabel.textContent = 'Copied!';
    copyIcon.textContent = '✅';
    showToast('📋 Copied short link to clipboard!', '📋');
    setTimeout(() => {
      copyLabel.textContent = 'Copy';
      copyIcon.textContent = '📋';
    }, 2000);
  });
};

const pasteFromClipboard = async (inputId) => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      document.getElementById(inputId).value = text;
      showToast('📋 Pasted from clipboard', '📋');
    }
  } catch (err) {
    showToast('Clipboard permission denied', '⚠️');
  }
};

// Test redirect and auto-refresh analytics
const testRedirect = () => {
  if (!currentShortUrl) return;
  window.open(currentShortUrl, '_blank');
  showToast('🚀 Test click dispatched! Updating telemetry...', '📈');
  setTimeout(() => {
    switchTab('analytics');
    loadAnalytics(currentShortCode);
  }, 1000);
};

// Download QR Code as PNG
const downloadQRCode = () => {
  if (!currentQrData) return;
  const a = document.createElement('a');
  a.href = currentQrData;
  a.download = `linkpulse-${currentShortCode || 'qrcode'}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('📥 QR Code downloaded successfully', '📥');
};

// ==========================================================================
// Analytics Visualizer & Chart.js Integration
// ==========================================================================
const initEmptyCharts = () => {
  const ctxTimeline = document.getElementById('timelineChart');
  const ctxReferrer = document.getElementById('referrerChart');

  if (ctxTimeline && !timelineChartInstance) {
    timelineChartInstance = new Chart(ctxTimeline, {
      type: 'line',
      data: {
        labels: ['No Data'],
        datasets: [{
          label: 'Clicks',
          data: [0],
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  if (ctxReferrer && !referrerChartInstance) {
    referrerChartInstance = new Chart(ctxReferrer, {
      type: 'doughnut',
      data: {
        labels: ['Direct'],
        datasets: [{
          data: [1],
          backgroundColor: ['#38bdf8', '#3b82f6', '#10b981', '#f59e0b', '#6366f1'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, color: '#94a3b8' } }
        }
      }
    });
  }
};

const searchAnalyticsByInput = () => {
  const code = document.getElementById('analyticsCodeInput').value.trim();
  if (code) {
    loadAnalytics(code);
  } else {
    showToast('Please enter a short code to inspect', '⚠️');
  }
};

const refreshCurrentAnalytics = () => {
  if (currentShortCode) {
    loadAnalytics(currentShortCode);
  } else {
    showToast('No active link selected for refresh', '⚠️');
  }
};

const loadAnalytics = async (code) => {
  try {
    currentShortCode = code;
    document.getElementById('analyticsCodeInput').value = code;

    const res = await fetch(`/api/urls/${code}/analytics`);
    const result = await res.json();

    if (!result.success) {
      showToast(result.message || 'Analytics not found for this code', '⚠️');
      return;
    }

    const data = result.data;
    currentShortUrl = data.shortUrl;

    document.getElementById('analyticsSubhead').textContent = `Metrics for ${data.shortUrl} ➔ ${data.originalUrl}`;
    document.getElementById('metricClicks').textContent = data.totalClicks;
    document.getElementById('metricReferrers').textContent = Object.keys(data.breakdown.referrers || {}).length;
    document.getElementById('metricBrowsers').textContent = Object.keys(data.breakdown.browsers || {}).length;

    const statusEl = document.getElementById('metricStatus');
    const expiryEl = document.getElementById('metricExpiryDetails');
    if (data.isExpired) {
      statusEl.textContent = 'Expired';
      statusEl.className = 'metric-num text-rose';
      expiryEl.textContent = `Expired on ${new Date(data.expiresAt).toLocaleDateString()}`;
    } else {
      statusEl.textContent = 'Active';
      statusEl.className = 'metric-num text-emerald';
      expiryEl.textContent = data.expiresAt 
        ? `Expires on ${new Date(data.expiresAt).toLocaleDateString()}` 
        : 'Permanent Link';
    }

    // Update Referrers List
    const refContainer = document.getElementById('referrersList');
    refContainer.innerHTML = '';
    const refs = Object.entries(data.breakdown.referrers || {});
    if (refs.length === 0) {
      refContainer.innerHTML = '<div class="empty-state-mini">No referrers logged yet.</div>';
    } else {
      refs.forEach(([ref, count]) => {
        refContainer.innerHTML += `
          <div class="stat-row">
            <span>🌐 ${ref}</span>
            <strong>${count} click${count > 1 ? 's' : ''}</strong>
          </div>`;
      });
    }

    // Update OS / Devices List
    const osContainer = document.getElementById('osList');
    osContainer.innerHTML = '';
    const osEntries = Object.entries(data.breakdown.os || {});
    if (osEntries.length === 0) {
      osContainer.innerHTML = '<div class="empty-state-mini">No operating system data yet.</div>';
    } else {
      osEntries.forEach(([osName, count]) => {
        osContainer.innerHTML += `
          <div class="stat-row">
            <span>💻 ${osName}</span>
            <strong>${count} click${count > 1 ? 's' : ''}</strong>
          </div>`;
      });
    }

    // Update Click Stream Table
    const tableBody = document.getElementById('clicksTableBody');
    tableBody.innerHTML = '';
    if (!data.recentClicks || data.recentClicks.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No click events logged yet. Visit the link to test!</td></tr>';
    } else {
      data.recentClicks.forEach((click) => {
        const timeStr = new Date(click.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = new Date(click.timestamp).toLocaleDateString();
        tableBody.innerHTML += `
          <tr>
            <td><strong>${timeStr}</strong> <span style="font-size:0.75rem;color:var(--text-dim);">${dateStr}</span></td>
            <td><code>${click.ip}</code></td>
            <td><span class="meta-tag">${click.referrer}</span></td>
            <td>${click.browser}</td>
            <td>${click.os} (${click.device})</td>
          </tr>
        `;
      });
    }

    // Update Timeline Chart (Chart.js)
    updateTimelineChart(data.breakdown.clicksByDate || {});

    // Update Referrer Doughnut Chart
    updateReferrerChart(data.breakdown.referrers || {});

    showToast(`📊 Telemetry loaded for /${code}`, '📊');
  } catch (err) {
    showToast('Failed to load analytics.', '❌');
  }
};

const updateTimelineChart = (clicksByDate) => {
  const dates = Object.keys(clicksByDate);
  const counts = Object.values(clicksByDate);

  const labels = dates.length ? dates : ['Today'];
  const values = counts.length ? counts : [0];

  if (timelineChartInstance) {
    timelineChartInstance.data.labels = labels;
    timelineChartInstance.data.datasets[0].data = values;
    timelineChartInstance.update();
  }
};

const updateReferrerChart = (referrersMap) => {
  const labels = Object.keys(referrersMap);
  const values = Object.values(referrersMap);

  if (referrerChartInstance) {
    referrerChartInstance.data.labels = labels.length ? labels : ['Direct'];
    referrerChartInstance.data.datasets[0].data = values.length ? values : [1];
    referrerChartInstance.update();
  }
};

// ==========================================================================
// User Links Hub (Search, Filter, Management)
// ==========================================================================
const loadUserUrls = async () => {
  if (!authToken) return;

  try {
    const res = await fetch('/api/urls/my-urls', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const result = await res.json();

    if (!result.success) return;

    userUrlsCache = result.data || [];
    const counterBadge = document.getElementById('myLinksCount');
    counterBadge.textContent = userUrlsCache.length;
    counterBadge.classList.remove('hidden');

    renderUserLinksTable();
  } catch (err) {
    console.error('Error loading links:', err);
  }
};

const renderUserLinksTable = () => {
  const tbody = document.getElementById('userUrlsTableBody');
  tbody.innerHTML = '';

  const query = (document.getElementById('linkSearchInput').value || '').toLowerCase();
  
  const filtered = userUrlsCache.filter((u) => {
    const matchesQuery = 
      (u.title && u.title.toLowerCase().includes(query)) ||
      u.shortCode.toLowerCase().includes(query) ||
      u.originalUrl.toLowerCase().includes(query);

    if (!matchesQuery) return false;

    if (activeLinkFilter === 'active') return !u.isExpired;
    if (activeLinkFilter === 'expired') return u.isExpired;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5">No matching links found.</td></tr>';
    return;
  }

  filtered.forEach((u) => {
    const createdStr = new Date(u.createdAt).toLocaleDateString();
    const statusBadge = u.isExpired
      ? '<span class="badge" style="background:rgba(244,63,94,0.15);color:#f43f5e;border-color:rgba(244,63,94,0.3)">Expired</span>'
      : '<span class="badge badge-success">Active</span>';

    tbody.innerHTML += `
      <tr>
        <td>
          <strong>${u.title || 'Untitled Campaign'}</strong>
          <div style="font-size:0.75rem;color:var(--text-muted);">${u.originalUrl.substring(0, 48)}...</div>
        </td>
        <td>
          <a href="${u.shortUrl}" target="_blank" style="color:var(--accent-cyan);font-weight:700;font-family:var(--font-mono);">${u.shortCode}</a>
        </td>
        <td><strong style="font-family:var(--font-mono);font-size:1.05rem;">${u.clicks}</strong></td>
        <td>${statusBadge}</td>
        <td><span style="font-size:0.8rem;color:var(--text-dim);">${createdStr}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-outline" onclick="inspectLink('${u.shortCode}')" title="Inspect Telemetry">📊</button>
            <button class="btn btn-sm btn-secondary" onclick="openQrModal('${u.shortUrl}')" title="View QR Code">📱</button>
            <button class="btn btn-sm btn-secondary" onclick="deleteUrl('${u.id}')" title="Delete Link">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });
};

const filterUserLinks = () => {
  renderUserLinksTable();
};

const setLinkFilter = (filterType, element) => {
  activeLinkFilter = filterType;
  document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
  element.classList.add('active');
  renderUserLinksTable();
};

const inspectLink = (code) => {
  switchTab('analytics');
  loadAnalytics(code);
};

const deleteUrl = async (id) => {
  if (!confirm('Are you sure you want to delete this short URL?')) return;
  try {
    const res = await fetch(`/api/urls/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    showToast(data.message || 'Link deleted', '🗑️');
    loadUserUrls();
  } catch (err) {
    showToast('Error deleting URL', '❌');
  }
};

// ==========================================================================
// QR Code Zoom Modal
// ==========================================================================
const openQrModal = (url) => {
  document.getElementById('qrModalLinkText').textContent = url;
  const modalImg = document.getElementById('qrModalImg');
  modalImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  document.getElementById('qrModal').classList.remove('hidden');
};

const closeQrModal = () => {
  document.getElementById('qrModal').classList.add('hidden');
};

// ==========================================================================
// API Playground & Interactive Runner
// ==========================================================================
const testApiEndpoint = async (endpoint, method) => {
  const consoleOutput = document.getElementById('apiConsoleOutput');
  consoleOutput.textContent = `// Executing ${method} ${endpoint}...\n`;

  try {
    const startTime = performance.now();
    const res = await fetch(endpoint, { method });
    const duration = Math.round(performance.now() - startTime);
    const json = await res.json();

    consoleOutput.textContent = `// HTTP ${res.status} ${res.statusText} (${duration}ms)\n` + JSON.stringify(json, null, 2);
    showToast(`HTTP ${res.status} returned in ${duration}ms`, '⚡');
  } catch (err) {
    consoleOutput.textContent = `// Execution failed: ${err.message}`;
  }
};

const clearApiConsole = () => {
  document.getElementById('apiConsoleOutput').textContent = '// Console cleared.';
};

// ==========================================================================
// Authentication State Management
// ==========================================================================
const checkAuth = async () => {
  if (!authToken) {
    renderLoggedOut();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      currentUser = data.data;
      renderLoggedIn();
      loadUserUrls();
    } else {
      logoutClient();
    }
  } catch (err) {
    renderLoggedOut();
  }
};

const renderLoggedIn = () => {
  const container = document.getElementById('authHeaderState');
  container.innerHTML = `
    <span style="font-size:0.85rem;color:var(--text-muted);">Hi, <strong>${currentUser.name}</strong></span>
    <button class="nav-btn btn-secondary" onclick="logoutClient()">Sign Out</button>
  `;
};

const renderLoggedOut = () => {
  const container = document.getElementById('authHeaderState');
  container.innerHTML = `
    <button class="nav-btn btn-secondary" onclick="openAuthModal('login')">Sign In</button>
    <button class="nav-btn btn-primary" onclick="openAuthModal('register')">Get Started</button>
  `;
};

const openAuthModal = (mode = 'login') => {
  authMode = mode;
  document.getElementById('authModal').classList.remove('hidden');
  document.getElementById('authErrorMsg').classList.add('hidden');

  if (mode === 'login') {
    document.getElementById('modalTitle').textContent = 'Sign In to LinkPulse';
    document.getElementById('modalSub').textContent = 'Enter your email and password to access your dashboard';
    document.getElementById('nameGroup').classList.add('hidden');
    document.getElementById('authBtnText').textContent = 'Sign In';
    document.getElementById('modalToggleText').textContent = "Don't have an account?";
    document.getElementById('modalToggleBtn').textContent = 'Sign Up';
  } else {
    document.getElementById('modalTitle').textContent = 'Create an Account';
    document.getElementById('modalSub').textContent = 'Get started with LinkPulse analytics';
    document.getElementById('nameGroup').classList.remove('hidden');
    document.getElementById('authBtnText').textContent = 'Create Account';
    document.getElementById('modalToggleText').textContent = 'Already have an account?';
    document.getElementById('modalToggleBtn').textContent = 'Sign In';
  }
};

const closeAuthModal = () => {
  document.getElementById('authModal').classList.add('hidden');
};

const toggleAuthMode = () => {
  openAuthModal(authMode === 'login' ? 'register' : 'login');
};

const handleAuthSubmit = async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('authErrorMsg');
  errorBox.classList.add('hidden');

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();

  const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
  const body = authMode === 'login' ? { email, password } : { name, email, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!data.success) {
      errorBox.textContent = data.message || 'Authentication failed.';
      errorBox.classList.remove('hidden');
      return;
    }

    authToken = data.data.token;
    currentUser = data.data.user;
    localStorage.setItem('linkpulse_jwt', authToken);

    closeAuthModal();
    renderLoggedIn();
    loadUserUrls();
    showToast(`Welcome ${currentUser.name}! Authenticated successfully.`, '🎉');
  } catch (err) {
    errorBox.textContent = 'Server error during authentication.';
    errorBox.classList.remove('hidden');
  }
};

const logoutClient = () => {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('linkpulse_jwt');
  renderLoggedOut();
  const counter = document.getElementById('myLinksCount');
  if (counter) counter.classList.add('hidden');
  showToast('Logged out successfully.', '👋');
};

// ==========================================================================
// Toast Notification
// ==========================================================================
let toastTimeout;
const showToast = (message, icon = '✨') => {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.textContent = message;
  toastIcon.textContent = icon;

  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
};
