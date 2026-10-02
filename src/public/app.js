// State management
let currentUser = null;
let authToken = localStorage.getItem('shortly_jwt') || null;
let authMode = 'login'; // 'login' or 'register'
let currentShortCode = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  checkHealth();
});

const setupEventListeners = () => {
  document.getElementById('shortenForm').addEventListener('submit', handleShortenSubmit);
  document.getElementById('viewAnalyticsBtn').addEventListener('click', () => {
    if (currentShortCode) {
      loadAnalytics(currentShortCode);
    }
  });
};

// Check System Health
const checkHealth = async () => {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    const btn = document.getElementById('healthBtn');
    if (data.status === 'healthy') {
      btn.innerHTML = `<span class="status-dot"></span> System Live (Uptime: ${data.uptime})`;
    }
  } catch (err) {
    const btn = document.getElementById('healthBtn');
    btn.innerHTML = `<span class="status-dot" style="background:#ef4444;box-shadow:0 0 8px #ef4444"></span> System Offline`;
  }
};

// Handle Shortening
const handleShortenSubmit = async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('shortenSubmitBtn');
  const originalUrl = document.getElementById('originalUrl').value.trim();
  const customAlias = document.getElementById('customAlias').value.trim();
  const expiresInDays = document.getElementById('expiresInDays').value;
  const title = document.getElementById('urlTitle').value.trim();

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳ Processing...</span>';

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
      showToast(data.message || 'Failed to shorten URL');
      return;
    }

    // Display result
    currentShortCode = data.data.shortCode;
    const resultBox = document.getElementById('shortenResult');
    const linkEl = document.getElementById('shortLinkOutput');
    const origEl = document.getElementById('originalUrlOutput');
    const qrEl = document.getElementById('qrCodeImg');

    linkEl.href = data.data.shortUrl;
    linkEl.textContent = data.data.shortUrl;
    origEl.textContent = `Destination: ${data.data.originalUrl}`;
    qrEl.src = data.data.qrCode;

    resultBox.classList.remove('hidden');
    showToast('✨ Short URL generated successfully!');

    if (currentUser) {
      loadUserUrls();
    }
  } catch (err) {
    showToast('Network error while shortening URL.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>⚡ Shorten URL</span>';
  }
};

// Copy link to clipboard
const copyShortLink = () => {
  const link = document.getElementById('shortLinkOutput').href;
  navigator.clipboard.writeText(link).then(() => {
    showToast('📋 Copied short link to clipboard!');
  });
};

// Load Analytics for a code
const loadAnalytics = async (code) => {
  try {
    const res = await fetch(`/api/urls/${code}/analytics`);
    const result = await res.json();

    if (!result.success) {
      showToast(result.message || 'Analytics unavailable');
      return;
    }

    const data = result.data;
    const section = document.getElementById('analyticsSection');
    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth' });

    document.getElementById('analyticsSubhead').textContent = `Metrics for ${data.shortUrl} ➔ ${data.originalUrl}`;
    document.getElementById('metricClicks').textContent = data.totalClicks;
    document.getElementById('metricReferrers').textContent = Object.keys(data.breakdown.referrers || {}).length;
    document.getElementById('metricBrowsers').textContent = Object.keys(data.breakdown.browsers || {}).length;
    document.getElementById('metricStatus').textContent = data.isExpired ? 'Expired' : 'Active';

    // Referrers List
    const refContainer = document.getElementById('referrersList');
    refContainer.innerHTML = '';
    const refs = Object.entries(data.breakdown.referrers || {});
    if (refs.length === 0) {
      refContainer.innerHTML = '<div class="text-center">No referrers logged yet.</div>';
    } else {
      refs.forEach(([ref, count]) => {
        refContainer.innerHTML += `
          <div class="stat-row">
            <span>${ref}</span>
            <strong>${count} click${count > 1 ? 's' : ''}</strong>
          </div>`;
      });
    }

    // Browsers List
    const browContainer = document.getElementById('browsersList');
    browContainer.innerHTML = '';
    const brows = Object.entries(data.breakdown.browsers || {});
    if (brows.length === 0) {
      browContainer.innerHTML = '<div class="text-center">No browser data yet.</div>';
    } else {
      brows.forEach(([br, count]) => {
        browContainer.innerHTML += `
          <div class="stat-row">
            <span>${br}</span>
            <strong>${count} click${count > 1 ? 's' : ''}</strong>
          </div>`;
      });
    }

    // Clicks stream table
    const tableBody = document.getElementById('clicksTableBody');
    tableBody.innerHTML = '';
    if (!data.recentClicks || data.recentClicks.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No click events recorded yet. Visit the link to test!</td></tr>';
    } else {
      data.recentClicks.forEach((click) => {
        const timeStr = new Date(click.timestamp).toLocaleString();
        tableBody.innerHTML += `
          <tr>
            <td>${timeStr}</td>
            <td><code>${click.ip}</code></td>
            <td>${click.referrer}</td>
            <td>${click.browser}</td>
            <td>${click.os} (${click.device})</td>
          </tr>
        `;
      });
    }
  } catch (err) {
    showToast('Failed to load analytics.');
  }
};

