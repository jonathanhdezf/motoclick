
/**
 * Middleware de Integridad: Verificar que el usuario tenga todos los datos necesarios
 * Especialmente útil para usuarios de Google que no tienen teléfono inicialmente.
 */
/**
 * Middleware de Integridad: Verificar que el usuario tenga todos los datos necesarios
 * Especialmente útil para usuarios de Google que no tienen teléfono inicialmente.
 * Este middleware actúa como una "barrera" que impide el uso de la app sin teléfono.
 */
function checkSessionIntegrity(user) {
  // Si no se pasa usuario, intentar obtenerlo del store global
  if (!user) user = window.store?.getCurrentUser();
  if (!user) return;

  // 1. Identificar si el perfil es incompleto
  // Un teléfono es inválido si: no existe, es muy corto, o es un placeholder legacy (contiene @)
  const isPhoneMissing = !user.phone || user.phone.toString().trim() === '' || user.phone.length < 10 || user.phone.includes('@');
  
  if (isPhoneMissing) {
    console.warn('[Integrity] Perfil incompleto: Falta número de teléfono obligatorio.');
    
    // Páginas donde el teléfono es ABSOLUTAMENTE obligatorio para operar
    const protectedPages = ['nuevo-pedido', 'panel', 'rastreo', 'perfil'];
    const path = window.location.pathname.toLowerCase();
    
    // Identificar si estamos en el portal de cliente o repartidor
    const isClientPortal = path.includes('/cliente');
    const isDriverPortal = path.includes('/repartidor');
    
    // Una página es protegida si el path contiene alguna de las palabras clave o estamos en el index de un portal logueados
    const isProtected = protectedPages.some(page => path.includes(page));
    const isPortalRoot = (isClientPortal || isDriverPortal) && (path.endsWith('/') || path.endsWith('index.html'));

    if (isProtected || isPortalRoot) {
      // Usar user.id o user.user_id (Supabase UUID o Serial PK)
      const userId = user.id || user.user_id;
      if (userId) {
        showPhoneCompletionModal(userId);
      }
    }
  }
}

/**
 * Mostrar modal obligatorio para completar el número de teléfono
 * Diseño Senior: Glassmorphism, Bloqueo de UI, Opción de Logout
 */
