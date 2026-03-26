/**
 * MotoClick — Utilidades compartidas
 */

/* ── PWA & Service Worker Setup ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.json';
      document.head.appendChild(manifest);

      const theme = document.createElement('meta');
      theme.name = 'theme-color';
      theme.content = '#1e293b';
      document.head.appendChild(theme);
      
      const appleTouch = document.createElement('link');
      appleTouch.rel = 'apple-touch-icon';
      appleTouch.href = '/assets/logo.png';
      document.head.appendChild(appleTouch);
    }

    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('MotoClick PWA Engine Active:', reg.scope))
      .catch(err => console.error('PWA Engine Error:', err));
  });
}

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

function tripDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const diffMs = new Date(endIso) - new Date(startIso);
  const totalMin = Math.floor(diffMs / 60000);
  if (totalMin < 1) return 'Menos de 1 min';
  if (totalMin < 60) return `${totalMin} min`;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
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

// ── Profile Modal ──
function openProfileModal() {
  const user = window.store.getCurrentUser();
  if (!user) return;

  let modal = document.getElementById('profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.className = 'modal-overlay animate-fade-in';
    
    // Different fields based on role
    const extraField = user.role === 'client' 
      ? `<div class="form-group">
           <label class="form-label">Dirección (Opcional)</label>
           <input type="text" id="profile-address" class="form-input" value="${user.address || ''}" placeholder="Ej. Av. Siempre Viva 123">
         </div>`
      : `<div class="form-group" style="text-align: center; border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-md); margin-bottom: var(--space-md);">
           <label class="form-label" style="text-align: left;">Foto de perfil</label>
           <div class="profile-photo-preview" style="width: 80px; height: 80px; border-radius: 50%; background: var(--bg-card); border: 2px solid var(--primary-500); margin: 0 auto var(--space-sm); overflow: hidden; display: flex; align-items: center; justify-content: center;">
             ${user.photo ? `<img src="${user.photo}" id="modal-photo-img" style="width: 100%; height: 100%; object-fit: cover;">` : `<span id="modal-photo-icon" style="font-size: 2.5rem;">👤</span>`}
           </div>
           <label class="btn btn-sm btn-secondary" style="cursor: pointer; display: inline-block;">
             Cambiar Foto
             <input type="file" id="profile-photo" accept="image/*" style="display: none;" onchange="handlePhotoUpload(event)">
           </label>
         </div>
         <div class="form-group">
           <label class="form-label">Vehículo</label>
           <select id="profile-vehicle" class="form-select">
             <option value="Motocicleta" ${user.vehicle === 'Motocicleta' ? 'selected' : ''}>Motocicleta</option>
             <option value="Bicicleta" ${user.vehicle === 'Bicicleta' ? 'selected' : ''}>Bicicleta</option>
             <option value="Automóvil" ${user.vehicle === 'Automóvil' ? 'selected' : ''}>Automóvil</option>
           </select>
         </div>`;

    modal.innerHTML = `
      <div class="modal-content card-glass">
        <div class="modal-header">
          <h3>Mi Perfil</h3>
          <button class="modal-close" onclick="document.getElementById('profile-modal').remove()">&times;</button>
        </div>
        <div class="modal-body mt-md">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <input type="text" id="profile-name" class="form-input" value="${user.name}">
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input type="text" id="profile-phone" class="form-input" value="${user.phone}" disabled>
            <small class="text-muted mt-sm">El teléfono no se puede cambiar.</small>
          </div>
          ${extraField}
          <div class="form-group mt-lg">
            <button class="btn btn-primary btn-block" onclick="saveProfileChanges()">Guardar Cambios</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    window._tempProfilePhoto = null;
  }
}

window.handlePhotoUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    compressImage(dataUrl, 300, 300, 0.8, (compressedBase64) => {
      window._tempProfilePhoto = compressedBase64;
      const previewContainer = document.querySelector('.profile-photo-preview');
      if (previewContainer) {
        previewContainer.innerHTML = `<img src="${compressedBase64}" id="modal-photo-img" style="width: 100%; height: 100%; object-fit: cover;">`;
      }
    });
  };
  reader.readAsDataURL(file);
};

function compressImage(src, maxWidth, maxHeight, quality, callback) {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = () => callback(src);
}

window.saveProfileChanges = function() {
  const user = window.store.getCurrentUser();
  if (!user) return;

  const nameInput = document.getElementById('profile-name');
  if (!nameInput.value.trim()) {
    showToast('El nombre no puede estar vacío', 'error');
    return;
  }

  const updates = { name: nameInput.value.trim() };
  if (window._tempProfilePhoto) {
    updates.photo = window._tempProfilePhoto;
  }
  
  if (user.role === 'client') {
    updates.address = document.getElementById('profile-address').value.trim();
  } else {
    updates.vehicle = document.getElementById('profile-vehicle').value;
  }

  const result = window.store.updateUser(user.id, updates);
  if (result.success) {
    showToast('Perfil actualizado correctamente', 'success');
    document.getElementById('profile-modal').remove();
    
    // Update UI name if present in navbar
    const userNameEl = document.getElementById('navbar-user-name');
    if (userNameEl) {
      userNameEl.textContent = result.user.name;
    }
  } else {
    showToast('Error al actualizar el perfil', 'error');
  }
}