const closeAnalytics = () => {
  document.getElementById('analyticsSection').classList.add('hidden');
};

// User URLs list
const loadUserUrls = async () => {
  if (!authToken) return;

  try {
    const res = await fetch('/api/urls/my-urls', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const result = await res.json();

    if (!result.success) return;

    const tbody = document.getElementById('userUrlsTableBody');
    tbody.innerHTML = '';

    if (result.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">You have not created any links yet.</td></tr>';
      return;
    }

    result.data.forEach((u) => {
      const createdStr = new Date(u.createdAt).toLocaleDateString();
      tbody.innerHTML += `
        <tr>
          <td>
            <strong>${u.title || 'Untitled'}</strong>
            <div style="font-size:0.75rem;color:var(--text-muted);">${u.originalUrl.substring(0, 45)}...</div>
          </td>
          <td>
            <a href="${u.shortUrl}" target="_blank" style="color:var(--accent-blue);font-weight:600;">${u.shortCode}</a>
          </td>
          <td><span style="font-family:var(--font-mono);">${u.clicks}</span></td>
          <td>${createdStr}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="loadAnalytics('${u.shortCode}')">📊 Analytics</button>
            <button class="btn btn-sm btn-secondary" onclick="deleteUrl('${u.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error(err);
  }
};

// Delete URL
const deleteUrl = async (id) => {
  if (!confirm('Are you sure you want to delete this short URL?')) return;
  try {
    const res = await fetch(`/api/urls/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    showToast(data.message || 'Link deleted');
    loadUserUrls();
  } catch (err) {
    showToast('Error deleting URL');
  }
};

// Authentication state & modal
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
  document.getElementById('userLinksSection').classList.remove('hidden');
};

const renderLoggedOut = () => {
  const container = document.getElementById('authHeaderState');
  container.innerHTML = `
    <button class="nav-btn btn-secondary" onclick="openAuthModal('login')">Sign In</button>
    <button class="nav-btn btn-primary" onclick="openAuthModal('register')">Sign Up</button>
  `;
  document.getElementById('userLinksSection').classList.add('hidden');
};

const openAuthModal = (mode = 'login') => {
  authMode = mode;
  document.getElementById('authModal').classList.remove('hidden');
  document.getElementById('authErrorMsg').classList.add('hidden');

  if (mode === 'login') {
    document.getElementById('modalTitle').textContent = 'Sign In to Shortly';
    document.getElementById('nameGroup').classList.add('hidden');
    document.getElementById('authSubmitBtn').textContent = 'Sign In';
    document.getElementById('modalToggleText').textContent = "Don't have an account?";
    document.getElementById('modalToggleBtn').textContent = 'Sign Up';
  } else {
    document.getElementById('modalTitle').textContent = 'Create an Account';
    document.getElementById('nameGroup').classList.remove('hidden');
    document.getElementById('authSubmitBtn').textContent = 'Sign Up';
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
    localStorage.setItem('shortly_jwt', authToken);

    closeAuthModal();
    renderLoggedIn();
    loadUserUrls();
    showToast(`Welcome ${currentUser.name}! Authenticated successfully.`);
  } catch (err) {
    errorBox.textContent = 'Server error during authentication.';
    errorBox.classList.remove('hidden');
  }
};

const logoutClient = () => {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('shortly_jwt');
  renderLoggedOut();
  showToast('Logged out.');
};

// Toast notification helper
const showToast = (message) => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
};
