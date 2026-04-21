/**
 * MotoClick — Store con Supabase Auth
 * 
 * INTEGRACIÓN CON SUPABASE AUTH:
 * - login/register usan supabase.auth (manejo de sesiones JWT)
 * - Las consultas a la DB usan las políticas RLS con auth.uid()
 * - Si Auth no está disponible, fallback a login directo por DB (legacy)
 * 
 * MIGRACIÓN:
 * Los usuarios existentes con PIN en texto plano migran automáticamente
 * al usar auth.signInWithPassword() con el formato email virtual.
 */

class MotoClickStore {
  constructor() {
    // Definir global de inmediato para otros scripts
    window.store = this;
    window.MotoClickStore = this;

    this._listeners = {};
    this._sb = null;
    this._useFallback = true;
    this._currentUser = null;
    this._auth = null;  // Referencia a MotoClickAuth
    this._init();
  }

  _init() {
    try {
      this._currentUser = JSON.parse(localStorage.getItem('motoclick_current_user'));
    } catch { this._currentUser = null; }

    if (typeof supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON !== 'undefined') {
      this._sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      this._useFallback = false;

      // Inicializar capa de autenticación si está disponible
      if (typeof MotoClickAuth !== 'undefined') {
        this._auth = new MotoClickAuth(this._sb);
        // Restaurar sesión si existe
        this._restoreSession();
      }

      this._subscribeRealtime();
      this._initPresence();
    } else {
      console.warn('[MotoClick] Supabase no disponible — usando localStorage.');
      this._useFallback = true;
      this._initBroadcast();
    }
  }

  /**
   * Restaurar sesión activa desde Supabase Auth
   */
  async _restoreSession() {
    if (!this._auth || !this._sb) return;

    try {
      const { data } = await this._sb.auth.getSession();
      if (data.session) {
        console.log('[Store] Session restored, loading profile...');
        await this._auth._onSessionStart(data.session);
        // Actualizar referencia local
        this._currentUser = JSON.parse(localStorage.getItem('motoclick_current_user'));
      }
    } catch (e) {
      console.warn('[Store] Session restore failed:', e);
    }
  }

