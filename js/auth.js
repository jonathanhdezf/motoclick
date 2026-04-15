/**
 * MotoClick — Módulo de Autenticación con Supabase Auth
 * 
 * Reemplaza el sistema de login por localStorage con Supabase Auth.
 * 
 * FLUJO:
 * 1. Usuario ingresa teléfono + PIN/contraseña
 * 2. Se llama a supabase.auth.signInWithPassword()
 * 3. Supabase devuelve sesión JWT
 * 4. Las políticas RLS usan auth.uid() del JWT para filtrar datos
 * 
 * REGISTRO:
 * 1. Usuario nuevo ingresa nombre + teléfono + PIN
 * 2. Se llama a supabase.auth.signUp()
 * 3. El trigger on_auth_user_created crea el perfil en public.users
 */

class MotoClickAuth {
  constructor(supabaseClient) {
    this._sb = supabaseClient;
    this._onAuthStateChangeCallbacks = [];

    // Escuchar cambios de autenticación
    this._initAuthListener();
  }

  /**
   * Suscribirse a cambios de sesión (login, logout, refresh)
   */
  _initAuthListener() {
    if (!this._sb || !this._sb.auth) return;

    this._sb.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Event:', event, 'Session:', session ? 'active' : 'none');

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        this._onSessionStart(session);
      } else if (event === 'SIGNED_OUT') {
        this._onSessionEnd();
      }

