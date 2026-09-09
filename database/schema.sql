-- ============================================================
-- POSLite — Esquema de base de datos (SQLite)
-- Versión consolidada tras revisión tabla por tabla
--
-- Convenciones:
--   * Nombres en español, snake_case
--   * Todas las PK: INTEGER PRIMARY KEY AUTOINCREMENT
--   * Dinero: INTEGER en colones (sin decimales)
--   * Cantidades: INTEGER en la unidad mínima según unidad_venta
--       - 'kg'     -> gramos      (ej. 500  = 0.500 kg)
--       - 'unidad' -> unidades    (ej. 3    = 3 unidades)
--   * Fechas/horas: TEXT en formato ISO 8601 (datetime('now'))
--   * Redondeo de venta: al múltiplo de ₡100 más cercano
--     (la fórmula exacta se aplica en la capa de servicios, no aquí)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- USUARIOS
-- ------------------------------------------------------------
CREATE TABLE usuarios (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre              TEXT    NOT NULL,
    usuario             TEXT    NOT NULL UNIQUE,
    contrasena_hash     TEXT    NOT NULL,
    rol                 TEXT    NOT NULL CHECK (rol IN ('administrador','empleado')),
    activo              INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- CATEGORÍAS DE PRODUCTO
-- ------------------------------------------------------------
CREATE TABLE categorias (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre  TEXT NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- PRODUCTOS
-- ------------------------------------------------------------
CREATE TABLE productos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre              TEXT    NOT NULL,
    categoria_id        INTEGER REFERENCES categorias(id),
    unidad_venta        TEXT    NOT NULL CHECK (unidad_venta IN ('kg','unidad')),
    precio_costo        INTEGER NOT NULL,               -- colones
    precio_venta        INTEGER NOT NULL,               -- colones, precio normal vigente
    codigo_barras       TEXT    UNIQUE,                 -- reservado, no se usa aún
    controla_inventario INTEGER NOT NULL DEFAULT 1 CHECK (controla_inventario IN (0,1)),
                                                         -- 0 = producto sin stock rastreable
                                                         -- (ej. caldosa/ceviche, picaritas/empaques)
    stock_minimo        INTEGER NOT NULL DEFAULT 0,      -- ignorado si controla_inventario = 0
    activo              INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
CREATE TABLE clientes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre              TEXT    NOT NULL,
    telefono            TEXT,
    activo              INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
                                                        -- solo para dejar de listarlo;
                                                        -- nunca se borra físicamente (historial)
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Precio especial permanente cliente-producto (distinto del descuento puntual de una venta).
-- Sin columna 'activo': el pescado varía seguido de precio, se actualiza con UPDATE directo.
CREATE TABLE clientes_precios_especiales (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id          INTEGER NOT NULL REFERENCES clientes(id),
    producto_id         INTEGER NOT NULL REFERENCES productos(id),
    precio_especial     INTEGER NOT NULL,               -- colones, por unidad_venta del producto
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (cliente_id, producto_id)
);

-- ------------------------------------------------------------
-- INVENTARIO
-- El stock actual NO se guarda como columna: se calcula sumando
-- estos movimientos (ver vista stock_actual más abajo). Así se
-- evita que un contador guardado se desincronice del dato real.
-- ------------------------------------------------------------
CREATE TABLE inventario_movimientos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id         INTEGER NOT NULL REFERENCES productos(id),
    tipo                TEXT    NOT NULL CHECK (tipo IN
                            ('entrada','venta','consumo_interno','merma','devolucion','ajuste')),
    cantidad            INTEGER NOT NULL,   -- positivo = entrada, negativo = salida
    referencia_venta_id INTEGER REFERENCES ventas(id),   -- solo si tipo IN ('venta','devolucion')
    nota                TEXT,
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE VIEW stock_actual AS
SELECT
    producto_id,
    SUM(cantidad) AS cantidad_disponible
FROM inventario_movimientos
GROUP BY producto_id;

-- ------------------------------------------------------------
-- VENTAS
-- Una venta nunca se edita: se cancela (con motivo obligatorio)
-- y se registra una venta nueva enlazada (venta_corregida_id).
-- ------------------------------------------------------------
CREATE TABLE ventas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora          TEXT    NOT NULL DEFAULT (datetime('now')),
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id),
    cliente_id          INTEGER REFERENCES clientes(id),        -- NULL si no aplica
    total_real          INTEGER NOT NULL,   -- suma exacta de subtotales
    total_cobrado        INTEGER NOT NULL,   -- después de redondeo (múltiplo de ₡100)
    estado              TEXT    NOT NULL DEFAULT 'completada'
                            CHECK (estado IN ('completada','cancelada')),
    motivo_cancelacion  TEXT,
    venta_corregida_id  INTEGER REFERENCES ventas(id),   -- venta nueva que reemplaza a una cancelada
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK (estado = 'completada' OR motivo_cancelacion IS NOT NULL)
);

CREATE TABLE venta_detalle (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id                 INTEGER NOT NULL REFERENCES ventas(id),
    producto_id              INTEGER NOT NULL REFERENCES productos(id),
    cantidad                 INTEGER NOT NULL,   -- unidad mínima del producto
    precio_normal_unitario   INTEGER NOT NULL,   -- precio_venta del producto en ese momento
    precio_aplicado_unitario INTEGER NOT NULL,   -- precio realmente cobrado
    motivo_precio_especial   TEXT,               -- obligatorio si aplicado <> normal (ver CHECK)
    subtotal                 INTEGER NOT NULL,
    CHECK (precio_aplicado_unitario = precio_normal_unitario OR motivo_precio_especial IS NOT NULL)
);

