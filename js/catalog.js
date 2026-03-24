/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           CATÁLOGO DE PRODUCTOS — TIENDA CHEDRAUI            ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  CÓMO AGREGAR UN PRODUCTO:                                   ║
 * ║                                                              ║
 * ║  Copia y pega este bloque al final de la lista (antes del    ║
 * ║  corchete ] de cierre) y llena los campos:                   ║
 * ║                                                              ║
 * ║  { id: 99,                   ← Número único, no repetir      ║
 * ║    name: 'Nombre Producto',  ← Nombre completo               ║
 * ║    brand: 'Marca',           ← Marca del producto            ║
 * ║    cat: 'Bebidas',           ← Categoría (ver lista abajo)   ║
 * ║    price: 35,                ← Precio en pesos (sin $)       ║
 * ║    emoji: '🥤',             ← Emoji representativo           ║
 * ║    color: '#1a73e8' },       ← Color de fondo de la tarjeta  ║
 * ║                                                              ║
 * ║  CATEGORÍAS DISPONIBLES:                                     ║
 * ║  'Lácteos' 'Bebidas' 'Panadería' 'Botanas'                   ║
 * ║  'Frutas'  'Higiene' 'Despensa'  'Carnes'  'Limpieza'        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const CHEDRAUI_CATALOG = [

  // ─────────────────────────────────────────
  //  🥛  LÁCTEOS
  // ─────────────────────────────────────────
  { id:1,  name:'Leche Entera Lala 1L',          brand:'Lala',         cat:'Lácteos',   price:28,  emoji:'🥛', color:'#f0f4ff' },
  { id:2,  name:'Leche Deslactosada Lala 1L',    brand:'Lala',         cat:'Lácteos',   price:30,  emoji:'🥛', color:'#e8f0fe' },
  { id:3,  name:'Leche Alpura Entera 1L',        brand:'Alpura',       cat:'Lácteos',   price:29,  emoji:'🥛', color:'#f0f4ff' },
  { id:4,  name:'Yogurt Alpura Natural 1kg',     brand:'Alpura',       cat:'Lácteos',   price:52,  emoji:'🍦', color:'#fff3e0' },
  { id:5,  name:'Yogurt Frutado Danone 150g',    brand:'Danone',       cat:'Lácteos',   price:14,  emoji:'🍦', color:'#fce4ec' },
  { id:6,  name:'Queso Manchego Chipilo 400g',   brand:'Chipilo',      cat:'Lácteos',   price:78,  emoji:'🧀', color:'#fff8e1' },
  { id:7,  name:'Queso Oaxaca Chipilo 400g',     brand:'Chipilo',      cat:'Lácteos',   price:82,  emoji:'🧀', color:'#fff8e1' },
  { id:8,  name:'Mantequilla Gloria 90g',        brand:'Gloria',       cat:'Lácteos',   price:29,  emoji:'🧈', color:'#fff9c4' },
  { id:9,  name:'Crema Lala 200ml',              brand:'Lala',         cat:'Lácteos',   price:23,  emoji:'🥣', color:'#f5f5f5' },
  { id:10, name:'Cajeta Coronado 380g',          brand:'Coronado',     cat:'Lácteos',   price:45,  emoji:'🍮', color:'#fff3e0' },

  // ─────────────────────────────────────────
  //  🥤  BEBIDAS
  // ─────────────────────────────────────────
  { id:11, name:'Coca-Cola 2L',                  brand:'Coca-Cola',    cat:'Bebidas',   price:38,  emoji:'🥤', color:'#fce4ec' },
  { id:12, name:'Coca-Cola 600ml',               brand:'Coca-Cola',    cat:'Bebidas',   price:19,  emoji:'🥤', color:'#fce4ec' },
  { id:13, name:'Pepsi 2L',                      brand:'Pepsi',        cat:'Bebidas',   price:35,  emoji:'🥤', color:'#e3f2fd' },
  { id:14, name:'Agua Ciel 1.5L',               brand:'Ciel',         cat:'Bebidas',   price:14,  emoji:'💧', color:'#e3f2fd' },
  { id:15, name:'Agua Epura 6L (garrafón)',      brand:'Bonafont',     cat:'Bebidas',   price:48,  emoji:'🪣', color:'#e1f5fe' },
  { id:16, name:'Jugo Jumex Mango 1L',          brand:'Jumex',        cat:'Bebidas',   price:22,  emoji:'🧃', color:'#fff8e1' },
  { id:17, name:'Jugo Del Valle Natural 1L',    brand:'Del Valle',    cat:'Bebidas',   price:24,  emoji:'🧃', color:'#e8f5e9' },
  { id:18, name:'Gatorade Limón 500ml',         brand:'Gatorade',     cat:'Bebidas',   price:21,  emoji:'⚡', color:'#f9fbe7' },
  { id:19, name:'Gatorade Mandarina 500ml',     brand:'Gatorade',     cat:'Bebidas',   price:21,  emoji:'⚡', color:'#fff3e0' },
  { id:20, name:'Café Nescafé Clásico 200g',   brand:'Nescafé',      cat:'Bebidas',   price:89,  emoji:'☕', color:'#efebe9' },
  { id:21, name:'Café Cápsula Nespresso x10',  brand:'Nespresso',    cat:'Bebidas',   price:135, emoji:'☕', color:'#3e2723' },
  { id:22, name:'Té Lipton x25 sobres',        brand:'Lipton',       cat:'Bebidas',   price:32,  emoji:'🍵', color:'#f1f8e9' },
  { id:23, name:'Monster Energy 473ml',        brand:'Monster',      cat:'Bebidas',   price:35,  emoji:'🔋', color:'#f9fbe7' },

  // ─────────────────────────────────────────
  //  🍞  PANADERÍA & CEREALES
  // ─────────────────────────────────────────
  { id:24, name:'Pan Bimbo Blanco 680g',        brand:'Bimbo',        cat:'Panadería', price:45,  emoji:'🍞', color:'#fff8e1' },
  { id:25, name:'Pan Integral Bimbo 680g',      brand:'Bimbo',        cat:'Panadería', price:49,  emoji:'🍞', color:'#efebe9' },
  { id:26, name:'Tortillas de Maíz 1kg',        brand:'Maseca',       cat:'Panadería', price:32,  emoji:'🫓', color:'#fff3e0' },
  { id:27, name:'Tortillas de Harina 30 pzas',  brand:'Misioneras',   cat:'Panadería', price:38,  emoji:'🫓', color:'#f5f5f5' },
  { id:28, name:'Galletas Marías Gamesa 200g',  brand:'Gamesa',       cat:'Panadería', price:19,  emoji:'🍪', color:'#fff8e1' },
  { id:29, name:'Galletas Oreo 117g',           brand:'Oreo',         cat:'Panadería', price:22,  emoji:'🍪', color:'#212121' },
  { id:30, name:'Cereal Zucaritas 500g',        brand:'Kellogg\'s',   cat:'Panadería', price:65,  emoji:'🥣', color:'#fff3e0' },
  { id:31, name:'Cereal Choco Krispis 500g',   brand:'Kellogg\'s',   cat:'Panadería', price:65,  emoji:'🥣', color:'#4e342e' },
  { id:32, name:'Avena Quaker en Hojuelas 1kg', brand:'Quaker',       cat:'Panadería', price:49,  emoji:'🥣', color:'#f5f5f5' },

  // ─────────────────────────────────────────
  //  🍿  BOTANAS
  // ─────────────────────────────────────────
  { id:33, name:'Sabritas Adobadas 45g',        brand:'Sabritas',     cat:'Botanas',   price:16,  emoji:'🍿', color:'#fce4ec' },
  { id:34, name:'Cheetos Flamin Hot 42g',       brand:'Sabritas',     cat:'Botanas',   price:16,  emoji:'🌶️', color:'#b71c1c' },
  { id:35, name:'Doritos Nacho 45g',            brand:'Sabritas',     cat:'Botanas',   price:16,  emoji:'🔺', color:'#ff6f00' },
  { id:36, name:'Ruffles Queso 45g',            brand:'Sabritas',     cat:'Botanas',   price:16,  emoji:'🍿', color:'#f57f17' },
  { id:37, name:'Palomitas Act II Mant. 180g',  brand:'Act II',       cat:'Botanas',   price:26,  emoji:'🍿', color:'#fff9c4' },
  { id:38, name:'Cacahuates Japoneses 200g',    brand:'Barcel',       cat:'Botanas',   price:25,  emoji:'🥜', color:'#efebe9' },
  { id:39, name:'Barcel Hot Nuts 200g',         brand:'Barcel',       cat:'Botanas',   price:29,  emoji:'🌶️', color:'#b71c1c' },
  { id:40, name:'Churrumais 55g',               brand:'Barcel',       cat:'Botanas',   price:16,  emoji:'🌽', color:'#f57f17' },
  { id:41, name:'Takis Fuego 56g',              brand:'Barcel',       cat:'Botanas',   price:16,  emoji:'🌯', color:'#c62828' },
  { id:42, name:'Papitas Lay\'s 53g',           brand:'Sabritas',     cat:'Botanas',   price:16,  emoji:'🥔', color:'#fff9c4' },

  // ─────────────────────────────────────────
  //  🍎  FRUTAS & VERDURAS
  // ─────────────────────────────────────────
  { id:43, name:'Manzana Roja por kilo',        brand:'Natural',      cat:'Frutas',    price:38,  emoji:'🍎', color:'#fce4ec' },
  { id:44, name:'Plátano por kilo',             brand:'Natural',      cat:'Frutas',    price:22,  emoji:'🍌', color:'#fff9c4' },
  { id:45, name:'Jitomate Bola por kilo',       brand:'Natural',      cat:'Frutas',    price:25,  emoji:'🍅', color:'#fce4ec' },
  { id:46, name:'Limón por kilo',               brand:'Natural',      cat:'Frutas',    price:28,  emoji:'🍋', color:'#f9fbe7' },
  { id:47, name:'Cebolla Blanca por pieza',     brand:'Natural',      cat:'Frutas',    price:8,   emoji:'🧅', color:'#fff9c4' },
  { id:48, name:'Papa por kilo',                brand:'Natural',      cat:'Frutas',    price:20,  emoji:'🥔', color:'#fff3e0' },
  { id:49, name:'Aguacate por pieza',           brand:'Natural',      cat:'Frutas',    price:25,  emoji:'🥑', color:'#e8f5e9' },
  { id:50, name:'Naranja por kilo',             brand:'Natural',      cat:'Frutas',    price:20,  emoji:'🍊', color:'#fff3e0' },

  // ─────────────────────────────────────────
  //  🧴  HIGIENE PERSONAL
  // ─────────────────────────────────────────
  { id:51, name:'Jabón Dove Original 90g',      brand:'Dove',         cat:'Higiene',   price:29,  emoji:'🧼', color:'#e8f5e9' },
  { id:52, name:'Shampoo H&S 375ml',            brand:'H&S',          cat:'Higiene',   price:68,  emoji:'🧴', color:'#e3f2fd' },
  { id:53, name:'Acondicionador Pantene 400ml', brand:'Pantene',      cat:'Higiene',   price:72,  emoji:'🧖', color:'#fce4ec' },
  { id:54, name:'Pasta Colgate Triple 75ml',    brand:'Colgate',      cat:'Higiene',   price:39,  emoji:'🪥', color:'#e8f5e9' },
  { id:55, name:'Cepillo Oral-B 2 pack',        brand:'Oral-B',       cat:'Higiene',   price:49,  emoji:'🪥', color:'#e3f2fd' },
  { id:56, name:'Desodorante Speed Stick 45g',  brand:'Mennen',       cat:'Higiene',   price:49,  emoji:'💨', color:'#f3e5f5' },
  { id:57, name:'Papel Higiénico Petalo 6 rll', brand:'Petalo',       cat:'Higiene',   price:55,  emoji:'🧻', color:'#f5f5f5' },
  { id:58, name:'Toallas Húmedas Pampers 72pz', brand:'Pampers',      cat:'Higiene',   price:89,  emoji:'🚼', color:'#e3f2fd' },

  // ─────────────────────────────────────────
  //  🧺  DESPENSA Y ABARROTES
  // ─────────────────────────────────────────
  { id:59, name:'Arroz Extra Morelos 1kg',      brand:'Morelos',      cat:'Despensa',  price:28,  emoji:'🍚', color:'#f5f5f5' },
  { id:60, name:'Frijoles Negros La Sierra 560g',brand:'La Sierra',  cat:'Despensa',  price:32,  emoji:'🫘', color:'#4e342e' },
  { id:61, name:'Aceite Cristal 900ml',         brand:'Cristal',      cat:'Despensa',  price:58,  emoji:'🫙', color:'#fff9c4' },
  { id:62, name:'Sal La Fina 1kg',              brand:'La Fina',      cat:'Despensa',  price:18,  emoji:'🧂', color:'#f5f5f5' },
  { id:63, name:'Azúcar Estándar Zulka 1kg',    brand:'Zulka',        cat:'Despensa',  price:29,  emoji:'🧂', color:'#fff9c4' },
  { id:64, name:'Atún en Agua Herdez 140g',     brand:'Herdez',       cat:'Despensa',  price:22,  emoji:'🐟', color:'#e3f2fd' },
  { id:65, name:'Salsa Valentina 370ml',        brand:'Valentina',    cat:'Despensa',  price:28,  emoji:'🌶️', color:'#b71c1c' },
  { id:66, name:'Salsa Clamato 946ml',          brand:'Clamato',      cat:'Despensa',  price:45,  emoji:'🍅', color:'#fce4ec' },
  { id:67, name:'Mayonesa McCormick 400g',      brand:'McCormick',    cat:'Despensa',  price:48,  emoji:'🫙', color:'#fff9c4' },
  { id:68, name:'Catsup Heinz 397g',            brand:'Heinz',        cat:'Despensa',  price:39,  emoji:'🫙', color:'#fce4ec' },
  { id:69, name:'Sopa Maruchan Camarón',        brand:'Maruchan',     cat:'Despensa',  price:14,  emoji:'🍜', color:'#fff3e0' },
  { id:70, name:'Pasta Barilla Espagueti 500g', brand:'Barilla',      cat:'Despensa',  price:29,  emoji:'🍝', color:'#fff3e0' },
  { id:71, name:'Sardinas en Tomate 425g',      brand:'Calmex',       cat:'Despensa',  price:28,  emoji:'🐟', color:'#fce4ec' },
  { id:72, name:'Chile Chipotles Herdez 215g',  brand:'Herdez',       cat:'Despensa',  price:22,  emoji:'🌶️', color:'#c62828' },

  // ─────────────────────────────────────────
  //  🧹  LIMPIEZA DEL HOGAR
  // ─────────────────────────────────────────
  { id:73, name:'Detergente Ariel líq. 1L',    brand:'Ariel',        cat:'Limpieza',  price:79,  emoji:'🧺', color:'#e3f2fd' },
  { id:74, name:'Suavitel Flores 850ml',        brand:'Suavitel',     cat:'Limpieza',  price:45,  emoji:'🌸', color:'#fce4ec' },
  { id:75, name:'Jabón Roma en Polvo 500g',     brand:'Roma',         cat:'Limpieza',  price:18,  emoji:'🧼', color:'#e8f5e9' },
  { id:76, name:'Cloro Cloralex 1L',            brand:'Cloralex',     cat:'Limpieza',  price:22,  emoji:'🧴', color:'#e3f2fd' },
  { id:77, name:'Desengrasante Fabuloso 1L',    brand:'Fabuloso',     cat:'Limpieza',  price:38,  emoji:'✨', color:'#f3e5f5' },
  { id:78, name:'Bolsas de Basura 10 pzas',     brand:'Klinpak',      cat:'Limpieza',  price:29,  emoji:'🗑️', color:'#212121' },
  { id:79, name:'Esponja Scotch-Brite 2 pzas',  brand:'Scotch-Brite', cat:'Limpieza',  price:25,  emoji:'🧽', color:'#e8f5e9' },
  { id:80, name:'Servilletas Regio 100 pzas',   brand:'Regio',        cat:'Limpieza',  price:22,  emoji:'🧻', color:'#f5f5f5' },

  // ─────────────────────────────────────────
  //  🥩  CARNES & EMBUTIDOS
  // ─────────────────────────────────────────
  { id:81, name:'Jamón de Pavo FUD 250g',       brand:'FUD',          cat:'Carnes',    price:55,  emoji:'🥩', color:'#fce4ec' },
  { id:82, name:'Salchicha FUD 500g',           brand:'FUD',          cat:'Carnes',    price:58,  emoji:'🌭', color:'#fce4ec' },
  { id:83, name:'Chorizo San Manuel 500g',      brand:'San Manuel',   cat:'Carnes',    price:72,  emoji:'🥩', color:'#c62828' },
  { id:84, name:'Tocino Ahumado Kir 200g',      brand:'Kir',          cat:'Carnes',    price:65,  emoji:'🥓', color:'#efebe9' },
  { id:85, name:'Milanesa de Res (kg aprox)',   brand:'Chedraui',     cat:'Carnes',    price:120, emoji:'🥩', color:'#fce4ec' },

];
