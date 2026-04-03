
    const store = new MotoClickStore();
    let currentUserId = null;

    // --- Navigation Logic ---
    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
    }

    function switchTab(tabId, el) {
      document.querySelectorAll('.dashboard-tab').forEach(t => t.classList.add('hidden'));
      document.getElementById(tabId + '-tab').classList.remove('hidden');
      
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      el.classList.add('active');

      const titles = { dashboard: 'Panel General', users: 'Gestión de Cuentas', verifications: 'Auditoría de Identidad', security: 'Códigos de Pago' };
      document.getElementById('page-title').innerText = titles[tabId];
      if (window.innerWidth <= 1024) toggleSidebar();
    }

    // --- Data Loaders ---
    async function loadStats() {
      const stats = await store.getDashboardStats();
      document.getElementById('stat-total-users').innerText = stats.totalUsers || 0;
      document.getElementById('stat-pending-verif').innerText = stats.pendingVerifications || 0;
    }

    async function loadUsers() {
      const tbody = document.getElementById('users-tbody');
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Sincronizando base de datos...</td></tr>';
      const users = await store.getAllUsers();
      tbody.innerHTML = users.map(u => {
        const badgeClass = u.role === 'client' ? 'badge-client' : 'badge-driver';
        const roleName = u.role === 'client' ? 'Cliente' : 'Driver';
        const pinText = u.pin ? `****${u.pin.slice(-2)}` : `<span class="text-muted">SMS Only</span>`;
        return `
          <tr>
            <td class="u-fw-600">${u.name || 'Sin nombre'} <br><small class="u-c-muted">${u.phone}</small></td>
            <td><span class="badge ${badgeClass}">${roleName}</span></td>
            <td><code class="code-badge">${pinText}</code></td>
            <td>
              <div class="u-flex-gap-2">
                <button class="action-btn" onclick="openPinModal('${u.id}', '${escapeHTML(u.name || '')}')" title="🔑 Cambiar PIN">
                  <i class="fas fa-key"></i>
                </button>
                <button class="action-btn btn-warn" onclick="handleDeleteUser('${u.id}', '${escapeHTML(u.name || '')}')" title="🗑️ Eliminar permanentemente">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function loadVerifications() {
      const tbody = document.getElementById('verifications-tbody');
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Escaneando cola de procesos...</td></tr>';
      const { data } = await store.getPendingVerifications();
      
      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Todo al día. No hay solicitudes pendientes. ✅</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(u => `
        <tr>
          <td>
            <div class="u-fw-600">${u.name}</div>
            <div class="u-fs-sm text-muted">${u.phone}</div>
          </td>
          <td class="u-fw-500 u-c-green">${u.full_name || 'N/A'}</td>
          <td>
            <div class="u-flex-gap-8">
               <a href="${u.id_photo_url || '#'}" target="_blank" rel="noopener" title="Ver ID Oficial">
                  <div class="u-id-box">
                      ${u.id_photo_url ? `<img src="${u.id_photo_url}" class="u-img-cover">` : '<i class="fas fa-id-card"></i>'}
                  </div>
              </a>
              <a href="${u.profile_photo_url || '#'}" target="_blank" rel="noopener" title="Ver Selfie">
                  <div class="u-selfie-box">
                      ${u.profile_photo_url ? `<img src="${u.profile_photo_url}" class="u-img-cover">` : '<i class="fas fa-user"></i>'}
                  </div>
              </a>
            </div>
          </td>
          <td>
            <div class="u-flex-gap-2">
              <button class="action-btn active" onclick="approveIdentity('${u.id}')" title="Aprobar Identidad">
                <i class="fas fa-check"></i>
              </button>
              <button class="action-btn btn-warn" onclick="rejectIdentity('${u.id}')" title="Rechazar">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    async function loadSecurityCodes() {
      const tbody = document.getElementById('security-tbody');
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Leyendo bóveda de seguridad...</td></tr>';
      const codes = await store.getAllCashCodes();
      tbody.innerHTML = codes.map(c => `
        <tr>
          <td><code class="code-badge u-ls-1">${c.code}</code></td>
          <td class="u-fw-500">${c.client_name}</td>
          <td class="text-muted"><small>${new Date(c.created_at).toLocaleString()}</small></td>
          <td>
            <button class="action-btn btn-warn" onclick="deleteCode('${c.id}')"><i class="fas fa-trash-alt"></i></button>
          </td>
        </tr>
      `).join('');
    }

    // --- Actions ---
    async function generatePaymentCode() {
      const name = document.getElementById('security-client-name').value;
      if (!name) return showToast('El nombre del cliente es obligatorio', 'error');
      
      const code = 'MOTO-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const { error } = await store.saveSecurityCode(code, name);
      if (!error) {
        showToast('Código Generado: ' + code, 'success');
        document.getElementById('security-client-name').value = '';
        loadSecurityCodes();
      }
    }

    async function approveIdentity(userId) {
      const ok = confirm("¿Emitir certificado de identidad verificado para este usuario?");
      if (!ok) return;
      
      showToast('Actualizando...', 'info');
      const { error } = await store.approveVerification(userId, true, '');
      if (!error) {
        showToast('¡Usuario Verificado!', 'success');
        loadVerifications();
        loadStats();
      } else {
        showToast('Error: ' + error.message, 'error');
      }
    }

    async function rejectIdentity(userId) {
      const notes = prompt("Razón del rechazo (opcional):");
      if (notes === null) return;
      
      showToast('Actualizando...', 'info');
      const { error } = await store.approveVerification(userId, false, notes);
      if (!error) {
        showToast('Solicitud rechazada', 'success');
        loadVerifications();
        loadStats();
      } else {
        showToast('Error: ' + error.message, 'error');
      }
    }

    async function deleteCode(id) {
      if (!confirm("¿Eliminar este código?")) return;
      await store.deleteSecurityCode(id);
      loadSecurityCodes();
    }

    async function handleDeleteUser(userId, userName) {
      if (!confirm(`¿Estás seguro de eliminar permanentemente a ${userName}? Esta acción no se puede deshacer.`)) return;
      
      showToast('Eliminando...', 'info');
      const { error } = await store.deleteUser(userId);
      if (!error) {
        showToast('Usuario eliminado', 'success');
        addLog(`Usuario eliminado: ${userName} (${userId})`, 'warning');
        loadUsers();
        loadStats();
      } else {
        showToast('Error al eliminar: ' + error.message, 'error');
      }
    }

    function openPinModal(userId, userName) {
      currentUserId = userId;
      document.getElementById('pin-modal-user').innerText = `Usuario: ${userName}`;
      document.getElementById('pin-modal').classList.remove('hidden');
      document.getElementById('pin-modal').style.display = 'flex';
    }

    function closePinModal() {
      document.getElementById('pin-modal').classList.add('hidden');
      document.getElementById('pin-modal').style.display = 'none';
      document.getElementById('new-pin-input').value = '';
    }

    document.getElementById('save-pin-btn').onclick = async () => {
      const pin = document.getElementById('new-pin-input').value;
      if (pin.length < 4) return showToast('El PIN debe tener al menos 4 dígitos', 'error');
      
      const { error } = await store.updateUser(currentUserId, { pin });
      if (!error) {
        showToast('PIN actualizado correctamente', 'success');
        closePinModal();
        loadUsers();
      } else {
        showToast('Error: ' + error.message, 'error');
      }
    };

    // --- Realtime Logs ---
    function addLog(msg, type = 'info') {
      const logs = document.getElementById('realtime-logs');
      const entry = document.createElement('div');
      entry.className = `log-entry animate-fade-in`;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      entry.innerHTML = `<span class="log-time">${time}</span><div class="${type === 'warning' ? 'text-warn' : ''}">${msg}</div>`;
      logs.prepend(entry);
    }

    async function initDashboard() {
      loadStats();
      loadUsers();
      loadVerifications();
      loadSecurityCodes();
      
      // Suscribirse a cambios en tiempo real
      if (store._sb) {
        store._sb.channel('admin-logs')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
            addLog(`Nueva órden recibida #${payload.new.id.slice(0,5)}`);
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, payload => {
            addLog(`Usuario ${payload.new.name} actualizó perfil`);
          })
          .subscribe();
      }

    }

    async function sendBroadcast(userId, name) {
      const msg = prompt(`Enviar notificación privada a ${name}:`);
      if (!msg) return;
      
      const { error } = await store.sendNotification(userId, msg);
      if (!error) {
        showToast('Notificación enviada', 'success');
        addLog(`Broadcast enviado a ${name}: ${msg}`, 'info');
      }
    }

    function logoutAdmin() {
      if (confirm('¿Cerrar sesión administrativa?')) {
        localStorage.removeItem('isAdmin');
        window.location.href = '../index.html';
      }
    }

    function escapeHTML(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    initDashboard();
  