-- Pago dividido: una venta puede pagarse parte efectivo, parte SINPE, etc.
-- La suma de montos de una venta debe igualar total_cobrado (validado en servicios).
CREATE TABLE venta_pagos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id    INTEGER NOT NULL REFERENCES ventas(id),
    metodo_pago TEXT    NOT NULL CHECK (metodo_pago IN ('efectivo','sinpe','tarjeta')),
    monto       INTEGER NOT NULL
);

-- Al cancelar una venta, esta regla de integridad (no de negocio a practicar)
-- restaura automáticamente el inventario de los productos que sí lo controlan.
CREATE TRIGGER trg_venta_cancelada_restaura_inventario
AFTER UPDATE OF estado ON ventas
WHEN NEW.estado = 'cancelada' AND OLD.estado = 'completada'
BEGIN
    INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, referencia_venta_id, nota, usuario_id)
    SELECT
        vd.producto_id,
        'devolucion',
        vd.cantidad,
        NEW.id,
        'Reversión automática por cancelación de venta',
        NEW.usuario_id
    FROM venta_detalle vd
    JOIN productos p ON p.id = vd.producto_id
    WHERE vd.venta_id = NEW.id
      AND p.controla_inventario = 1;
END;

-- ------------------------------------------------------------
-- PEDIDOS (agenda/recordatorio — sin ningún vínculo con ventas)
-- ------------------------------------------------------------
CREATE TABLE pedidos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id          INTEGER NOT NULL REFERENCES clientes(id),
    fecha_creado        TEXT    NOT NULL DEFAULT (datetime('now')),
    fecha_recoger       TEXT    NOT NULL,
    estado              TEXT    NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','preparado','entregado','cancelado')),
    notas               TEXT
);

CREATE TABLE pedido_detalle (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id           INTEGER NOT NULL REFERENCES pedidos(id),
    producto_id         INTEGER NOT NULL REFERENCES productos(id),
    cantidad            INTEGER NOT NULL,
    precio_pactado      INTEGER   -- NULL = pendiente de negociar al momento de la venta
);

-- ------------------------------------------------------------
-- GASTOS
-- Casi siempre corresponden a compras de mercadería, pero se
-- mantienen separados de inventario_movimientos a propósito
-- (sin FK entre ambos) — se registran por aparte.
-- ------------------------------------------------------------
CREATE TABLE gastos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora          TEXT    NOT NULL DEFAULT (datetime('now')),
    categoria           TEXT    NOT NULL,
    monto               INTEGER NOT NULL,   -- colones
    metodo_pago         TEXT    NOT NULL CHECK (metodo_pago IN ('efectivo','sinpe','tarjeta')),
    origen_fondos       TEXT    NOT NULL CHECK (origen_fondos IN ('caja','externo')) DEFAULT 'caja',
                                                        -- 'externo' = dinero del jefe, no resta la caja
    descripcion         TEXT,
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id)
);

-- ------------------------------------------------------------
-- CAJA (apertura/cierre en una sola tabla con estado)
-- ------------------------------------------------------------
CREATE TABLE caja_cierres (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_hora_apertura     TEXT    NOT NULL DEFAULT (datetime('now')),
    fecha_hora_cierre       TEXT,                -- NULL mientras sigue abierta
    usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),
    monto_apertura          INTEGER NOT NULL,    -- fondo fijo (~₡25.000) + monedas del cierre anterior
    estado                  TEXT    NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
    total_ventas_efectivo   INTEGER,
    total_ventas_sinpe      INTEGER,
    total_ventas_tarjeta    INTEGER,
    total_gastos_caja       INTEGER,             -- solo gastos con origen_fondos = 'caja'
    cantidad_ventas         INTEGER,
    efectivo_esperado       INTEGER,             -- monto_apertura + ventas_efectivo - gastos_caja
    efectivo_contado        INTEGER,             -- total físico contado al cerrar
    diferencia              INTEGER,             -- efectivo_contado - efectivo_esperado
    monto_dejado_siguiente  INTEGER              -- cuánto se deja físicamente para la próxima apertura
);

-- Nunca puede haber más de una caja abierta a la vez
CREATE UNIQUE INDEX idx_una_sola_caja_abierta
    ON caja_cierres(estado)
    WHERE estado = 'abierta';

-- ------------------------------------------------------------
-- ÍNDICES básicos (ampliar según patrones de consulta reales)
-- ------------------------------------------------------------
CREATE INDEX idx_ventas_fecha ON ventas(fecha_hora);
CREATE INDEX idx_venta_detalle_venta ON venta_detalle(venta_id);
CREATE INDEX idx_venta_pagos_venta ON venta_pagos(venta_id);
CREATE INDEX idx_inventario_producto ON inventario_movimientos(producto_id);
CREATE INDEX idx_pedido_detalle_pedido ON pedido_detalle(pedido_id);
CREATE INDEX idx_pedidos_fecha_recoger ON pedidos(fecha_recoger);
