/**
 * MotoClick — Store con Supabase
 * Las funciones que antes eran síncronas ahora son async/await.
 * Si Supabase no está configurado, usa localStorage como fallback.
 */

class MotoClickStore {
  constructor() {
    this._listeners = {};
    this._sb = null;
    this._useFallback = true;
    this._currentUser = null;
    this._init();
  }

  _init() {
    try {
      this._currentUser = JSON.parse(localStorage.getItem('motoclick_current_user'));
    } catch { this._currentUser = null; }

    if (typeof supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON !== 'undefined') {
      this._sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      this._useFallback = false;
      this._subscribeRealtime();
    } else {
      console.warn('[MotoClick] Supabase no disponible — usando localStorage.');
      this._useFallback = true;
      this._initBroadcast();
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
      driverPhoto:       row.driver_photo,
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
      updatedAt:         row.updated_at,
      cancelReason:      row.cancel_reason,
      cancelledBy:       row.cancelled_by,
      // Joined fields
      clientIsVerified:  row.client?.is_verified,
      clientPhoto:       row.client?.profile_photo_url,
      driverIsVerified:  row.driver?.is_verified,
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
    return r;
  }

  // ══════════════════════════════════════════════════════════════
  // USERS
  // ══════════════════════════════════════════════════════════════
  async registerUser(userData) {
    if (this._useFallback) return this._fb_registerUser(userData);
    
    const payload = {
      name: userData.name, phone: userData.phone, role: userData.role,
      vehicle: userData.vehicle || null, address: userData.address || null
    };
    if (userData.pin) payload.pin = userData.pin;

    let { data, error } = await this._sb.from('users').insert([payload]).select().single();
    
    if (error && (error.code === 'PGRST105' || (error.message && error.message.includes('pin') && error.message.includes('column')))) {
      // Intentar de nuevo sin PIN para no romper el registro si el DB schema aún no es actualizado
      delete payload.pin;
      const retry = await this._sb.from('users').insert([payload]).select().single();
      data = retry.data; error = retry.error;
    }

    if (error) {
      const msg = error.code === '23505' ? 'Ya existe una cuenta con ese teléfono.' : (error.message || 'Error al registrar.');
      return { success: false, error: msg };
    }
    this.setCurrentUser(data);
    return { success: true, user: data };
  }

  async loginUser(phone, role, pin) {
    if (this._useFallback) return this._fb_loginUser(phone, role, pin);
    const { data, error } = await this._sb.from('users')
      .select('*').eq('phone', phone).eq('role', role).maybeSingle();
    if (error || !data) return { success: false, error: 'No se encontró una cuenta con ese teléfono.' };
    
    if (pin) {
      const expectedPin = data.pin || phone.slice(-4);
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
    const cur = this.getCurrentUser();
    if (cur && cur.id === id) this.setCurrentUser(data);
    return { success: true, user: data };
  }

  setCurrentUser(user) {
    this._currentUser = user;
    localStorage.setItem('motoclick_current_user', JSON.stringify(user));
  }

  getCurrentUser() { return this._currentUser; }

  logout() {
    this._currentUser = null;
    localStorage.removeItem('motoclick_current_user');
  }

  // ══════════════════════════════════════════════════════════════
  // ORDERS
  // ══════════════════════════════════════════════════════════════
  async getOrders() {
    if (this._useFallback) return this._fb_getOrders();
    const { data, error } = await this._sb.from('orders').select('*').order('created_at', { ascending: false });
    if (error) console.error('[Store] getOrders Error:', error);
    return (data || []).map(r => this._fromDB(r));
  }

  async getOrderById(id) {
    if (this._useFallback) return this._fb_getOrders().find(o => o.id === id) || null;
    const { data, error } = await this._sb.from('orders')
      .select('*, client:client_id(is_verified, profile_photo_url), driver:driver_id(is_verified)')
      .eq('id', id)
      .maybeSingle();
    if (error) console.error('[Store] getOrderById Error:', error);
    return this._fromDB(data);
  }

  async getOrdersByClient(clientId) {
    if (this._useFallback) return this._fb_getOrders().filter(o => o.clientId === clientId);
    const { data, error } = await this._sb.from('orders').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    if (error) console.error('[Store] getOrdersByClient Error:', error);
    return (data || []).map(r => this._fromDB(r));
  }

  async getOrdersByDriver(driverId) {
    if (this._useFallback) return this._fb_getOrders().filter(o => o.driverId === driverId);
    const { data, error } = await this._sb.from('orders').select('*').eq('driver_id', driverId).order('created_at', { ascending: false });
    if (error) console.error('[Store] getOrdersByDriver Error:', error);
    return (data || []).map(r => this._fromDB(r));
  }

  async getPendingOrders() {
    if (this._useFallback) return this._fb_getOrders().filter(o => o.status === 'pending');
    const { data, error } = await this._sb.from('orders').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    if (error) console.error('[Store] getPendingOrders Error:', error);
    return (data || []).map(r => this._fromDB(r));
  }

  async getActiveOrderForDriver(driverId) {
    if (this._useFallback) {
      return this._fb_getOrders().find(o => o.driverId === driverId && !['pending','entregado','cancelado'].includes(o.status)) || null;
    }
    const { data, error } = await this._sb.from('orders').select('*')
      .eq('driver_id', driverId)
      .not('status', 'in', '("pending","entregado","cancelado")')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) console.error('[Store] getActiveOrder Error:', error);
    return data && data.length > 0 ? this._fromDB(data[0]) : null;
  }

  async createOrder(orderData) {
    if (this._useFallback) return this._fb_createOrder(orderData);
    const id = 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    const row = this._toDB({ id, ...orderData, status: 'pending', driverId: null });
    const { data, error } = await this._sb.from('orders').insert([row]).select().single();
    if (error) { console.error('[Store] createOrder:', error); return null; }
    return this._fromDB(data);
  }

  async acceptOrder(orderId, driver) {
    if (this._useFallback) return this._fb_acceptOrder(orderId, driver);
    const { data, error } = await this._sb.from('orders').update({
      status: 'accepted',
      driver_id: driver.id,
      driver_name: driver.name,
      driver_photo: driver.photo || null,
      accepted_at: new Date().toISOString(),
    }).eq('id', orderId).select().single();
    if (error) return null;
    return this._fromDB(data);
  }

  async updateOrderStatus(orderId, status) {
    if (this._useFallback) return this._fb_updateOrderStatus(orderId, status);
    const upd = { status };
    if (status === 'entregado') upd.delivered_at = new Date().toISOString();
    const { data, error } = await this._sb.from('orders').update(upd).eq('id', orderId).select().single();
    if (error) return null;
    return this._fromDB(data);
  }

  async updateOrder(orderId, updates) {
    if (this._useFallback) return this._fb_updateOrder(orderId, updates);
    const { data, error } = await this._sb.from('orders').update(this._toDB(updates)).eq('id', orderId).select().single();
    if (error) return null;
    return this._fromDB(data);
  }

  async updateDriverLocation(orderId, location) {
    if (this._useFallback) return this._fb_updateDriverLocation(orderId, location);
    await this._sb.from('orders').update({ driver_location: location }).eq('id', orderId);
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
  async verifyCashCode(code) {
    if (this._useFallback) return { success: code === "MOTO-EFEC-2026" };
    
    try {
      const { data, error } = await this._sb.from('cash_verification_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .eq('is_used', false);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Optional: Expiration check (Done by policy if desired, or here)
        return { success: true, codeData: data[0] };
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

  async getAllCashCodes() {
    if (this._useFallback) return { data: [] };
    const { data, error } = await this._sb.from('cash_verification_codes')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
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

  async deleteUser(userId) {
    if (this._useFallback) return { success: true };
    const { error } = await this._sb.from('users').delete().eq('id', userId);
    return { success: !error, error };
  }
}

function generateId() {
  return 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

window.MotoClickStore = window.MotoClickStore || new MotoClickStore();
window.store = window.MotoClickStore;
