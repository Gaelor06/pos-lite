const db = require('../../database/db');

function usuarioActivo(usuarioId) {
    const solicitado = Number(usuarioId);
    const id = solicitado > 0
        ? solicitado
        : db.prepare('SELECT id FROM usuarios WHERE activo = 1 ORDER BY id LIMIT 1').get()?.id;
    if (!db.prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1').get(id)) {
        throw new Error('El usuario de Caja no es válido');
    }
    return id;
}

function obtenerAbierta() {
    return db.prepare(`
        SELECT cc.*, u.nombre AS usuario_nombre
        FROM caja_cierres cc
        JOIN usuarios u ON u.id = cc.usuario_id
        WHERE cc.estado = 'abierta'
    `).get();
}

function obtenerResumenDesde(fechaInicio, fechaFin = "datetime('now')") {
    const ventas = db.prepare(`
        SELECT
            COALESCE(SUM(CASE WHEN vp.metodo_pago = 'efectivo' THEN vp.monto ELSE 0 END), 0) AS ventas_efectivo,
            COALESCE(SUM(CASE WHEN vp.metodo_pago = 'sinpe' THEN vp.monto ELSE 0 END), 0) AS ventas_sinpe,
            COALESCE(SUM(CASE WHEN vp.metodo_pago = 'tarjeta' THEN vp.monto ELSE 0 END), 0) AS ventas_tarjeta,
            COALESCE(SUM(vp.monto), 0) AS total_ventas,
            COUNT(DISTINCT v.id) AS cantidad_ventas
        FROM ventas v
        JOIN venta_pagos vp ON vp.venta_id = v.id
        WHERE v.estado = 'completada'
          AND v.fecha_hora >= ? AND v.fecha_hora <= ${fechaFin}
    `).get(fechaInicio);

    const gastos = db.prepare(`
        SELECT COALESCE(SUM(monto), 0) AS gastos_caja
        FROM gastos
        WHERE origen_fondos = 'caja' AND metodo_pago = 'efectivo'
          AND fecha_hora >= ? AND fecha_hora <= ${fechaFin}
    `).get(fechaInicio);

    return { ...ventas, gastos_caja: gastos.gastos_caja };
}

function estadoActual() {
    const caja = obtenerAbierta();
    if (!caja) return { abierta: false, caja: null, resumen: null };
    const resumen = obtenerResumenDesde(caja.fecha_hora_apertura);
    return {
        abierta: true,
        caja,
        resumen: {
            ...resumen,
            efectivo_esperado: caja.monto_apertura + resumen.ventas_efectivo - resumen.gastos_caja
        }
    };
}

function abrir({ monto_apertura, usuario_id }) {
    const monto = Number(monto_apertura);
    if (!Number.isInteger(monto) || monto < 0) throw new Error('El monto de apertura no es válido');
    if (obtenerAbierta()) throw new Error('Ya existe una caja abierta');

    const resultado = db.prepare(`
        INSERT INTO caja_cierres (usuario_id, monto_apertura, estado)
        VALUES (?, ?, 'abierta')
    `).run(usuarioActivo(usuario_id), monto);
    return db.prepare('SELECT * FROM caja_cierres WHERE id = ?').get(resultado.lastInsertRowid);
}

function cerrar({ efectivo_contado, monto_dejado_siguiente, usuario_id }) {
    const contado = Number(efectivo_contado);
    const dejado = monto_dejado_siguiente === undefined || monto_dejado_siguiente === null || monto_dejado_siguiente === ''
        ? null
        : Number(monto_dejado_siguiente);
    if (!Number.isInteger(contado) || contado < 0) throw new Error('El efectivo contado no es válido');
    if (dejado !== null && (!Number.isInteger(dejado) || dejado < 0)) throw new Error('El monto dejado para la siguiente caja no es válido');

    const caja = obtenerAbierta();
    if (!caja) throw new Error('No hay una caja abierta');
    const resumen = obtenerResumenDesde(caja.fecha_hora_apertura);
    const efectivoEsperado = caja.monto_apertura + resumen.ventas_efectivo - resumen.gastos_caja;
    const diferencia = contado - efectivoEsperado;
    const usuarioId = usuarioActivo(usuario_id);

    db.prepare(`
        UPDATE caja_cierres
        SET fecha_hora_cierre = datetime('now'), estado = 'cerrada',
            cerrado_por_usuario_id = ?,
            total_ventas_efectivo = ?, total_ventas_sinpe = ?, total_ventas_tarjeta = ?,
            total_gastos_caja = ?, cantidad_ventas = ?, efectivo_esperado = ?,
            efectivo_contado = ?, diferencia = ?, monto_dejado_siguiente = ?
        WHERE id = ? AND estado = 'abierta'
    `).run(
        usuarioId, resumen.ventas_efectivo, resumen.ventas_sinpe, resumen.ventas_tarjeta,
        resumen.gastos_caja, resumen.cantidad_ventas, efectivoEsperado,
        contado, diferencia, dejado, caja.id
    );

    return obtenerPorId(caja.id);
}

function obtenerPorId(id) {
    return db.prepare(`
        SELECT cc.*, u.nombre AS usuario_nombre, uc.nombre AS cerrado_por_nombre
        FROM caja_cierres cc
        JOIN usuarios u ON u.id = cc.usuario_id
        LEFT JOIN usuarios uc ON uc.id = cc.cerrado_por_usuario_id
        WHERE cc.id = ?
    `).get(id);
}

function obtenerHistorial() {
    return db.prepare(`
        SELECT cc.*, u.nombre AS usuario_nombre, uc.nombre AS cerrado_por_nombre
        FROM caja_cierres cc
        JOIN usuarios u ON u.id = cc.usuario_id
        LEFT JOIN usuarios uc ON uc.id = cc.cerrado_por_usuario_id
        WHERE cc.estado = 'cerrada'
        ORDER BY cc.id DESC
        LIMIT 100
    `).all();
}

module.exports = { estadoActual, abrir, cerrar, obtenerHistorial, obtenerPorId };