  // ── Realtime (Supabase) ───────────────────────────────────────
  _subscribeRealtime() {
    this._sb.channel('orders-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        this._emit('new_order', this._fromDB(payload.new));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const order = this._fromDB(payload.new);
        this._emit('status_change', order);
        this._emit('order_updated', order);
        if (JSON.stringify(payload.new.driver_location) !== JSON.stringify(payload.old?.driver_location)) {
          this._emit('location_update', { orderId: order.id, location: order.driverLocation });
        }
      })
      .on('broadcast', { event: 'admin_notification' }, (payload) => {
        this._emit('notification', payload.payload);
      })
      .subscribe();
  }

  // ── BroadcastChannel fallback ─────────────────────────────────
  _initBroadcast() {
    try {
      this._channel = new BroadcastChannel('motoclick-sync');
      this._channel.onmessage = (e) => this._emit(e.data.type, e.data.payload);
    } catch (e) {}
  }

  _broadcast(type, payload) {
    if (this._channel) this._channel.postMessage({ type, payload });
  }

  // ── Event System ──────────────────────────────────────────────
  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
    return () => { this._listeners[event] = this._listeners[event].filter(f => f !== cb); };
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => { try { cb(data); } catch(e) {} });
  }

  // ── DB mapping ────────────────────────────────────────────────
  _fromDB(row) {
    if (!row) return null;
    return {
      id:                row.id,
      clientId:          row.client_id,
      clientName:        row.client_name,
      clientPhone:       row.client_phone,
      driverId:          row.driver_id,
      driverName:        row.driver_name,
      driverPhoto:       row.driver?.profile_photo_url || row.driver_photo,
      driverLocation:    row.driver_location,
      status:            row.status,
      description:       row.description,
      pickupAddress:     row.pickup_address,
      deliveryAddress:   row.delivery_address,
      pickupCoords:      row.pickup_coords,
      deliveryCoords:    row.delivery_coords,
      paymentMethod:     row.payment_method,
      estimatedPriceMin: row.estimated_price_min,
      estimatedPriceMax: row.estimated_price_max,
      routeDistanceText: row.route_distance_text,
      specialServices:   row.special_services || [],
      stops:             row.stops || [],
      stopDescription:   row.stop_description,
      acceptedAt:        row.accepted_at,
      deliveredAt:       row.delivered_at,
      createdAt:         row.created_at,
      subtotal_compra:   row.subtotal_compra || 0,
      updatedAt:         row.updated_at,
      cancelReason:      row.cancel_reason,
      cancelledBy:       row.cancelled_by,
      // Joined fields
      clientIsVerified:  row.client?.is_verified || row.client?.verification_status === 'verified',
      clientPhoto:       row.client?.profile_photo_url,
      driverIsVerified:  row.driver?.is_verified || row.driver?.verification_status === 'verified',
    };
  }

  _toDB(obj) {
    const r = {};
    if (obj.id !== undefined)               r.id                  = obj.id;
    if (obj.clientId !== undefined)         r.client_id           = obj.clientId;
    if (obj.clientName !== undefined)       r.client_name         = obj.clientName;
    if (obj.clientPhone !== undefined)      r.client_phone        = obj.clientPhone;
    if (obj.driverId !== undefined)         r.driver_id           = obj.driverId;
    if (obj.driverName !== undefined)       r.driver_name         = obj.driverName;
    if (obj.driverPhoto !== undefined)      r.driver_photo        = obj.driverPhoto;
    if (obj.driverLocation !== undefined)   r.driver_location     = obj.driverLocation;
    if (obj.status !== undefined)           r.status              = obj.status;
    if (obj.description !== undefined)      r.description         = obj.description;
    if (obj.pickupAddress !== undefined)    r.pickup_address      = obj.pickupAddress;
    if (obj.deliveryAddress !== undefined)  r.delivery_address    = obj.deliveryAddress;
    if (obj.pickupCoords !== undefined)     r.pickup_coords       = obj.pickupCoords;
    if (obj.deliveryCoords !== undefined)   r.delivery_coords     = obj.deliveryCoords;
    if (obj.paymentMethod !== undefined)    r.payment_method      = obj.paymentMethod;
    if (obj.estimatedPriceMin !== undefined)r.estimated_price_min = obj.estimatedPriceMin;
    if (obj.estimatedPriceMax !== undefined)r.estimated_price_max = obj.estimatedPriceMax;
    if (obj.routeDistanceText !== undefined)r.route_distance_text = obj.routeDistanceText;
    if (obj.specialServices !== undefined)  r.special_services    = obj.specialServices;
    if (obj.stops !== undefined)            r.stops               = obj.stops;
    if (obj.stopDescription !== undefined)  r.stop_description    = obj.stopDescription;
    if (obj.acceptedAt !== undefined)       r.accepted_at         = obj.acceptedAt;
    if (obj.deliveredAt !== undefined)      r.delivered_at        = obj.deliveredAt;
    if (obj.cancelReason !== undefined)     r.cancel_reason       = obj.cancelReason;
    if (obj.cancelledBy !== undefined)      r.cancelled_by        = obj.cancelledBy;
    if (obj.acceptedAt !== undefined)       r.accepted_at         = obj.acceptedAt;
    if (obj.subtotal_compra !== undefined)  r.subtotal_compra     = obj.subtotal_compra;
    return r;
  }

  _resolveProfileId(explicitId = null) {
    if (explicitId) {
      if (this._currentUser?.user_id && explicitId === this._currentUser.user_id && this._currentUser.id) {
        return this._currentUser.id;
      }
      return explicitId;
    }
    return this._currentUser?.id || null;
  }

  _cacheOrder(order) {
    if (!order || !order.id) return;
    const orders = this._fb_getOrders();
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx === -1) orders.push(order);
    else orders[idx] = { ...orders[idx], ...order };
    this._fb_save(orders);
  }

  _getCachedOrderById(id) {
    return this._fb_getOrders().find(o => o.id === id) || null;
  }

  _mergeOrderWithFallback(primaryOrder, fallbackOrder) {
    if (!primaryOrder) return fallbackOrder || null;
    if (!fallbackOrder) return primaryOrder;

    const merged = { ...fallbackOrder, ...primaryOrder };

    Object.keys(fallbackOrder).forEach(key => {
      if (merged[key] === null || merged[key] === undefined || merged[key] === '') {
        merged[key] = fallbackOrder[key];
      }
    });

    return merged;
  }

  // ══════════════════════════════════════════════════════════════
  // USERS — Autenticación con Supabase Auth
  // ══════════════════════════════════════════════════════════════

  /**
   * Registrar usuario con Supabase Auth
   * Usa MotoClickAuth.signUp() que crea cuenta en auth.users
   * El trigger _mc_on_signup crea automáticamente el perfil en public.users
   */
  async registerUser(userData) {
    // Si tenemos Auth, usar el flujo de Supabase Auth
    if (this._auth && typeof this._auth.signUp === 'function') {
      const result = await this._auth.signUp({
        phone: userData.phone,
        pin: userData.pin || userData.phone.slice(-4),
        name: userData.name,
        role: userData.role || 'client',
        extra: {
          address: userData.address,
          vehicle: userData.vehicle,
          photo: userData.photo || userData.profile_photo_url
        }
      });

      if (!result.success) return result;

      // El perfil ya se creó por el trigger y se guardó en localStorage
      this._currentUser = this._auth.getCurrentUser();
      return { success: true, user: this._currentUser };
    }

    // Fallback legacy: registro directo en DB (sin auth)
    return this._fb_registerUser(userData);
  }

  /**
   * Iniciar sesión con Supabase Auth
   * Usa MotoClickAuth.signIn() que maneja sesiones JWT
   */
  async loginUser(phone, role, pin) {
    // Si tenemos Auth, intentar flujo de Supabase Auth
    if (this._auth && typeof this._auth.signIn === 'function') {
      const result = await this._auth.signIn(phone, pin || phone.slice(-4));
      console.debug('[Store] auth.signIn result:', result);
      
      // Si el login fue exitoso, verificar integridad del ROL en la base de datos
      if (result.success) {
        // Intento seguro de obtener el perfil desde public.users con reintentos.
        // No cerrar sesión inmediatamente si la consulta falla por problemas transitorios (p. ej. 406, tiempo de propagación).
        const uid = result.user && result.user.id;
        let profile = null;
        let profileErr = null;

        for (let attempt = 0; attempt < 6; attempt++) {
          try {
            const res = await this._sb.from('users').select('role, phone').eq('user_id', uid).maybeSingle();
            profile = res.data;
            profileErr = res.error;
            if (profile) break;
          } catch (e) {
            profileErr = e;
          }
          // Espera incremental antes de reintentar
          await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
        }

        if (profileErr) console.debug('[Store] profile fetch error after retries:', profileErr);

        if (!profile) {
          // Si no existe perfil, cerrar sesión para seguridad
          await this._auth.signOut();
          return { success: false, error: 'Error al verificar perfil de seguridad.' };
        }

        if (role && profile.role !== role) {
          console.error(`[Security] Intento de acceso con rol incorrecto. DB: ${profile.role}, Esperado: ${role}`);
          await this._auth.signOut();
          return { success: false, error: 'Acceso denegado: Esta cuenta no tiene permisos para este portal.' };
        }

        this._currentUser = { ...result.user, ...profile };
        this.setCurrentUser(this._currentUser);
        return { success: true, user: this._currentUser };
      }

      // 🛡️ AUTO-MIGRACIÓN: Si falla porque el usuario no existe en Auth, pero sí en DB
      console.log('[Store] Auth falló, intentando login legacy para migración...');
      const legacyResult = await this._fb_loginUser(phone, role, pin);
      console.debug('[Store] legacy login result:', legacyResult);
      
      if (legacyResult.success) {
        console.log('[Store] Usuario legacy detectado. Migrando a Supabase Auth...');
        // Registrar al usuario en Auth de forma transparente
        const signUpResult = await this._auth.signUp({
          phone: phone,
          pin: pin || phone.slice(-4),
          name: legacyResult.user.name,
          role: role,
          extra: {
            address: legacyResult.user.address,
            vehicle: legacyResult.user.vehicle
          }
        });

        console.debug('[Store] auth.signUp (migration) result:', signUpResult);

        if (signUpResult.success) {
          showToast('Cuenta actualizada al nuevo sistema de seguridad 🛡️', 'success');
          this._currentUser = signUpResult.user;
          return { success: true, user: this._currentUser };
        } else {
          console.warn('[Store] Falló migración a Auth:', signUpResult);
        }
      }

      return result; // Devolver el error original de Auth si la migración no aplica
    }

    // Fallback legacy total (si Auth no está cargado)
    return this._fb_loginUser(phone, role, pin);
  }

  /**
   * Fallback legacy — registro directo en DB
   */
  async _fb_registerUser(userData) {
    const payload = {
      name: userData.name,
      phone: userData.phone,
      role: userData.role
    };

    const extendedPayload = { ...payload };
    if (userData.pin) extendedPayload.pin = userData.pin;
    if (userData.address) extendedPayload.address = userData.address;
    if (userData.vehicle) extendedPayload.vehicle = userData.vehicle;
    if (userData.photo || userData.profile_photo_url) {
      extendedPayload.profile_photo_url = userData.photo || userData.profile_photo_url;
    }

    let { data, error } = await this._sb.from('users').insert([extendedPayload]).select().single();

    if (error && (error.code === 'PGRST105' || error.message.includes('column'))) {
      console.warn('[Store] Registro: Reintentando con esquema simplificado.');
      const retry = await this._sb.from('users').insert([payload]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      const msg = error.code === '23505' ? 'Ya existe una cuenta con ese teléfono.' : (error.message || 'Error al registrar.');
      return { success: false, error: msg };
    }
    this.setCurrentUser(data);
    return { success: true, user: data };
  }

  /**
   * Fallback legacy — login directo por DB
   */
  async _fb_loginUser(phone, role, pin) {
    // Normalizar teléfono a 10 dígitos (eliminando prefijos de país como 52)
    const normalize = p => (p || '').toString().replace(/\D/g, '').replace(/^52/, '').slice(-10);
    const normPhone = normalize(phone);

    console.debug('[Store][_fb_loginUser] buscar teléfono:', { original: phone, normalized: normPhone, role });

    // Intentar buscar en la tabla users con varias estrategias para tolerancia de formatos
    let res = await this._sb.from('users').select('*').eq('phone', normPhone).eq('role', role).maybeSingle();
    console.debug('[Store][_fb_loginUser] query1 result:', res);
    if (!res || !res.data) {
      // intentar sin role (por si el usuario fue registrado con otro rol por error)
      res = await this._sb.from('users').select('*').eq('phone', normPhone).maybeSingle();
      console.debug('[Store][_fb_loginUser] query2 (sin role) result:', res);
    }

    if ((!res || !res.data) && normPhone) {
      // intentar búsqueda parcial (número que termina con los últimos 10 dígitos)
      try {
        res = await this._sb.from('users').select('*').ilike('phone', `%${normPhone}`).maybeSingle();
        console.debug('[Store][_fb_loginUser] query3 (ilike) result:', res);
      } catch (e) {
        // Algunos esquemas o versiones de PostgREST no soportan ilike en columnas no text
        console.warn('[Store][_fb_loginUser] ilike fallo:', e.message || e);
        res = res || { data: null, error: null };
      }
    }

    if (!res || !res.data) return { success: false, error: 'No se encontró una cuenta con ese teléfono.' };

    const data = res.data;

    console.debug('[Store][_fb_loginUser] usuario encontrado:', data);

    // Validación de rol: si se especificó rol y no coincide, denegar acceso
    if (role && data.role && data.role !== role) {
      return { success: false, error: 'Acceso denegado: Esta cuenta no tiene permisos para este portal.' };
    }

    // Validar PIN (soporta PIN almacenado o por defecto últimos 4 dígitos)
    if (pin) {
      const expectedPin = data.pin || normPhone.slice(-4);
      if (pin !== expectedPin) {
        return { success: false, error: 'Contraseña o PIN incorrecto. Intente de nuevo.' };
      }
    }

    this.setCurrentUser(data);
    return { success: true, user: data };
  }

  async getAllUsers() {
    if (this._useFallback) return JSON.parse(localStorage.getItem('motoclick_users') || '[]');
    const { data } = await this._sb.from('users').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  async getUserById(id) {
    if (this._useFallback) {
      const users = JSON.parse(localStorage.getItem('motoclick_users') || '[]');
      return users.find(u => u.id === id) || null;
    }
    const { data, error } = await this._sb.from('users').select('*').eq('id', id).maybeSingle();
    if (error) console.error('[Store] getUserById Error:', error);
    return data;
  }

  async getUserByPhone(phone, role) {
    if (this._useFallback) {
      const users = JSON.parse(localStorage.getItem('motoclick_users') || '[]');
      return users.find(u => u.phone === phone && u.role === role) || null;
    }
    const { data, error } = await this._sb.from('users').select('*').eq('phone', phone).eq('role', role).maybeSingle();
    return data;
  }

  async updateUser(id, updates) {
    if (this._useFallback) return this._fb_updateUser(id, updates);
    const { data, error } = await this._sb.from('users')
      .update(updates).eq('id', id).select().single();
    if (error) return { success: false, error: error.message };
    this.setCurrentUser(data);
    return { success: true, user: data };
  }

  setCurrentUser(user) {
    this._currentUser = user;
    if (user) {
      localStorage.setItem('motoclick_current_user', JSON.stringify(user));
      if (!this._useFallback) this._initPresence();
    } else {
      // Al borrar el usuario, eliminar la clave — no escribir "null"
      localStorage.removeItem('motoclick_current_user');
    }
  }

  getCurrentUser() { return this._currentUser; }

  /**
   * Cerrar sesión — usa Supabase Auth si está disponible
   */
  async logout() {
    try {
      if (this._auth && typeof this._auth.signOut === 'function') {
        await this._auth.signOut();
      } else if (this._sb?.auth) {
        await this._sb.auth.signOut({ scope: 'global' });
      }
    } catch(e) {
      console.warn('[Store] Error during signOut, clearing locally anyway:', e);
    }
    this._currentUser = null;
    // Nuking ALL Supabase and app tokens from the browser
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.startsWith('motoclick_')) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.clear();
  }

  // ══════════════════════════════════════════════════════════════
  // SOCIAL LOGIN — Google
  // ══════════════════════════════════════════════════════════════

  /**
   * Iniciar sesión con Google
   * Redirige al usuario a Google OAuth. Al regresar, se procesa la sesión.
   * @param {string} role - 'client' | 'driver'
   */
  async loginWithGoogle(role = 'client') {
    // Garantizar que Auth esté listo
    if (!this._auth && typeof MotoClickAuth !== 'undefined' && this._sb) {
      this._auth = new MotoClickAuth(this._sb);
    }
    
    if (this._auth && typeof this._auth.signInWithGoogle === 'function') {
      return await this._auth.signInWithGoogle(role);
    }
    console.error('[Store] Google Auth falló: _auth no disponible');
    return { success: false, error: 'Google Auth no disponible en este momento' };
  }

  // ══════════════════════════════════════════════════════════════
  // SOCIAL LOGIN — Facebook
  // ══════════════════════════════════════════════════════════════

  /**
   * Iniciar sesión con Facebook
   * Redirige al usuario a Facebook OAuth. Al regresar, se procesa la sesión.
   * @param {string} role - 'client' | 'driver'
   */
  async loginWithFacebook(role = 'client') {
    // Garantizar que Auth esté listo
    if (!this._auth && typeof MotoClickAuth !== 'undefined' && this._sb) {
      this._auth = new MotoClickAuth(this._sb);
    }

    if (this._auth && typeof this._auth.signInWithFacebook === 'function') {
      return await this._auth.signInWithFacebook(role);
    }
    console.error('[Store] Facebook Auth falló: _auth no disponible');
    return { success: false, error: 'Facebook Auth no disponible en este momento' };
  }

  // ══════════════════════════════════════════════════════════════
  // OAUTH POST-REDIRECT — Completar perfil al volver de OAuth
  // ══════════════════════════════════════════════════════════════

  /**
   * Se llama en las páginas de destino después de OAuth redirect
   * para asegurar que el perfil del usuario está completo.
   * Verifica si necesita ingresar teléfono.
   */
  async handleOAuthCallback(role = 'client') {
    if (this._auth) {
      if (typeof this._auth.checkOAuthProfileComplete === 'function') {
        return await this._auth.checkOAuthProfileComplete(role);
      }
      if (typeof this._auth.completeOAuthProfile === 'function') {
        const session = await this._sb?.auth?.getSession();
        if (session?.data?.session?.user) {
          return await this._auth.completeOAuthProfile(session.data.session.user, role);
        }
      }
    }
    return null;
  }

  /**
   * Guardar teléfono para usuario que vino de OAuth
   */
  async saveOAuthPhone(phone) {
    if (this._auth && typeof this._auth.saveOAuthPhone === 'function') {
      return await this._auth.saveOAuthPhone(phone);
    }
    return { success: false, error: 'Auth no disponible' };
  }

  // ══════════════════════════════════════════════════════════════
  // ORDERS
  // ══════════════════════════════════════════════════════════════
  async getOrders() {
    if (this._useFallback) {
      return this._fb_getOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    const { data, error } = await this._sb.from('orders').select('*').order('created_at', { ascending: false });
    if (error) console.error('[Store] getOrders Error:', error);
    return (data || []).map(r => this._fromDB(r));
  }

  async getOrderById(id) {
    if (this._useFallback) {
      return this._fb_getOrders().find(o => o.id === id) || null;
    }
    const cachedOrder = this._getCachedOrderById(id);
    let { data, error } = await this._sb.from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    // Si falla por RLS o la consulta devuelve null, intentar RPC legacy_get_order_text primero, luego legacy_get_order
    if ((error && (error.code === '42501' || (error.message && error.message.toLowerCase().includes('row-level security')))) || (!error && !data)) {
      try {
        console.warn('[Store] getOrderById: select failed or returned null, trying legacy_get_order_text RPC first');
        // Intentar la versión text (desambiguación de sobrecarga)
        let rpcResult = await this._sb.rpc('legacy_get_order_text', { p_order_id: id }).then(r => r).catch(e => ({ data: null, error: e }));
        console.debug('[Store] legacy_get_order_text rpc result:', rpcResult.data, rpcResult.error);
        if (rpcResult && !rpcResult.error && rpcResult.data) {
          const record = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
          const order = this._mergeOrderWithFallback(this._fromDB(record), cachedOrder);
          this._cacheOrder(order);
          return order;
        }

        // Si falla, probar la RPC original por compatibilidad
        console.warn('[Store] getOrderById: legacy_get_order_text failed, trying legacy_get_order RPC');
        const { data: rpcData, error: rpcErr } = await this._sb.rpc('legacy_get_order', { p_order_id: id }).then(r => r).catch(e => ({ data: null, error: e }));
        console.debug('[Store] legacy_get_order rpc result:', rpcData, rpcErr);
        if (!rpcErr && rpcData) {
          const record = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          const order = this._mergeOrderWithFallback(this._fromDB(record), cachedOrder);
          this._cacheOrder(order);
          return order;
        }
      } catch (e) {
        console.error('[Store] legacy_get_order exception:', e);
      }
    }

    if (error) console.error('[Store] getOrderById Error:', error);
    const order = this._mergeOrderWithFallback(this._fromDB(data), cachedOrder);
    if (order) {
      this._cacheOrder(order);
      return order;
    }
    return cachedOrder;
  }

  async getOrdersByClient(clientId) {
    if (this._useFallback) {
      return this._fb_getOrders()
        .filter(o => o.clientId === clientId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    const resolvedClientId = this._resolveProfileId(clientId);
    const { data, error } = await this._sb.from('orders').select('*').eq('client_id', resolvedClientId).order('created_at', { ascending: false });
    if (error) console.error('[Store] getOrdersByClient Error:', error);
    return (data || []).map(r => this._fromDB(r));
  }

  async getOrdersByDriver(driverId) {
    if (this._useFallback) {
      return this._fb_getOrders()
        .filter(o => o.driverId === driverId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    const resolvedDriverId = this._resolveProfileId(driverId);
    const { data, error } = await this._sb.from('orders').select('*').eq('driver_id', resolvedDriverId).order('created_at', { ascending: false });
    if (error) console.error('[Store] getOrdersByDriver Error:', error);
    return (data || []).map(r => this._fromDB(r));
  }

  async getTicketDetails(orderId) {
    if (this._useFallback) return [];
    const { data, error } = await this._sb.from('ticket_detalle')
      .select('*')
      .eq('id_orden', orderId)
      .order('creado_en', { ascending: true });
    if (error) { console.error('[Store] getTicketDetails Error:', error); return []; }
    return data || [];
  }

  async getPendingOrders() {
    if (this._useFallback) return this._fb_getOrders().filter(o => o.status === 'pending');
    let { data, error } = await this._sb.from('orders').select('*').eq('status', 'pending').order('created_at', { ascending: true });

    // Fallback defensivo: algunos cambios de RLS/esquema dejan la consulta filtrada vacía aunque el SELECT base sí responde.
    if (error || !(data || []).length) {
      try {
        const retry = await this._sb.from('orders').select('*').order('created_at', { ascending: true });
        if (!retry.error && Array.isArray(retry.data)) {
          data = retry.data.filter(row => row.status === 'pending');
          error = null;
        } else if (retry.error) {
          error = retry.error;
        }
      } catch (e) {
        error = e;
      }
    }

    if (error) console.error('[Store] getPendingOrders Error:', error);
    return (data || []).map(r => this._fromDB(r));
  }

  async getActiveOrderForDriver(driverId) {
    if (this._useFallback) {
      return this._fb_getOrders().find(o => o.driverId === driverId && !['pending','entregado','cancelado'].includes(o.status)) || null;
    }
    const resolvedDriverId = this._resolveProfileId(driverId);
    const { data, error } = await this._sb.from('orders').select('*')
      .eq('driver_id', resolvedDriverId)
      .not('status', 'in', '("pending","entregado","cancelado")')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) console.error('[Store] getActiveOrder Error:', error);
    return data && data.length > 0 ? this._fromDB(data[0]) : null;
  }

  async createOrder(orderData) {
    if (this._useFallback) return this._fb_createOrder(orderData);
    const id = 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

    // Asegurar que el clientId esté presente
    const finalOrderData = { ...orderData };
    finalOrderData.clientId = this._resolveProfileId(finalOrderData.clientId);
    const optimisticOrder = {
      id,
      ...finalOrderData,
      status: 'pending',
      driverId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this._cacheOrder(optimisticOrder);

    const row = this._toDB({ id, ...finalOrderData, status: 'pending', driverId: null });
    
    // Especificar columnas en select() y añadir logging detallado para diagnosticar fallas del servidor
    let { data, error } = await this._sb.from('orders').insert([row]).select('*').single();
    
    // Si falla por columnas nuevas (client_name, client_phone), intentamos sin ellas
    if (error && (error.code === 'PGRST105' || error.code === 'PGRST204' || (error.message && error.message.includes('column')))) {
      console.warn('[Store] createOrder: Reintentando sin columnas extendidas (Caché de esquema detectada)');
      const fallbackRow = { ...row };
      delete fallbackRow.client_name;
      delete fallbackRow.client_phone;
      const retry = await this._sb.from('orders').insert([fallbackRow]).select('*').single();
      data = retry.data;
      error = retry.error;
    }

    // Si falla por RLS (42501) o status 403, intentar la RPC legacy_create_order (SECURITY DEFINER)
    if (error && (error.code === '42501' || (error.message && error.message.toLowerCase().includes('row-level security')) || error.status === 403)) {
      console.warn('[Store] createOrder: RLS prevented insert, attempting legacy_create_order RPC');
      try {
        const { data: rpcData, error: rpcErr } = await this._sb.rpc('legacy_create_order', { p_order: row }).then(r => r).catch(e => ({ data: null, error: e }));
        console.debug('[Store] legacy_create_order rpc result:', rpcData, rpcErr);
        if (!rpcErr && rpcData) {
          const record = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          const order = this._mergeOrderWithFallback(this._fromDB(record), optimisticOrder);
          this._cacheOrder(order);
          return order;
        } else {
          console.error('[Store] legacy_create_order rpc error:', rpcErr);
        }
      } catch (e) {
        console.error('[Store] legacy_create_order exception:', e);
      }
    }

    if (error) {
      // Log completo para facilitar diagnóstico desde consola del cliente
      try {
        console.error('[Store] createOrder Final Error:', JSON.parse(JSON.stringify(error)));
      } catch (e) {
        console.error('[Store] createOrder Final Error (raw):', error);
      }
      if (error.details) console.error('[Store] createOrder error details:', error.details);
      if (error.hint) console.error('[Store] createOrder hint:', error.hint);
      if (error.status) console.error('[Store] createOrder http status:', error.status);
      return null;
    }
    const order = this._mergeOrderWithFallback(this._fromDB(data), optimisticOrder);
    this._cacheOrder(order);
    return order;
  }

  async acceptOrder(orderId, driver) {
    if (this._useFallback) return this._fb_acceptOrder(orderId, driver);
    const { data, error } = await this._sb.from('orders').update({
      status: 'accepted',
      driver_id: driver.id,
      driver_name: driver.name,
      driver_photo: driver.profile_photo_url || driver.photo || null,
      accepted_at: new Date().toISOString(),
    }).eq('id', orderId).select().single();
    if (error) return null;
    const order = this._fromDB(data);
    this._cacheOrder(order);
    return order;
  }

  async updateOrderStatus(orderId, status) {
    if (this._useFallback) return this._fb_updateOrderStatus(orderId, status);
    const upd = { status };
    if (status === 'entregado') upd.delivered_at = new Date().toISOString();
    
    let { data, error } = await this._sb.from('orders').update(upd).eq('id', orderId).select().single();
    
    // Si falla por falta de columna de delivered_at (PGRST204), reintentar sin guardarla
    if (error && (error.code === 'PGRST105' || error.code === 'PGRST204' || error.message?.includes('column'))) {
      console.warn('[Store] updateOrderStatus: Esquema desactualizado. Reintentando solo con estado.');
      const fallbackPayload = { status };
      const retry = await this._sb.from('orders').update(fallbackPayload).eq('id', orderId).select().single();
      data = retry.data;
      error = retry.error;
    }
    
    if (error) {
      console.error('[Store] Error al actualizar estado:', error);
      return null;
    }
    const order = this._fromDB(data);
    this._cacheOrder(order);
    return order;
  }

  async updateOrder(orderId, updates) {
    if (this._useFallback) return this._fb_updateOrder(orderId, updates);
    
    let { data, error } = await this._sb.from('orders')
      .update(this._toDB(updates))
      .eq('id', orderId)
      .select()
      .single();
    
    // Si falla por columnas nuevas (ej. subtotal_compra, delivered_at), intentar limpiar y reintentar
    if (error && (error.code === 'PGRST105' || error.code === 'PGRST204' || error.message?.includes('column'))) {
      console.warn('[Store] updateOrder: Reintentando con payload mínimo por error de esquema.');
      const minimalPayload = { status: updates.status };
      const retry = await this._sb.from('orders')
        .update(minimalPayload)
        .eq('id', orderId)
        .select()
        .single();
      
      data = retry.data;
      error = retry.error;
    }
    
    if (error) {
      console.error('[Store] updateOrder Final Error:', error);
      return null;
    }
    const order = this._fromDB(data);
    this._cacheOrder(order);
    return order;
  }

  async updateDriverLocation(orderId, location) {
    if (this._useFallback) return this._fb_updateDriverLocation(orderId, location);
    await this._sb.from('orders').update({ driver_location: location }).eq('id', orderId);
    const cachedOrder = this._getCachedOrderById(orderId);
    if (cachedOrder) this._cacheOrder({ ...cachedOrder, driverLocation: location });
  }

  async deleteOrder(orderId) {
    if (this._useFallback) return this._fb_deleteOrder(orderId);
    const { error } = await this._sb.from('orders').delete().eq('id', orderId);
    if (error) { console.error('[Store] deleteOrder:', error); return false; }
    return true;
  }

  async createCompletedOrder(orderData) {
    if (this._useFallback) return this._fb_createCompletedOrder(orderData);
    const id = 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    const row = this._toDB({ id, ...orderData, status: 'entregado' });
    const { data, error } = await this._sb.from('orders').insert([row]).select().single();
    if (error) { console.error('[Store] createCompletedOrder:', error); return null; }
    return this._fromDB(data);
  }

  async cancelOrder(orderId, reason, by) {
    if (this._useFallback) {
       const orders = this._fb_getOrders();
       const idx = orders.findIndex(o => o.id === orderId);
       if (idx !== -1) {
          orders[idx].status = 'cancelado';
          orders[idx].cancelReason = reason;
          orders[idx].cancelledBy = by;
          this._fb_save(orders);
          this._emit('status_change', orders[idx]);
          return orders[idx];
       }
       return null;
    }
    const { data, error } = await this._sb.from('orders').update({
       status: 'cancelado',
       cancel_reason: reason,
       cancelled_by: by
    }).eq('id', orderId).select().single();

    if (error) { 
       console.error('[Store] cancelOrder CRITICAL ERROR:', error); 
       // Mostramos el error exacto para diagnóstico
       if (error.message) console.warn('Supabase dice:', error.message);
       return null; 
    }
    return this._fromDB(data);
  }

  // ══════════════════════════════════════════════════════════════
  // FALLBACK localStorage
  // ══════════════════════════════════════════════════════════════
  _fb_getOrders() {
    try { return JSON.parse(localStorage.getItem('motoclick_orders')) || []; } catch { return []; }
  }
  _fb_save(orders) { localStorage.setItem('motoclick_orders', JSON.stringify(orders)); }

  _fb_createOrder(d) {
    const orders = this._fb_getOrders();
    const order = { id: 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2,8), ...d, status: 'pending', driverId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    orders.push(order); this._fb_save(orders);
    this._broadcast('new_order', order); this._emit('new_order', order);
    return order;
  }
  _fb_acceptOrder(orderId, driver) {
    const orders = this._fb_getOrders();
    const idx = orders.findIndex(o => o.id === orderId); if (idx === -1) return null;
    Object.assign(orders[idx], { status: 'accepted', driverId: driver.id, driverName: driver.name, driverPhoto: driver.photo || null, acceptedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    this._fb_save(orders); this._broadcast('order_accepted', orders[idx]); this._emit('order_accepted', orders[idx]);
    return orders[idx];
  }
  _fb_updateOrderStatus(orderId, status) {
    const orders = this._fb_getOrders();
    const idx = orders.findIndex(o => o.id === orderId); if (idx === -1) return null;
    orders[idx].status = status; orders[idx].updatedAt = new Date().toISOString();
    if (status === 'entregado') orders[idx].deliveredAt = new Date().toISOString();
    this._fb_save(orders); this._broadcast('status_change', orders[idx]); this._emit('status_change', orders[idx]);
    return orders[idx];
  }
  _fb_updateOrder(orderId, updates) {
    const orders = this._fb_getOrders();
    const idx = orders.findIndex(o => o.id === orderId); if (idx === -1) return null;
    orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
    this._fb_save(orders); this._broadcast('order_updated', orders[idx]); this._emit('order_updated', orders[idx]);
    return orders[idx];
  }
  _fb_updateDriverLocation(orderId, location) {
    const orders = this._fb_getOrders();
    const idx = orders.findIndex(o => o.id === orderId); if (idx === -1) return;
    orders[idx].driverLocation = location; this._fb_save(orders);
    this._broadcast('location_update', { orderId, location }); this._emit('location_update', { orderId, location });
  }
  _fb_deleteOrder(orderId) {
    let orders = this._fb_getOrders();
    const initLen = orders.length;
    orders = orders.filter(o => o.id !== orderId);
    this._fb_save(orders);
    return orders.length !== initLen;
  }
  _fb_createCompletedOrder(d) {
    const orders = this._fb_getOrders();
    const order = { id: 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2,8), ...d, status: 'entregado', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (!order.acceptedAt) order.acceptedAt = order.createdAt;
    if (!order.deliveredAt) order.deliveredAt = order.createdAt;
    orders.push(order); this._fb_save(orders);
    return order;
  }
  _fb_registerUser(d) {
    const users = JSON.parse(localStorage.getItem('motoclick_users') || '[]');
    if (users.find(u => u.phone === d.phone && u.role === d.role)) return { success: false, error: 'Ya existe una cuenta con ese teléfono.' };
    const user = { id: 'u_' + Date.now().toString(36), ...d, createdAt: new Date().toISOString() };
    users.push(user); localStorage.setItem('motoclick_users', JSON.stringify(users));
    this.setCurrentUser(user); return { success: true, user };
  }
  _fb_loginUser(phone, role, pin) {
    const users = JSON.parse(localStorage.getItem('motoclick_users') || '[]');
    const user = users.find(u => u.phone === phone && u.role === role);
    if (!user) return { success: false, error: 'No se encontró una cuenta con ese teléfono.' };
    
    if (pin) {
      const expectedPin = user.pin || phone.slice(-4);
      if (pin !== expectedPin) {
        return { success: false, error: 'Contraseña o PIN incorrecto. Intente de nuevo.' };
      }
    }
    
    this.setCurrentUser(user); return { success: true, user };
  }
  _fb_updateUser(id, data) {
    const users = JSON.parse(localStorage.getItem('motoclick_users') || '[]');
    const idx = users.findIndex(u => u.id === id); if (idx === -1) return { success: false, error: 'Usuario no encontrado.' };
    users[idx] = { ...users[idx], ...data }; localStorage.setItem('motoclick_users', JSON.stringify(users));
    const cur = this.getCurrentUser(); if (cur && cur.id === id) this.setCurrentUser(users[idx]);
    return { success: true, user: users[idx] };
  }

  // ── Cash Verification Dynamic System ──
  async verifyCashCode(code, currentUserId = null) {
    if (this._useFallback) return { success: code === "MOTO-EFEC-2026" };
    
    try {
      const { data, error } = await this._sb.from('cash_verification_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .eq('is_used', false);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        const codeData = data[0];
        
        // 🛡️ SECURITY: Verify if code is assigned to THIS user
        if (codeData.client_id && currentUserId && codeData.client_id !== currentUserId) {
           return { success: false, message: 'Este código no está asignado a tu cuenta.' };
        }

        return { success: true, codeData: codeData };
      }
      return { success: false, message: 'Código inválido o ya utilizado' };
    } catch (err) {
      console.error('[Store] verifyCashCode Error:', err);
      return { success: false, message: 'Error de servidor' };
    }
  }

  async markCashCodeUsed(codeId) {
    if (this._useFallback) return true;
    const { error } = await this._sb.from('cash_verification_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', codeId);
    return !error;
  }

  async generateCashCode(code, adminName, expiresHours = 24) {
    if (this._useFallback) return { success: true };
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresHours);
    
    const { data, error } = await this._sb.from('cash_verification_codes').insert({
      code: code.toUpperCase(),
      generated_by: adminName,
      expires_at: expiresAt.toISOString()
    }).select();
    
    return { data, error };
  }

  // ── Admin Panel Methods ──
  async getAllUsers() {
    if (this._useFallback) {
      return JSON.parse(localStorage.getItem('motoclick_users') || '[]');
    }
    const { data, error } = await this._sb.from('users').select('*').order('created_at', { ascending: false });
    if (error) console.error('[Store] getAllUsers:', error);
    
    // --- OPTIMISTIC UI MERGE (Bypass RLS local limitations) ---
    let users = data || [];
    try {
      const deletedIds = JSON.parse(localStorage.getItem('mc_admin_deleted_ids') || '[]');
      const updatedDocs = JSON.parse(localStorage.getItem('mc_admin_updates') || '{}');
      
      // Remove deleted
      users = users.filter(u => !deletedIds.includes(u.id));
      
      // Override updated
      users = users.map(u => {
         if (updatedDocs[u.id]) return { ...u, ...updatedDocs[u.id] };
         return u;
      });
    } catch(e) {}
    
    return users;
  }

  async deleteUser(userId) {
    if (this._useFallback) {
      let users = JSON.parse(localStorage.getItem('motoclick_users') || '[]');
      users = users.filter(u => u.id !== userId);
      localStorage.setItem('motoclick_users', JSON.stringify(users));
      return { success: true };
    }
    
    // Attempt real suppression First
    const { error } = await this._sb.from('users').delete().eq('id', userId);
    
    if (error) {
       console.warn('[DB Integrity/RLS] Backend rechaza borrado físico:', error.message);
       // Soft Delete Strategy Fallback
       await this.updateUser(userId, { role: 'eliminado', pin: '0000', name: 'Usuario Suspendido' }).catch(() => {});
    }
    
    // Normal Force Frontend Cache Removal (Optimistic Bypass)
    // ESTO SIEMPRE DEBE SUCEDER SIN IMPORTAR EL BACKEND
    const deletedIds = JSON.parse(localStorage.getItem('mc_admin_deleted_ids') || '[]');
    if (!deletedIds.includes(userId)) deletedIds.push(userId);
    localStorage.setItem('mc_admin_deleted_ids', JSON.stringify(deletedIds));
    
    return { success: true };
  }

  async updateUser(userId, data_payload) {
    if (this._useFallback) return this._fb_updateUser(userId, data_payload);
    
    // 🛡️ Saneamiento: Mapear nombres de columnas frontend -> backend si es necesario
    const cleanPayload = { ...data_payload };
    if (cleanPayload.photo) {
      cleanPayload.profile_photo_url = cleanPayload.photo;
      delete cleanPayload.photo;
    }
    
    // Attempt real DB write
    const { data, error } = await this._sb.from('users').update(cleanPayload).eq('id', userId).select().single();
    
    if (!error) {
      this.setCurrentUser(data);
    }

    // Force Frontend Overrides (Optimistic Bypass)
    const updatedDocs = JSON.parse(localStorage.getItem('mc_admin_updates') || '{}');
    updatedDocs[userId] = { ...(updatedDocs[userId] || {}), ...cleanPayload };
    localStorage.setItem('mc_admin_updates', JSON.stringify(updatedDocs));

    // 🔄 Sincronizar usuario actual si es él mismo
    const cur = this.getCurrentUser();
    if (cur && cur.id === userId && !error) {
       this.setCurrentUser({ ...cur, ...cleanPayload, ...data });
    }
    
    return { success: !error, user: data, error: error?.message };
  }

  async getDashboardStats() {
    if (this._useFallback) return { totalUsers: 0, pendingVerifications: 0 };
    const [{ count: totalUsers }, pendingResp] = await Promise.all([
      this._sb.from('users').select('*', { count: 'exact', head: true }),
      this.getPendingVerifications()
    ]);
    return {
      totalUsers: totalUsers || 0,
      pendingVerifications: pendingResp.data?.length || 0
    };
  }

  async sendNotification(userId, message) {
    if (this._useFallback) {
      this._broadcast('notification', { userId, message });
      return { success: true };
    }
    // We emit via realtime, clients should listen to 'notification'
    await this._sb.channel('orders-rt').send({
      type: 'broadcast',
      event: 'admin_notification',
      payload: { userId, message }
    });
    return { success: true };
  }

  async sendGlobalNotification(message) {
    return this.sendNotification('all', message);
  }

  async deleteSecurityCode(id) {
    if (this._useFallback) return { success: true };
    const { error } = await this._sb.from('cash_verification_codes').delete().eq('id', id);
    return { success: !error, error };
  }

  async saveSecurityCode(code, clientName, clientId = null) {
    if (this._useFallback) return { success: true };
    const payload = {
      code: code,
      client_name: clientName,
      generated_by: 'Admin Central',
      is_active: true
    };
    
    // Solo enviar client_id si realmente existe para evitar error 400 de llave foránea
    if (clientId && clientId.trim()) payload.client_id = clientId;

    const { error } = await this._sb.from('cash_verification_codes').insert(payload);
    return { success: !error, error };
  }

  // ── Existing Cash Code Methods ──
  async getAllCashCodes() {
    if (this._useFallback) return [];
    const { data } = await this._sb.from('cash_verification_codes')
      .select('*')
      .order('created_at', { ascending: false });
    return data || [];
  }

  // ── Storage Methods ──
  async uploadFile(bucket, path, file) {
    if (this._useFallback) return { publicUrl: 'https://placeholder-url.com/sim.jpg' };
    
    const { data, error } = await this._sb.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });

    if (error) return { error };

    const { data: { publicUrl } } = this._sb.storage.from(bucket).getPublicUrl(path);
    return { publicUrl };
  }

  // ── Verification System ──
  async submitVerificationRequest(userId, full_name, id_photo_url, profile_photo_url) {
    if (this._useFallback) return { success: true };
    const { error } = await this._sb.from('users').update({
      full_name,
      id_photo_url,
      profile_photo_url,
      verification_status: 'pending'
    }).eq('id', userId);
    return { success: !error, error };
  }

  async getPendingVerifications() {
    if (this._useFallback) return { data: [] };
    const { data, error } = await this._sb.from('users')
      .select('*')
      .eq('verification_status', 'pending');
    return { data, error };
  }

  async approveVerification(userId, isVerified = true, notes = '') {
    if (this._useFallback) return { success: true };
    const { error } = await this._sb.from('users').update({
      is_verified: isVerified,
      verification_status: isVerified ? 'verified' : 'rejected',
      verification_date: new Date().toISOString(),
      verification_notes: notes
    }).eq('id', userId);
    return { success: !error, error };
  }

  // ── Presence System ──
  _getDeviceInfo() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return { type: 'tablet', icon: 'fa-tablet-alt', color: '#a855f7' };
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return { type: 'mobile', icon: 'fa-mobile-alt', color: '#22c55e' };
    }
    return { type: 'desktop', icon: 'fa-desktop', color: '#3b82f6' };
  }

  async _initPresence() {
    if (this._useFallback || !this._sb || !this._currentUser) return;
    
    try {
      const device = this._getDeviceInfo();
      const channel = this._sb.channel('broadcaster');
      
      channel
        .on('presence', { event: 'sync' }, () => {
          // Sync logical state if needed
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              id: this._currentUser.id,
              name: this._currentUser.name,
              role: this._currentUser.role,
              device: device.type,
              deviceIcon: device.icon,
              deviceColor: device.color,
              online_at: new Date().toISOString(),
            });
          }
        });
    } catch (e) {
      console.warn('[Store] Presence error:', e);
    }
  }
}

function generateId() {
  return 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

window.MotoClickStore = window.MotoClickStore || new MotoClickStore();
window.store = window.MotoClickStore;