function showPhoneCompletionModal(userId) {
  if (document.getElementById('completion-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'completion-modal';
  modal.className = 'modal-overlay animate-fade-in';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(10, 15, 26, 0.85);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  `;

  modal.innerHTML = `
    <div class="modal-content card-glass animate-fade-in-up" style="max-width: 420px; width: 100%; border: 1px solid rgba(0, 230, 91, 0.2); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 2rem;">
        <div style="font-size: 3.5rem; margin-bottom: 1rem; animation: pulse 2s infinite;">📱</div>
        <h2 style="color: #fff; margin-bottom: 0.5rem; font-weight: 800; letter-spacing: -0.02em;">¡Casi listo para pedir!</h2>
        <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5;">
          En <b>MotoClick</b>, tu seguridad es primero. Necesitamos tu WhatsApp para que el repartidor pueda contactarte al llegar.
        </p>
      </div>
      
      <div class="form-group" style="margin-bottom: 1.5rem;">
        <label class="form-label" style="color: var(--text-accent); font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em;">
          Número de Celular (10 dígitos)
        </label>
        <div style="position: relative;">
            <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-weight: 600;">+52</span>
            <input type="tel" id="complete-phone" class="form-input" 
                   placeholder="Ej. 233 123 4567" 
                   maxlength="10" 
                   style="padding-left: 50px; font-size: 1.1rem; font-weight: 600; letter-spacing: 0.1em; border-color: rgba(255,255,255,0.1);"
                   oninput="this.value = this.value.replace(/[^0-9]/g, '')">
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button class="btn btn-primary btn-block btn-lg" id="btn-save-phone" onclick="saveMissingPhone('${userId}')" 
                style="height: 54px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 8px 20px rgba(0, 230, 91, 0.25);">
          Confirmar y Empezar 🛵
        </button>
        
        <button class="btn-text" onclick="window.store?.logout().then(() => window.location.href='/')" 
                style="color: var(--text-muted); font-size: 0.85rem; padding: 10px; border: none; background: transparent; cursor: pointer; text-decoration: underline;">
          Cerrar sesión y salir
        </button>
      </div>

      <div style="margin-top: 1.5rem; text-align: center;">
        <p style="font-size: 0.7rem; color: var(--text-muted); line-height: 1.4;">
            Al continuar, aceptas que un repartidor independiente pueda contactarte vía llamada o WhatsApp únicamente para temas relacionados con tu pedido.
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('complete-phone').focus();
}

/**
 * Guardar el teléfono faltante y actualizar el perfil
 */
async function saveMissingPhone(userId) {
  const phoneInput = document.getElementById('complete-phone');
  const phone = phoneInput.value.trim();
  
  if (!/^\d{10}$/.test(phone)) {
    showToast('Ingresa un número válido de 10 dígitos.', 'error');
    phoneInput.style.borderColor = '#ff4646';
    phoneInput.classList.add('animate-shake');
    setTimeout(() => phoneInput.classList.remove('animate-shake'), 500);
    return;
  }

  const btn = document.getElementById('btn-save-phone');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  try {
    const result = await window.store.updateUser(userId, { 
      phone: phone,
      is_verified: true, // Auto-verificar por ser login OAuth/Proceso de onboarding
      verification_status: 'verified',
      verification_date: new Date().toISOString()
    });

    if (result.success) {
      showToast('¡Perfil listo! Redirigiendo... 🛵', 'success');
      
      // Actualizar metadata de Auth también para consistencia
      if (window.store?._sb?.auth) {
        await window.store._sb.auth.updateUser({ data: { phone: phone } });
      }

      // Animación de salida
      const modal = document.getElementById('completion-modal');
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.5s ease';
      
      setTimeout(() => window.location.reload(), 600);
    } else {
      showToast(result.error || 'Error al guardar el teléfono', 'error');
      btn.disabled = false;
      btn.innerText = originalText;
    }
  } catch (e) {
    console.error('[Integrity] Update failed:', e);
    showToast('Error de conexión. Intenta de nuevo.', 'error');
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

// Ejecutar verificación en varios puntos de entrada para máxima fiabilidad
(function() {
  const runCheck = () => {
    const user = window.store?.getCurrentUser();
    if (user) checkSessionIntegrity(user);
  };

  // 1. Al cargar el DOM
  document.addEventListener('DOMContentLoaded', runCheck);
  
  // 2. Al cargar toda la ventana
  window.addEventListener('load', () => {
    // Delay de respaldo por si el store tarda en restaurar sesión de Supabase
    setTimeout(runCheck, 1000);
    setTimeout(runCheck, 2500);
  });

  // 3. Cuando el store emite que el perfil está listo
  window.addEventListener('motoclick:auth:ready', (e) => {
    if (e.detail) checkSessionIntegrity(e.detail);
  });
})();

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
function showToast(message, type = 'info', duration = 3500, silent = false) {
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
    <div class="toast-progress-bar">
      <div class="toast-progress-fill" style="animation-duration: ${duration}ms"></div>
    </div>
  `;

  container.appendChild(toast);
  
  // Premium Sound Support
  if (!silent) playNotificationSound(type);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── System Notifications (PWA) ──
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        showToast("¡Notificaciones activadas! 🔔", "success");
      }
    });
  }
}

// ── Realtime Admin Broadcasts ──
if (window.store && window.store._sb) {
    const alertChannel = window.store._sb.channel('admin-alerts');
    alertChannel.on('broadcast', { event: 'alert' }, ({ payload }) => {
        const user = window.store.getCurrentUser();
        if (!payload.targetUserId || (user && user.id === payload.targetUserId)) {
            showToast(`${payload.from}: ${payload.message}`, 'info', 6000);
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification(payload.from, { body: payload.message });
            }
        }
    }).subscribe();
}

function showSystemNotification(title, body, type = 'info') {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  const options = {
    body: body,
    icon: '/assets/logo_motoclick_app.png',
    badge: '/assets/logo_motoclick_app.png',
    vibrate: [300, 100, 300, 100, 400], // Stronger vibration for impact
    tag: 'motoclick-notification',
    requireInteraction: true,
    silent: false
  };

  // Play sound locally even if system notification sound is muted by OS
  playNotificationSound(type);

  try {
    // Better background support: try to use Service Worker API
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, options);
        // Backup: Send message to SW
        if (registration.active) {
            registration.active.postMessage({
                type: 'SHOW_NOTIFICATION',
                title: title,
                options: options
            });
        }
      });
    } else {
      new Notification(title, options);
    }
  } catch (e) {
    try { new Notification(title, options); } catch(err) {}
  }
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
  if (!dateStr) return 'Fecha no disponible';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Fecha no disponible';
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
  armando_pedido: '🛒 Comprando',
  en_camino: '🏍️ En camino',
  recolectado: '📦 Recolectado',
  entregado: '🎉 Entregado'
};

const STATUS_ORDER = ['pending', 'accepted', 'armando_pedido', 'en_camino', 'recolectado', 'entregado'];

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function getStatusIndex(status) {
  return STATUS_ORDER.indexOf(status);
}

// ── Navigation ──
function navigateTo(path) {
  window.location.assign(path);
}

function navigateReplace(path) {
  window.location.replace(path);
}

/**
 * Guardia de autenticación — verifica sesión activa y rol
 * Optimización Senior: Validación instantánea por cache + validación reactiva
 */
async function requireAuth(role) {
  const store = window.store;
  if (!store) return null;

  // 1. Verificación instantánea vía Cache (para evitar parpadeo)
  let cachedUser = store.getCurrentUser();
  if (cachedUser && cachedUser.role === role) {
    return cachedUser;
  }

  // 2. Verificación profunda vía Supabase
  // Esperar un momento si la sesión se está restaurando
  let session = null;
  if (store._sb?.auth) {
    const { data } = await store._sb.auth.getSession();
    session = data.session;
  }

  if (session) {
    // Estamos autenticados — ¿Por qué no tenemos perfil? 
    // Tal vez se está cargando. Esperamos un poco.
    console.log('[AuthGuard] Authenticated but no profile cache. Waiting...');
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 300));
      cachedUser = store.getCurrentUser();
      if (cachedUser) break;
    }
  }

  if (!cachedUser || (role && cachedUser.role !== role)) {
    let redirectPath = '/';
    if (role === 'admin') redirectPath = '/admin/';
    else if (role === 'client') redirectPath = '/cliente/';
    else if (role === 'driver') redirectPath = '/repartidor/';
    
    console.warn('[AuthGuard] Session failed or role mismatch. Redirecting to:', redirectPath);
    showToast('Inicia sesión para continuar.', 'warning');
    navigateReplace(redirectPath);
    return null;
  }

  return cachedUser;
}

/**
 * Cerrar sesión — handler universal para todos los portales
 */
async function handleLogout() {
  const store = window.store;
  if (!store) {
    // Si store no existe, redirigir directamente
    window.location.href = '../';
    return;
  }

  try {
    await store.logout();
    showToast('Sesión cerrada correctamente', 'info');
  } catch (e) {
    console.error('[Auth] Logout error:', e);
  }

  // Redirigir según el portal actual invalidando el historial (security rule)
  const currentPath = window.location.pathname;
  if (currentPath.includes('/cliente/')) {
    setTimeout(() => navigateReplace('/cliente/'), 300);
  } else if (currentPath.includes('/repartidor/')) {
    setTimeout(() => navigateReplace('/repartidor/'), 300);
  } else if (currentPath.includes('/admin/')) {
    setTimeout(() => navigateReplace('/admin/'), 300);
  } else {
    setTimeout(() => navigateReplace('/'), 300);
  }
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
// ── Audio helpers for notifications ──
let globalAudioCtx = null;

function playNotificationSound(type = 'info') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    if (!globalAudioCtx) {
      globalAudioCtx = new AudioContext();
    }
    const ctx = globalAudioCtx;
    
    // Resume context if suspended (common browser policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(err => console.warn('Audio resume failed:', err));
    }

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    
    // Higher volume for critical driver alerts
    const volume = (type === 'new_order' || type === 'error' || type === 'warning') ? 0.75 : 0.3;
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);

    const playTone = (freq, startTime, duration, waveType = 'sine') => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(masterGain);
      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, startTime);
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(1, startTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    if (type === 'success') {
      // High-end double chime (C5 -> E5)
      playTone(523.25, ctx.currentTime, 0.4); 
      playTone(659.25, ctx.currentTime + 0.1, 0.5);
    } else if (type === 'error') {
      // Urgent falling alert (F4 -> C4)
      playTone(349.23, ctx.currentTime, 0.5, 'triangle');
      playTone(261.63, ctx.currentTime + 0.2, 0.7, 'triangle');
    } else if (type === 'warning') {
      // Persistent alert beep
      playTone(440, ctx.currentTime, 0.15);
      playTone(440, ctx.currentTime + 0.2, 0.15);
    } else if (type === 'new_order') {
      // Very distinctive rising "Delivery siren" (G4 -> C5 -> E5 -> G5)
      playTone(392.00, ctx.currentTime, 0.25); 
      playTone(523.25, ctx.currentTime + 0.2, 0.25);
      playTone(659.25, ctx.currentTime + 0.4, 0.25);
      playTone(783.99, ctx.currentTime + 0.6, 0.6);
    } else {
      // Clean info pop
      playTone(587.33, ctx.currentTime, 0.3);
    }
  } catch (e) {
    console.error('MotoClick Audio Engine Error:', e);
  }
}

// Global click event to unlock sound early
document.addEventListener('click', () => {
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }
}, { once: true });

// ── Profile Modal ──
function openProfileModal() {
  const user = window.store.getCurrentUser();
  if (!user) return;

  window._tempFavoriteAddresses = Array.isArray(user.favorite_addresses) ? [...user.favorite_addresses] : [];
  if (window._tempFavoriteAddresses.length === 0 && user.address) {
    window._tempFavoriteAddresses.push({
      id: 'addr_migrated',
      name: 'Domicilio Particular',
      address: user.address,
      coords: null
    });
  }

  let modal = document.getElementById('profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.className = 'modal-overlay animate-fade-in';
    
    // Preparar info de OAuth (Google/Facebook)
    const avatarUrl = user.profile_photo_url || user.photo || '../assets/logo_motoclick.png';
    const userEmail = user.email || 'Sin correo vinculado';

    // Different fields based on role
    const roleContent = user.role === 'client' 
      ? `<div class="form-group mb-0">
           <label class="form-label">Mis Direcciones Favoritas</label>
           <div id="favorite-addresses-container" style="display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-md); max-height: 200px; overflow-y: auto; padding-right: 5px;"></div>
           <button type="button" class="btn btn-sm btn-outline btn-block" style="border-style: dashed; border-color: var(--primary-500); color: var(--primary-500);" onclick="openAddressMapPicker()">
              <i class="fas fa-map-marker-alt"></i> Agregar nueva dirección con mapa
           </button>
         </div>`
      : `<div class="form-group">
           <label class="form-label">Vehículo de Trabajo</label>
           <select id="profile-vehicle" class="form-select">
             <option value="Motocicleta" ${user.vehicle === 'Motocicleta' ? 'selected' : ''}>Motocicleta</option>
             <option value="Bicicleta" ${user.vehicle === 'Bicicleta' ? 'selected' : ''}>Bicicleta</option>
             <option value="Automóvil" ${user.vehicle === 'Automóvil' ? 'selected' : ''}>Automóvil</option>
           </select>
         </div>`;

    modal.innerHTML = `
      <div class="modal-content card-glass" style="max-width: 450px;">
        <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
          <h3 style="font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px;">Mi Perfil Premium</h3>
          <button class="modal-close" onclick="document.getElementById('profile-modal').remove()">&times;</button>
        </div>
        
        <div class="modal-body" style="padding-top: var(--space-md);">
          <!-- Header de Perfil con Foto de Google -->
          <div style="text-align: center; margin-bottom: 1.5rem; position: relative;">
            <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--bg-card); border: 3px solid var(--primary-500); margin: 0 auto 1rem; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(0,230,91,0.2);">
              <img src="${avatarUrl}" id="modal-photo-img" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='../assets/logo_motoclick.png'">
            </div>
            <h4 style="font-size: 1.2rem; color: #fff; margin-bottom: 4px;">${user.name}</h4>
            <div style="font-size: 0.85rem; color: var(--primary-500); font-weight: 700; margin-bottom: 8px;">
               <i class="fas fa-envelope" style="font-size: 0.75rem; margin-right: 4px;"></i> ${userEmail}
            </div>
            <div style="font-size: 0.9rem; color: var(--text-muted); background: rgba(255,255,255,0.05); display: inline-block; padding: 4px 12px; border-radius: 20px;">
               <i class="fas fa-phone" style="font-size: 0.75rem; margin-right: 4px;"></i> ${user.phone}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Nombre para el repartidor</label>
            <input type="text" id="profile-name" class="form-input" value="${user.name}" placeholder="Tu nombre real">
          </div>

          ${roleContent}

          <div class="form-group mt-lg">
            <button class="btn btn-primary btn-block" onclick="saveProfileChanges()" style="height: 50px; font-weight: 800; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,230,91,0.3);">
               Guardar Configuración
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    window._tempProfilePhoto = null;
  }
  
  // Render favorites if it's client
  if (user.role === 'client') {
    window.renderFavoriteAddresses();
  }
}

// ── Profile Addresses & Map Picker ──
window.renderFavoriteAddresses = function() {
  const container = document.getElementById('favorite-addresses-container');
  if (!container) return;
  
  if (!window._tempFavoriteAddresses || window._tempFavoriteAddresses.length === 0) {
    container.innerHTML = '<p class="text-secondary fs-xs text-center" style="margin: 10px 0;">No tienes direcciones guardadas.</p>';
    return;
  }
  
  container.innerHTML = window._tempFavoriteAddresses.map((addr, index) => `
    <div class="favorite-address-card" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
      <div style="flex: 1; overflow: hidden;">
        <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 2px;"><i class="fas fa-home text-accent"></i> ${addr.name}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 95%;">${addr.address}</div>
      </div>
      <button type="button" class="btn btn-sm" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 8px 12px; border-radius: 8px; margin-left: 10px;" onclick="removeFavoriteAddress(${index})" title="Eliminar dirección">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
};

window.removeFavoriteAddress = function(index) {
  window._tempFavoriteAddresses.splice(index, 1);
  window.renderFavoriteAddresses();
};

let currentProfileCoords = null;
let currentProfileAddressStr = '';

window.openAddressMapPicker = function() {
  if (typeof google === 'undefined') {
    showToast('Error cargando Google Maps. Revisa tu conexión de red.', 'error');
    return;
  }
  
  let mapModal = document.getElementById('profile-map-modal');
  if (!mapModal) {
    mapModal = document.createElement('div');
    mapModal.id = 'profile-map-modal';
    mapModal.className = 'modal-overlay animate-fade-in';
    mapModal.style.zIndex = '1001'; // Above profile modal
    mapModal.style.alignItems = 'flex-start';
    mapModal.style.paddingTop = '10vh';
    
    mapModal.innerHTML = `
      <div class="modal-content card-glass" style="max-width: 500px; width: 90%; padding: 0; overflow: hidden;">
        <div class="modal-header" style="padding: var(--space-md);">
          <h3 style="margin: 0; font-size: 1.2rem;">📍 Ubicar Dirección</h3>
          <button class="modal-close" type="button" onclick="document.getElementById('profile-map-modal').style.display='none'">&times;</button>
        </div>
        <div class="modal-body">
          <div style="padding: 0 var(--space-md);">
             <label class="form-label" style="font-size: 0.8rem;">Nombre (Ej. Casa, Trabajo, Novia)</label>
             <input type="text" id="profile-addr-name" class="form-input" placeholder="Nombre para recordar la dirección">
             <label class="form-label mt-sm" style="font-size: 0.8rem;">Buscar dirección o mover en el mapa</label>
             <input type="text" id="profile-addr-search" class="form-input" placeholder="Buscar calles o colonias...">
          </div>
          <div id="profile-picker-map" style="width: 100%; height: 250px; background: #0a0f1a; margin-top: var(--space-md);"></div>
          <div style="padding: var(--space-md);">
             <div id="profile-map-status" class="text-secondary" style="font-size: 0.8rem; margin-bottom: var(--space-sm); min-height: 38px;">Mueve el mapa para seleccionar la ubicación exacta.</div>
             <button type="button" class="btn btn-primary btn-block" onclick="confirmProfileAddress()">
                ✔ Guardar Dirección
             </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(mapModal);
  }
  
  mapModal.style.display = 'flex';
  document.getElementById('profile-addr-name').value = '';
  document.getElementById('profile-addr-search').value = '';
  document.getElementById('profile-map-status').innerHTML = 'Mueve el mapa para seleccionar la ubicación exacta.';
  currentProfileCoords = null; currentProfileAddressStr = '';

  const initialPos = { lat: 19.8166, lng: -97.3596 }; // Teziutlan

  if (!window._profileMap) {
    window._profileGeocoder = new google.maps.Geocoder();
    window._profileMap = new google.maps.Map(document.getElementById('profile-picker-map'), {
      center: initialPos, zoom: 16,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
      ]
    });

    window._profileMarker = new google.maps.Marker({
      position: initialPos, map: window._profileMap, draggable: true,
      animation: google.maps.Animation.DROP,
    });

    window._profileMap.addListener('click', (e) => {
      window._profileMarker.setPosition(e.latLng);
      _updateProfileAddressFromMap(e.latLng);
    });

    window._profileMarker.addListener('dragend', () => {
      _updateProfileAddressFromMap(window._profileMarker.getPosition());
    });

    const autocomplete = new google.maps.places.Autocomplete(document.getElementById('profile-addr-search'), {
      bounds: {
        north: 19.8500,
        south: 19.7800,
        east: -97.3200,
        west: -97.4000,
      },
      strictBounds: false,
      componentRestrictions: { country: "mx" },
      fields: ["formatted_address", "geometry", "name"]
    });

    // Autocomplete dropdown is hidden behind modal due to z-index. Fix:
    if (!document.getElementById('pac-container-fix')) {
      const style = document.createElement('style');
      style.id = 'pac-container-fix';
      style.innerHTML = '.pac-container { z-index: 99999 !important; }';
      document.head.appendChild(style);
    }

    autocomplete.addListener('place_changed', () => {
      const p = autocomplete.getPlace();
      if (p.geometry && p.geometry.location) {
         window._profileMap.setCenter(p.geometry.location);
         window._profileMap.setZoom(17);
         window._profileMarker.setPosition(p.geometry.location);
         currentProfileCoords = [p.geometry.location.lat(), p.geometry.location.lng()];
         currentProfileAddressStr = p.formatted_address || p.name;
         document.getElementById('profile-addr-search').value = currentProfileAddressStr;
         document.getElementById('profile-map-status').innerHTML = `<strong class="text-accent">Dirección:</strong> ${currentProfileAddressStr}`;
      }
    });
  }

  // Request location
  if (navigator.geolocation && !currentProfileCoords) {
     navigator.geolocation.getCurrentPosition(
       pos => {
         const p = {lat: pos.coords.latitude, lng: pos.coords.longitude};
         window._profileMap.setCenter(p);
         window._profileMarker.setPosition(p);
         _updateProfileAddressFromMap(new google.maps.LatLng(p.lat, p.lng));
       },
       () => {}
     );
  }

  setTimeout(() => { if (window._profileMap) google.maps.event.trigger(window._profileMap, 'resize'); }, 150);
};

window._updateProfileAddressFromMap = function(latLngObj) {
  currentProfileCoords = [latLngObj.lat(), latLngObj.lng()];
  const textEl = document.getElementById('profile-map-status');
  textEl.innerHTML = '<span class="text-muted">Obteniendo dirección exacta...</span>';
  
  if (window._profileGeocoder) {
    window._profileGeocoder.geocode({ location: latLngObj }, (results, status) => {
      if (status === "OK" && results[0]) {
        currentProfileAddressStr = results[0].formatted_address;
        textEl.innerHTML = `<strong class="text-accent">Dirección:</strong> ${currentProfileAddressStr}`;
      } else {
        currentProfileAddressStr = 'Ubicación seleccionada en el mapa';
        textEl.innerHTML = `<strong class="text-accent">Dirección:</strong> ${currentProfileAddressStr}`;
      }
    });
  }
};

window.confirmProfileAddress = function() {
  const name = document.getElementById('profile-addr-name').value.trim();
  const addr = (document.getElementById('profile-addr-search').value.trim() !== '') ? document.getElementById('profile-addr-search').value.trim() : currentProfileAddressStr;
  
  if (!name || (!addr && addr !== 'Ubicación seleccionada en el mapa' && currentProfileAddressStr === '')) {
    showToast('Ingresa un nombre para tu dirección (ej. Casa) y ubica el lugar en el mapa.', 'warning');
    return;
  }
  
  window._tempFavoriteAddresses.push({
    id: 'addr_' + Date.now(),
    name: name,
    address: addr || currentProfileAddressStr,
    coords: currentProfileCoords
  });
  
  window.renderFavoriteAddresses();
  document.getElementById('profile-map-modal').style.display = 'none';
  showToast('Dirección añadida exitosamente', 'success');
};

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

window.saveProfileChanges = async function() {
  const user = window.store.getCurrentUser();
  if (!user) return;

  const nameInput = document.getElementById('profile-name');
  if (!nameInput.value.trim()) {
    showToast('El nombre no puede estar vacío', 'error');
    return;
  }

  const updates = { name: nameInput.value.trim() };
  if (window._tempProfilePhoto) {
    updates.profile_photo_url = window._tempProfilePhoto;
  }
  
  if (user.role === 'client') {
    updates.favorite_addresses = window._tempFavoriteAddresses;
    // Keep backward compat with single string address
    if (window._tempFavoriteAddresses.length > 0) {
      updates.address = window._tempFavoriteAddresses[0].address;
    } else {
      updates.address = '';
    }
  } else {
    updates.vehicle = document.getElementById('profile-vehicle').value;
  }

  // Deshabilitar botón mientras guarda
  const saveBtn = document.querySelector('#profile-modal .btn-primary');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
  }

  const result = await window.store.updateUser(user.id, updates);
  
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar Cambios';
  }

  if (result && result.success) {
    showToast('Perfil actualizado correctamente', 'success');
    document.getElementById('profile-modal').remove();
    
    // Update UI name if present in navbar
    const userNameEl = document.getElementById('navbar-user-name');
    if (userNameEl && result.user) {
      userNameEl.textContent = result.user.name;
    }
  } else {
    showToast(result?.error || 'Error al actualizar el perfil', 'error');
  }
}

// ── Security Guard: BFCache Exploit Prevention ──
// Detect if page was loaded from browser history (Back button cache)
window.addEventListener('pageshow', function (event) {
  if (event.persisted) {
    if (window.store && typeof window.store.getCurrentUser === 'function') {
      if (!window.store.getCurrentUser()) {
        window.location.replace('/');
      }
    }
  }
});