      // Notificar a los callbacks registrados
      this._onAuthStateChangeCallbacks.forEach(cb => {
        try { cb(event, session); } catch (e) { console.error(e); }
      });
    });
  }

  /**
   * Al iniciar sesión, cargar perfil del usuario desde public.users
   * Optimización Senior: Cacheamos el perfil para evitar hits innecesarios a la DB
   */
  async _onSessionStart(session) {
    if (!session || !session.user) return;

    try {
      // Intentar obtener de cache primero para velocidad instantánea
      const cachedProfile = localStorage.getItem('motoclick_current_user');
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        if (profile.user_id === session.user.id) {
          console.log('[Auth] Profile loaded from cache');
          this._updateAppStatus(profile);
        }
      }

      // Validar/Actualizar desde la DB en segundo plano
      const { data: userProfile, error } = await this._sb
        .from('users')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Error loading profile from DB:', error);
        return;
      }

      if (userProfile) {
        this._updateAppStatus(userProfile);
        console.log('[Auth] Profile synced from DB:', userProfile.name);
      } else {
        console.warn('[Auth] No profile found in public.users');
      }
    } catch (e) {
      console.error('[Auth] Session start error:', e);
    }
  }

  /**
   * Actualizar el estado global de la aplicación con el perfil del usuario
   */
  _updateAppStatus(profile) {
    localStorage.setItem('motoclick_current_user', JSON.stringify(profile));
    if (window.store && typeof window.store.setCurrentUser === 'function') {
      window.store.setCurrentUser(profile);
    }
    // Despachar evento personalizado para que otros módulos reaccionen
    window.dispatchEvent(new CustomEvent('motoclick:auth:ready', { detail: profile }));
  }

  /**
   * Al cerrar sesión, limpiar datos locales
   */
  _onSessionEnd() {
    localStorage.removeItem('motoclick_current_user');
    if (window.store && typeof window.store.logout === 'function') {
      window.store.logout();
    }
    window.dispatchEvent(new CustomEvent('motoclick:auth:cleared'));
    console.log('[Auth] Session ended, local data cleared');
  }

  /**
   * Suscribirse a cambios de auth
   * @param {Function} callback - (event, session) => void
   * @returns {Function} unsubscribe
   */
  onAuthStateChange(callback) {
    this._onAuthStateChangeCallbacks.push(callback);
    return () => {
      this._onAuthStateChangeCallbacks = this._onAuthStateChangeCallbacks.filter(
        cb => cb !== callback
      );
    };
  }

  // ══════════════════════════════════════════════════════════════
  // REGISTRO (Sign Up) con Retry Logic (Senior Pattern)
  // ══════════════════════════════════════════════════════════════

  /**
   * Registrar nuevo usuario con Supabase Auth
   */
  async signUp({ phone, pin, name, role = 'client', extra = {} }) {
    if (!this._sb || !this._sb.auth) {
      return { success: false, error: 'Supabase Auth no disponible' };
    }

    // Validaciones básicas
    if (!phone || phone.length < 10) return { success: false, error: 'Teléfono inválido' };
    if (!pin || pin.length < 4) return { success: false, error: 'PIN muy corto' };

    try {
      const virtualEmail = `${phone}@motoclick.app`;
      
      const { data, error } = await this._sb.auth.signUp({
        email: virtualEmail,
        password: pin,
        options: {
          data: { name: name.trim(), phone, role, ...extra }
        }
      });

      if (error) {
        const msg = error.message.includes('already exists') ? 'El teléfono ya está registrado' : error.message;
        return { success: false, error: msg };
      }

      if (!data.user) return { success: false, error: 'Error al crear cuenta' };

      // OPTIMIZACIÓN: Esperar al perfil con reintentos (Exponential Backoff)
      const profile = await this._waitForProfile(data.user.id);
      
      if (profile) {
        this._updateAppStatus(profile);
        return { success: true, user: profile };
      }

      return { success: true, user: data.user, warning: 'Perfil en creación...' };

    } catch (e) {
      console.error('[Auth] Sign up error:', e);
      return { success: false, error: 'Error de conexión' };
    }
  }

  /**
   * Esperar a que el trigger de la DB cree el perfil (Retry Loop)
   */
  async _waitForProfile(userId, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
      const { data } = await this._sb.from('users').select('*').eq('user_id', userId).maybeSingle();
      if (data) return data;
      
      // Espera incremental: 200ms, 400ms, 800ms...
      const wait = 200 * Math.pow(2, i);
      await new Promise(r => setTimeout(r, wait));
    }
    return null;
  }


  // ══════════════════════════════════════════════════════════════
  // INICIO DE SESIÓN (Sign In)
  // ══════════════════════════════════════════════════════════════

  /**
   * Iniciar sesión con teléfono + PIN
   * 
   * @param {string} phone - Teléfono (10 dígitos)
   * @param {string} pin - PIN/contraseña
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
  async signIn(phone, pin) {
    if (!this._sb || !this._sb.auth) {
      return { success: false, error: 'Supabase Auth no disponible' };
    }

    if (!phone || phone.length < 10) {
      return { success: false, error: 'Ingresa un teléfono válido de 10 dígitos' };
    }
    if (!pin || pin.length < 4) {
      return { success: false, error: 'Ingresa tu PIN' };
    }

    try {
      // Usar el mismo formato de email virtual que en signUp
      const virtualEmail = `${phone}@motoclick.app`;

      const { data, error } = await this._sb.auth.signInWithPassword({
        email: virtualEmail,
        password: pin
      });

      if (error) {
        if (error.message.includes('Invalid login credentials') || 
            error.message.includes('email') ||
            error.message.includes('password')) {
          return { success: false, error: 'Teléfono o PIN incorrecto. Intenta de nuevo.' };
        }
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'No se encontró una cuenta con ese teléfono.' };
      }

      // El listener onAuthStateChange ya cargó el perfil automáticamente
      // Esperar un momento para asegurar que se completó
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verificar que se cargó el perfil
      const currentUser = JSON.parse(localStorage.getItem('motoclick_current_user') || 'null');
      if (!currentUser) {
        // Si no hay perfil, intentarlo manualmente
        const { data: profile } = await this._sb
          .from('users')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (profile) {
          localStorage.setItem('motoclick_current_user', JSON.stringify(profile));
          if (window.store && typeof window.store.setCurrentUser === 'function') {
            window.store.setCurrentUser(profile);
          }
        }
      }

      console.log('[Auth] Sign in successful:', currentUser?.name || data.user.id);
      return { success: true, user: currentUser || data.user };

    } catch (e) {
      console.error('[Auth] Sign in error:', e);
      return { success: false, error: 'Error de conexión. Verifica tu internet.' };
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CIERRE DE SESIÓN (Sign Out)
  // ══════════════════════════════════════════════════════════════

  /**
   * Cerrar sesión
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async signOut() {
    if (!this._sb || !this._sb.auth) {
      return { success: false, error: 'Supabase Auth no disponible' };
    }

    try {
      const { error } = await this._sb.auth.signOut();

      if (error) {
        console.error('[Auth] Sign out error:', error);
        // Aún así limpiar datos locales
      }

      this._onSessionEnd();

      console.log('[Auth] Sign out successful');
      return { success: true };

    } catch (e) {
      console.error('[Auth] Sign out error:', e);
      this._onSessionEnd(); // Limpiar aunque falle
      return { success: true }; // Forzar éxito para redirigir
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ESTADO DE SESIÓN
  // ══════════════════════════════════════════════════════════════

  /**
   * Obtener la sesión actual
   * @returns {Object|null} Sesión de Supabase Auth
   */
  getSession() {
    if (!this._sb || !this._sb.auth) return null;
    return this._sb.auth.getSession().then(r => r.data.session).catch(() => null);
  }

  /**
   * Obtener sesión de forma síncrona (desde localStorage)
   * @returns {Object|null}
   */
  getSessionSync() {
    try {
      const stored = localStorage.getItem(
        `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
      );
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Verificar si hay una sesión activa
   * @returns {boolean}
   */
  isAuthenticated() {
    const session = this.getSessionSync();
    return session && session.access_token ? true : false;
  }

  /**
   * Obtener usuario actual desde localStorage
   * @returns {Object|null}
   */
  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('motoclick_current_user')) || null;
    } catch {
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // LOGIN SOCIAL — Google
  // ══════════════════════════════════════════════════════════════

  /**
   * Iniciar sesión / registrarse con Google
   * Si es usuario nuevo, se crea la cuenta automáticamente.
   * Si ya existe, inicia sesión.
   *
   * @param {string} [role='client'] - 'client' | 'driver'
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async signInWithGoogle(role = 'client') {
    if (!this._sb || !this._sb.auth) {
      return { success: false, error: 'Supabase Auth no disponible' };
    }

    try {
      const redirectTo = role === 'driver'
        ? window.location.origin + '/repartidor/panel.html'
        : window.location.origin + '/cliente/nuevo-pedido.html';

      const { data, error } = await this._sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // signInWithOAuth redirige al usuario, no llegamos aquí
      // Pero si hay data.url, redirigimos manualmente
      if (data?.url) {
        window.location.href = data.url;
      }

      return { success: true };

    } catch (e) {
      console.error('[Auth] Google sign-in error:', e);
      return { success: false, error: 'Error al conectar con Google. Intenta de nuevo.' };
    }
  }

  // ══════════════════════════════════════════════════════════════
  // LOGIN SOCIAL — Facebook
  // ══════════════════════════════════════════════════════════════

  /**
   * Iniciar sesión / registrarse con Facebook
   * Si es usuario nuevo, se crea la cuenta automáticamente.
   * Si ya existe, inicia sesión.
   *
   * @param {string} [role='client'] - 'client' | 'driver'
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async signInWithFacebook(role = 'client') {
    if (!this._sb || !this._sb.auth) {
      return { success: false, error: 'Supabase Auth no disponible' };
    }

    try {
      const redirectTo = role === 'driver'
        ? window.location.origin + '/repartidor/panel.html'
        : window.location.origin + '/cliente/nuevo-pedido.html';

      const { data, error } = await this._sb.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.url) {
        window.location.href = data.url;
      }

      return { success: true };

    } catch (e) {
      console.error('[Auth] Facebook sign-in error:', e);
      return { success: false, error: 'Error al conectar con Facebook. Intenta de nuevo.' };
    }
  }

  // ══════════════════════════════════════════════════════════════
  // OAUTH CALLBACK — Verificar y solicitar teléfono después de OAuth
  // ══════════════════════════════════════════════════════════════

  /**
   * Se llama después del redirect de OAuth para:
   * 1. Verificar si el perfil tiene teléfono
   * 2. Si NO tiene → solicitarlo con modal
   * 3. Si YA tiene → continuar normalmente
   *
   * @param {string} role - 'client' | 'driver'
   * @returns {Promise<{success: boolean, needsPhone?: boolean, user?: Object, error?: string}>}
   */
  async checkOAuthProfileComplete(role = 'client') {
    if (!this._sb || !this._sb.auth) {
      return { success: false, error: 'Supabase Auth no disponible' };
    }

    try {
      // Obtener sesión actual
      const { data: sessionData } = await this._sb.auth.getSession();
      if (!sessionData?.session?.user) {
        return { success: false, error: 'No hay sesión activa' };
      }

      const authUser = sessionData.session.user;

      // Verificar si ya existe perfil en public.users
      const { data: profile, error } = await this._sb
        .from('users')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Error checking profile:', error);
        return { success: false, error: 'Error al verificar perfil' };
      }

      if (!profile) {
        // Perfil no existe — crearlo con datos de OAuth
        const newProfile = await this.completeOAuthProfile(authUser, role);
        if (!newProfile) {
          return { success: false, error: 'Error al crear perfil' };
        }
        // Verificar si tiene teléfono
        if (!newProfile.phone || newProfile.phone.length < 10) {
          return { success: true, needsPhone: true, user: newProfile };
        }
        return { success: true, needsPhone: false, user: newProfile };
      }

      // Perfil existe — verificar teléfono
      if (!profile.phone || profile.phone.length < 10) {
        return { success: true, needsPhone: true, user: profile };
      }

      return { success: true, needsPhone: false, user: profile };

    } catch (e) {
      console.error('[Auth] checkOAuthProfileComplete error:', e);
      return { success: false, error: 'Error al verificar perfil' };
    }
  }

  /**
   * Guardar teléfono después de que el usuario OAuth lo ingresa
   *
   * @param {string} phone - Teléfono de 10 dígitos
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
  async saveOAuthPhone(phone) {
    if (!this._sb || !this._sb.auth) {
      return { success: false, error: 'Supabase Auth no disponible' };
    }

    if (!phone || phone.length < 10) {
      return { success: false, error: 'Ingresa un teléfono válido de 10 dígitos' };
    }

    try {
      const session = await this._sb.auth.getSession();
      if (!session?.data?.session?.user) {
        return { success: false, error: 'No hay sesión activa' };
      }

      const authUserId = session.data.session.user.id;

      // Verificar que el teléfono no esté ya en uso por otro usuario
      const { data: existingUser } = await this._sb
        .from('users')
        .select('id')
        .eq('phone', phone)
        .neq('user_id', authUserId)
        .maybeSingle();

      if (existingUser) {
        return { success: false, error: 'Este teléfono ya está registrado con otra cuenta' };
      }

      // Actualizar teléfono en public.users
      const { data: updatedProfile, error } = await this._sb
        .from('users')
        .update({
          phone: phone,
          is_verified: true,
          verification_status: 'verified',
          verification_date: new Date().toISOString()
        })
        .eq('user_id', authUserId)
        .select()
        .single();

      if (error) {
        console.error('[Auth] Error saving phone:', error);
        return { success: false, error: 'Error al guardar el teléfono' };
      }

      // También actualizar en metadata de auth.users (opcional pero útil)
      await this._sb.auth.updateUser({
        data: { phone: phone }
      });

      // Guardar localmente
      localStorage.setItem('motoclick_current_user', JSON.stringify(updatedProfile));
      if (window.store && typeof window.store.setCurrentUser === 'function') {
        window.store.setCurrentUser(updatedProfile);
      }

      return { success: true, user: updatedProfile };

    } catch (e) {
      console.error('[Auth] saveOAuthPhone error:', e);
      return { success: false, error: 'Error de conexión. Verifica tu internet.' };
    }
  }

  /**
   * Se llama después del redirect de OAuth para asegurar que el perfil
   * en public.users existe y tiene los campos correctos.
   * El trigger _mc_on_signup debería haberlo creado, pero esto es
   * un respaldo por si el trigger falló o el schema es viejo.
   */
  async completeOAuthProfile(user, role = 'client') {
    if (!user || !user.id) return;

    try {
      // Verificar si ya existe perfil
      const { data: existing } = await this._sb
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Perfil ya existe, solo actualizar
        localStorage.setItem('motoclick_current_user', JSON.stringify(existing));
        if (window.store && typeof window.store.setCurrentUser === 'function') {
          window.store.setCurrentUser(existing);
        }
        return existing;
      }

      // Crear perfil manualmente si el trigger no lo hizo
      const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
      const photo = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
      const provider = user.app_metadata?.provider || 'oauth';

      const { data: newProfile, error } = await this._sb
        .from('users')
        .insert([{
          user_id: user.id,
          name: name,
          phone: user.phone || user.email || '',
          role: role,
          profile_photo_url: photo,
          is_verified: true,
          verification_status: 'verified',
          verification_date: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('[Auth] Failed to create OAuth profile:', error);
        return null;
      }

      localStorage.setItem('motoclick_current_user', JSON.stringify(newProfile));
      if (window.store && typeof window.store.setCurrentUser === 'function') {
        window.store.setCurrentUser(newProfile);
      }

      return newProfile;

    } catch (e) {
      console.error('[Auth] completeOAuthProfile error:', e);
      return null;
    }
  }

  /**
   * Resetear PIN mediante WhatsApp (flujo actual)
   * Esto NO envía SMS — usa WhatsApp como canal de verificación
   * 
   * @param {string} phone - Teléfono registrado
   * @param {string} newPin - Nuevo PIN deseado
   * @returns {Object} Resultado con URL de WhatsApp
   */
  requestPinReset(phone, newPin) {
    if (!phone || phone.length < 10) {
      return { success: false, error: 'Teléfono inválido' };
    }
    if (!newPin || newPin.length < 4) {
      return { success: false, error: 'El nuevo PIN debe tener al menos 4 dígitos' };
    }

    // Enviar solicitud por WhatsApp al admin
    const adminPhone = '522331072438';
    const message = `Hola MotoClick! Olvidé mi contraseña.%0A%0A` +
      `📱 Teléfono registrado: ${phone}%0A` +
      `🔐 Nuevo PIN deseado: ${newPin}%0A%0A` +
      `¿Podrían actualizarlo por favor?`;

    const whatsappUrl = `https://wa.me/${adminPhone}?text=${message}`;

    return { success: true, whatsappUrl };
  }

  // ══════════════════════════════════════════════════════════════
  // ACTUALIZAR CONTRASEÑA (PIN)
  // ══════════════════════════════════════════════════════════════

  /**
   * Actualizar el PIN/contraseña del usuario actual
   * 
   * @param {string} newPin - Nuevo PIN
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async updatePin(newPin) {
    if (!this._sb || !this._sb.auth) {
      return { success: false, error: 'Supabase Auth no disponible' };
    }

    if (!newPin || newPin.length < 4) {
      return { success: false, error: 'El PIN debe tener al menos 4 dígitos' };
    }

    try {
      const { error } = await this._sb.auth.updateUser({
        password: newPin
      });

      if (error) {
        return { success: false, error: error.message };
      }

      console.log('[Auth] PIN updated successfully');
      return { success: true };

    } catch (e) {
      console.error('[Auth] PIN update error:', e);
      return { success: false, error: 'Error al actualizar el PIN' };
    }
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.MotoClickAuth = MotoClickAuth;
}
