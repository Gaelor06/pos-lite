const PRODUCTOS_INICIALES = [
    ['Camarón Jumbo', 'Mariscos', 'kg', 21500],
    ['Camarón Juvenil', 'Mariscos', 'kg', 13000],
    ['Camarón Pinky Taylon', 'Mariscos', 'kg', 9500],
    ['Camarón Pinky Cáscara', 'Mariscos', 'kg', 9500],
    ['Camarón Pinky PYD', 'Mariscos', 'kg', 8500],
    ['Camarón Laguna PYD', 'Mariscos', 'kg', 8000],
    ['Camarón Laguna PYD PEQ', 'Mariscos', 'kg', 7500],
    ['Camarón Fidel PYD', 'Mariscos', 'kg', 8000],
    ['Cola de Langosta', 'Mariscos', 'kg', 22500],
    ['Almejas', 'Mariscos', 'kg', 4500],
    ['Mejillón Negro', 'Mariscos', 'kg', 4000],
    ['Mejillón Blanco', 'Mariscos', 'kg', 4500],
    ['Jaibas', 'Mariscos', 'kg', 3500],
    ['Mariscada 1,7 kg', 'Mariscos', 'unidad', 8000],
    ['Mariscada 0,850 kg', 'Mariscos', 'unidad', 4000],
    ['Aros de Calamar', 'Mariscos', 'kg', 6500],
    ['Calamar Gigante', 'Mariscos', 'kg', 6000],
    ['Tentáculo de Calamar', 'Mariscos', 'kg', 6000],
    ['Pulpo', 'Mariscos', 'kg', 12500],
    ['Agalla', 'Mariscos', 'kg', 2000],
    ['Cabeza Pargo', 'Mariscos', 'kg', 2500],
    ['Cabeza', 'Mariscos', 'kg', 2000],
    ['Panzas Blancas', 'Mariscos', 'kg', 4500],
    ['Panzas Rosadas', 'Mariscos', 'kg', 3000],
    ['Pianguas 50 U.', 'Mariscos', 'kg', 3500],
    ['Huevos de Tortuga - Bolsa', 'Mariscos', 'unidad', 300],
    ['Huevos de Tortuga - Suelto', 'Mariscos', 'unidad', 300],
    ['Recortes', 'Mariscos', 'kg', 1000],
    ['Marlin Blanco Filet', 'Pescado base', 'kg', 16500],
    ['Marlin Blanco Picado', 'Pescado base', 'kg', 16500],
    ['Marlin Rosado Filet', 'Pescado base', 'kg', 7500],
    ['Marlin Rosado Picado', 'Pescado base', 'kg', 7500],
    ['Dorado Filet', 'Pescado base', 'kg', 11000],
    ['Dorado Picado', 'Pescado base', 'kg', 11000],
    ['Vela Filet', 'Pescado base', 'kg', 6500],
    ['Vela Picado', 'Pescado base', 'kg', 6500],
    ['Bolillo Filet', 'Pescado base', 'kg', 4500],
    ['Bolillo Picado', 'Pescado base', 'kg', 4500],
    ['Bolillo Chuleta Filet', 'Pescado base', 'kg', 4500],
    ['Tresher', 'Pescado base', 'kg', 8000],
    ['Corvina Filete', 'Pescado base', 'kg', 13500],
    ['Congrio', 'Pescado base', 'kg', 10500],
    ['Tilapia', 'Pescado base', 'kg', 2900],
    ['Pargo Filet', 'Pescado base', 'kg', 10500],
    ['Atún', 'Pescado base', 'kg', 10500],
    ['Lenguado', 'Pescado base', 'kg', 4900],
    ['Segunda / Chatarra', 'Pescado base', 'kg', 4500],
    ['Corvina Entera', 'Pescado base', 'kg', 6500],
    ['Macarela', 'Pescado base', 'kg', 4500],
    ['Pargo 01', 'Pescado base', 'kg', 7500],
    ['Caja Tilapia', 'Pescado base', 'unidad', 10500]
];

function sembrarProductos(db) {
    const insertarCategoria = db.prepare('INSERT OR IGNORE INTO categorias (nombre) VALUES (?)');
    const obtenerCategoria = db.prepare('SELECT id FROM categorias WHERE nombre = ?');
    const categoriaPescado = db.prepare("SELECT id, nombre FROM categorias WHERE lower(nombre) IN ('pescado', 'pescados', 'pescado base') ORDER BY CASE lower(nombre) WHEN 'pescado' THEN 0 WHEN 'pescados' THEN 1 ELSE 2 END LIMIT 1");
    const renombrarPescadoBase = db.prepare("UPDATE categorias SET nombre = 'Pescado' WHERE lower(nombre) = 'pescado base' AND NOT EXISTS (SELECT 1 FROM categorias WHERE lower(nombre) IN ('pescado', 'pescados'))");
    const categoriasMarisco = db.prepare("SELECT id, nombre FROM categorias WHERE lower(nombre) IN ('marisco', 'mariscos') ORDER BY CASE lower(nombre) WHEN 'marisco' THEN 0 ELSE 1 END");
    const moverProductos = db.prepare('UPDATE productos SET categoria_id = ? WHERE categoria_id = ?');
    const eliminarCategoria = db.prepare('DELETE FROM categorias WHERE id = ?');
    const renombrarMarisco = db.prepare("UPDATE categorias SET nombre = 'Marisco' WHERE id = ?");
    const existeProducto = db.prepare('SELECT id FROM productos WHERE nombre = ?');
    const insertarProducto = db.prepare(`
        INSERT INTO productos
            (nombre, categoria_id, unidad_venta, precio_costo, precio_venta, controla_inventario, stock_minimo)
        VALUES (?, ?, ?, 0, ?, 1, ?)
    `);

    const sembrar = db.transaction(() => {
        renombrarPescadoBase.run();
        const mariscos = categoriasMarisco.all();
        if (mariscos.length > 0) {
            const categoriaPrincipal = mariscos[0];
            for (const duplicada of mariscos.slice(1)) {
                moverProductos.run(categoriaPrincipal.id, duplicada.id);
                eliminarCategoria.run(duplicada.id);
            }
            if (categoriaPrincipal.nombre.toLowerCase() !== 'marisco') {
                renombrarMarisco.run(categoriaPrincipal.id);
            }
        }
        for (const [nombre, categoria, unidad, precio] of PRODUCTOS_INICIALES) {
            if (existeProducto.get(nombre)) continue;
            const categoriaExistente = categoria === 'Pescado base'
                ? categoriaPescado.get()
                : categoriasMarisco.all()[0] || obtenerCategoria.get(categoria);
            if (!categoriaExistente) insertarCategoria.run(categoria === 'Pescado base' ? 'Pescado' : 'Marisco');
            const categoriaId = categoria === 'Pescado base'
                ? categoriaPescado.get().id
                : (categoriasMarisco.all()[0] || obtenerCategoria.get('Marisco')).id;
            insertarProducto.run(nombre, categoriaId, unidad, precio, unidad === 'kg' ? 1000 : 1);
        }
    });
    sembrar();
}

module.exports = sembrarProductos;