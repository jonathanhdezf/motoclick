/**
 * MotoClick — Store (estado global + comunicación en tiempo real)
 * Usa localStorage como base de datos y BroadcastChannel para sincronizar pestañas.
 */

const CHANNEL_NAME = 'motoclick-sync';
const STORAGE_KEY_ORDERS = 'motoclick_orders';
const STORAGE_KEY_USERS = 'motoclick_users';
const STORAGE_KEY_CURRENT_USER = 'motoclick_current_user';

class MotoClickStore {
  constructor() {
    this._listeners = {};
    this._channel = null;
    this._initChannel();
  }

  // ── BroadcastChannel ──
  _initChannel() {
    try {
      this._channel = new BroadcastChannel(CHANNEL_NAME);
      this._channel.onmessage = (event) => {
        const { type, payload } = event.data;
        this._emit(type, payload);
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported, real-time sync disabled.');
    }
  }

  _broadcast(type, payload) {
    if (this._channel) {
      this._channel.postMessage({ type, payload });
    }
  }

  // ── Event System ──
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    };
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => cb(data));
    }
  }

  // ── Users ──
  getUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_USERS)) || [];
    } catch { return []; }
  }

  _saveUsers(users) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  }

  registerUser(userData) {
    const users = this.getUsers();
    const exists = users.find(u => u.phone === userData.phone && u.role === userData.role);
    if (exists) return { success: false, error: 'Ya existe una cuenta con ese teléfono.' };

    const user = {
      id: generateId(),
      ...userData,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    this._saveUsers(users);
    this.setCurrentUser(user);
    return { success: true, user };
  }

  loginUser(phone, role) {
    const users = this.getUsers();
    const user = users.find(u => u.phone === phone && u.role === role);
    if (!user) return { success: false, error: 'No se encontró una cuenta con ese teléfono.' };
    this.setCurrentUser(user);
    return { success: true, user };
  }

  setCurrentUser(user) {
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
  }

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_CURRENT_USER));
    } catch { return null; }
  }

  logout() {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  }

  // ── Orders ──
  getOrders() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_ORDERS)) || [];
    } catch { return []; }
  }

  _saveOrders(orders) {
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
  }

  createOrder(orderData) {
    const orders = this.getOrders();
    const order = {
      id: generateId(),
      ...orderData,
      status: 'pending',       // pending | accepted | en_camino | recolectado | entregado
      driverId: null,
      driverName: null,
      driverLocation: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    orders.push(order);
    this._saveOrders(orders);
    this._broadcast('new_order', order);
    this._emit('new_order', order);
    return order;
  }

  getOrderById(id) {
    return this.getOrders().find(o => o.id === id) || null;
  }

  getOrdersByClient(clientId) {
    return this.getOrders().filter(o => o.clientId === clientId);
  }

  getPendingOrders() {
    return this.getOrders().filter(o => o.status === 'pending');
  }

  getActiveOrderForDriver(driverId) {
    return this.getOrders().find(o => o.driverId === driverId && o.status !== 'entregado' && o.status !== 'pending');
  }

  acceptOrder(orderId, driver) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return null;

    orders[idx].status = 'accepted';
    orders[idx].driverId = driver.id;
    orders[idx].driverName = driver.name;
    orders[idx].updatedAt = new Date().toISOString();

    this._saveOrders(orders);
    this._broadcast('order_accepted', orders[idx]);
    this._emit('order_accepted', orders[idx]);
    return orders[idx];
  }

  updateOrderStatus(orderId, status) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return null;

    orders[idx].status = status;
    orders[idx].updatedAt = new Date().toISOString();

    this._saveOrders(orders);
    this._broadcast('status_change', orders[idx]);
    this._emit('status_change', orders[idx]);
    return orders[idx];
  }

  updateDriverLocation(orderId, location) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;

    orders[idx].driverLocation = location;
    this._saveOrders(orders);
    this._broadcast('location_update', { orderId, location });
    this._emit('location_update', { orderId, location });
  }
}

// ── Singleton ──
function generateId() {
  return 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

// Export singleton
window.MotoClickStore = window.MotoClickStore || new MotoClickStore();
window.store = window.MotoClickStore;
