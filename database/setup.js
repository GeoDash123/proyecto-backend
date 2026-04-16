// src/database/setup.js
// Ejecutar una sola vez: npm run setup-db
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { sql, getConnection } = require("./connection");

const schema = `
-- ================================================================
--  MARKETPLACE DATABASE SCHEMA
-- ================================================================

-- 1. VENDEDORES
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='vendedores' AND xtype='U')
CREATE TABLE vendedores (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  nombre       NVARCHAR(120)  NOT NULL,
  email        NVARCHAR(180)  NOT NULL UNIQUE,
  telefono     NVARCHAR(30),
  descripcion  NVARCHAR(500),
  activo       BIT            NOT NULL DEFAULT 1,
  fecha_registro DATETIME     NOT NULL DEFAULT GETDATE()
);

-- 2. CATEGORÍAS (catálogo auxiliar para productos)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='categorias' AND xtype='U')
CREATE TABLE categorias (
  id     INT IDENTITY(1,1) PRIMARY KEY,
  nombre NVARCHAR(80) NOT NULL UNIQUE
);

-- 3. PRODUCTOS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='productos' AND xtype='U')
CREATE TABLE productos (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  vendedor_id  INT            NOT NULL,
  categoria_id INT,
  nombre       NVARCHAR(200)  NOT NULL,
  descripcion  NVARCHAR(1000),
  precio       DECIMAL(10,2)  NOT NULL CHECK (precio >= 0),
  stock        INT            NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo       BIT            NOT NULL DEFAULT 1,
  fecha_creacion DATETIME     NOT NULL DEFAULT GETDATE(),

  CONSTRAINT fk_producto_vendedor  FOREIGN KEY (vendedor_id)  REFERENCES vendedores(id) ON DELETE CASCADE,
  CONSTRAINT fk_producto_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
);

-- 4. CLIENTES
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='clientes' AND xtype='U')
CREATE TABLE clientes (
  id       INT IDENTITY(1,1) PRIMARY KEY,
  nombre   NVARCHAR(120) NOT NULL,
  email    NVARCHAR(180) NOT NULL UNIQUE,
  telefono NVARCHAR(30),
  direccion NVARCHAR(300),
  fecha_registro DATETIME NOT NULL DEFAULT GETDATE()
);

-- 5. PEDIDOS (cabecera)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='pedidos' AND xtype='U')
CREATE TABLE pedidos (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id  INT           NOT NULL,
  estado      NVARCHAR(30)  NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','pagado','enviado','entregado','cancelado')),
  total       DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha_pedido DATETIME     NOT NULL DEFAULT GETDATE(),
  fecha_actualizacion DATETIME,

  CONSTRAINT fk_pedido_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- 6. DETALLE DE PEDIDOS (líneas)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='pedido_detalle' AND xtype='U')
CREATE TABLE pedido_detalle (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  pedido_id   INT           NOT NULL,
  producto_id INT           NOT NULL,
  cantidad    INT           NOT NULL CHECK (cantidad > 0),
  precio_unit DECIMAL(10,2) NOT NULL CHECK (precio_unit >= 0),
  subtotal    AS (cantidad * precio_unit) PERSISTED,

  CONSTRAINT fk_detalle_pedido   FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)  ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- ── Datos de prueba ──────────────────────────────────────────────
IF NOT EXISTS (SELECT TOP 1 1 FROM categorias)
BEGIN
  INSERT INTO categorias (nombre) VALUES
    ('Electrónica'), ('Ropa'), ('Alimentos'), ('Hogar'), ('Deportes');

  INSERT INTO vendedores (nombre, email, telefono, descripcion) VALUES
    ('Tienda Tech MX',   'tech@tienda.mx',   '664-100-0001', 'Electrónica y gadgets'),
    ('Moda Express',     'moda@express.mx',  '664-100-0002', 'Ropa y accesorios'),
    ('Mercado Fresco',   'fresh@mercado.mx', '664-100-0003', 'Productos alimenticios');

  INSERT INTO clientes (nombre, email, telefono, direccion) VALUES
    ('Ana García',   'ana@mail.com',   '664-200-0001', 'Av. Revolución 100, Tijuana'),
    ('Luis Pérez',   'luis@mail.com',  '664-200-0002', 'Blvd. Agua Caliente 200, Tijuana'),
    ('María López',  'maria@mail.com', '664-200-0003', 'Zona Centro 50, Tijuana');

  INSERT INTO productos (vendedor_id, categoria_id, nombre, descripcion, precio, stock) VALUES
    (1, 1, 'Laptop Ultrabook 14"',   'Intel i5, 16GB RAM, 512GB SSD', 18999.00, 10),
    (1, 1, 'Audífonos Bluetooth',    'Cancelación de ruido activa',    1299.00,  25),
    (2, 2, 'Playera Casual',         'Algodón 100%, tallas S-XXL',      299.00,  50),
    (3, 3, 'Café Artesanal 500g',    'Tueste medio, origen Oaxaca',     189.00,  100);
END
`;

async function setupDatabase() {
    try {
        const pool = await getConnection();
        console.log("⚙️   Creando esquema de base de datos...");
        await pool.request().query(schema);
        console.log("✅  Tablas y datos de prueba creados correctamente.");
        process.exit(0);
    } catch (err) {
        console.error("❌  Error en setup:", err.message);
        process.exit(1);
    }
}

setupDatabase();
