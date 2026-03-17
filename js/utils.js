/**
 * MotoClick — Utilidades compartidas
 */

// ── Toast Notifications ──
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Form Validation ──
function validateField(input, rules) {
  const value = input.value.trim();
  const group = input.closest('.form-group');
  const errorEl = group ? group.querySelector('.form-error') : null;

  let error = '';

  if (rules.required && !value) {
    error = rules.requiredMessage || 'Este campo es obligatorio.';
  } else if (rules.minLength && value.length < rules.minLength) {
    error = `Mínimo ${rules.minLength} caracteres.`;
  } else if (rules.phone && !/^[0-9]{10}$/.test(value)) {
    error = 'Ingresa un teléfono válido de 10 dígitos.';
  }

  if (error) {
    if (group) group.classList.add('has-error');
    if (errorEl) errorEl.textContent = error;
    return false;
  } else {
    if (group) group.classList.remove('has-error');
    return true;
  }
}

function validateForm(formEl, rulesMap) {
  let isValid = true;
  for (const [name, rules] of Object.entries(rulesMap)) {
    const input = formEl.querySelector(`[name="${name}"]`);
    if (input && !validateField(input, rules)) {
      isValid = false;
    }
  }
  return isValid;
}

// ── Currency Format ──
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

// ── Date Format ──
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Justo ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr}h`;
  return formatDate(dateStr);
}

// ── Payment helpers ──
const PAYMENT_LABELS = {
  cash: '💵 Efectivo',
  card: '💳 Tarjeta',
  transfer: '🏦 Transferencia'
};

const PAYMENT_BADGES = {
  cash: 'badge-cash',
  card: 'badge-card',
  transfer: 'badge-transfer'
};

function getPaymentLabel(method) {
  return PAYMENT_LABELS[method] || method;
}

function getPaymentBadgeClass(method) {
  return PAYMENT_BADGES[method] || '';
}

// ── Status helpers ──
const STATUS_LABELS = {
  pending: '⏳ Pendiente',
  accepted: '✅ Aceptado',
  en_camino: '🏍️ En camino',
  recolectado: '📦 Recolectado',
  entregado: '🎉 Entregado'
};

const STATUS_ORDER = ['pending', 'accepted', 'en_camino', 'recolectado', 'entregado'];

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function getStatusIndex(status) {
  return STATUS_ORDER.indexOf(status);
}

// ── Navigation ──
function navigateTo(path) {
  window.location.href = path;
}

function requireAuth(role) {
  const user = window.store.getCurrentUser();
  if (!user || user.role !== role) {
    const redirectPath = role === 'client' ? '../cliente/' : '../repartidor/';
    showToast('Inicia sesión para continuar.', 'warning');
    setTimeout(() => navigateTo(redirectPath), 500);
    return null;
  }
  return user;
}

// ── Leaflet map helpers ──
const DEFAULT_CENTER = [19.4326, -99.1332]; // CDMX
const DEFAULT_ZOOM = 13;

function createMap(containerId, options = {}) {
  const map = L.map(containerId, {
    zoomControl: false,
    ...options
  }).setView(options.center || DEFAULT_CENTER, options.zoom || DEFAULT_ZOOM);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  return map;
}

function createIcon(emoji, size = 36) {
  return L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${emoji}</div>`,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// ── Simulate driver movement along route ──
function simulateMovement(points, callback, intervalMs = 1500) {
  let idx = 0;
  const timer = setInterval(() => {
    if (idx >= points.length) {
      clearInterval(timer);
      return;
    }
    callback(points[idx], idx, points.length);
    idx++;
  }, intervalMs);
  return timer;
}

// Generate intermediate points between two coords
function generateRoute(start, end, steps = 20) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start[0] + (end[0] - start[0]) * t + (Math.random() - 0.5) * 0.001;
    const lng = start[1] + (end[1] - start[1]) * t + (Math.random() - 0.5) * 0.001;
    points.push([lat, lng]);
  }
  return points;
}

// ── Audio beep for notifications ──
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Silently fail if audio API not available
  }
}
