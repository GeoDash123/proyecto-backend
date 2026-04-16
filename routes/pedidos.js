// src/routes/pedidos.js
const express = require("express");
const router = express.Router();
const { sql, getConnection } = require("../database/connection");

// ── GET /api/pedidos ────────────────────────────────────────────
router.get("/", async (req, res) => {
    try {
        const { estado, cliente_id } = req.query;
        const pool = await getConnection();
        const req2 = pool.request();

        let where = "WHERE 1=1";
        if (estado)     { where += " AND p.estado = @estado";         req2.input("estado",    sql.NVarChar(30), estado);     }
        if (cliente_id) { where += " AND p.cliente_id = @cliente_id"; req2.input("cliente_id",sql.Int,          cliente_id); }

        const result = await req2.query(`
      SELECT p.id, p.estado, p.total, p.fecha_pedido,
             c.nombre AS cliente, c.email AS cliente_email
      FROM   pedidos p
      JOIN   clientes c ON c.id = p.cliente_id
      ${where}
      ORDER BY p.fecha_pedido DESC
    `);
        res.json({ ok: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── GET /api/pedidos/:id ────────────────────────────────────────
// Devuelve el pedido con su detalle completo
router.get("/:id", async (req, res) => {
    try {
        const pool = await getConnection();

        const pedido = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
        SELECT p.*, c.nombre AS cliente, c.email AS cliente_email, c.telefono AS cliente_tel
        FROM   pedidos p JOIN clientes c ON c.id = p.cliente_id
        WHERE  p.id = @id
      `);
        if (!pedido.recordset.length)
            return res.status(404).json({ ok: false, error: "Pedido no encontrado" });

        const detalle = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
        SELECT d.id, d.cantidad, d.precio_unit, d.subtotal,
               pr.nombre AS producto, pr.id AS producto_id
        FROM   pedido_detalle d
        JOIN   productos pr ON pr.id = d.producto_id
        WHERE  d.pedido_id = @id
      `);

        res.json({ ok: true, data: { ...pedido.recordset[0], detalle: detalle.recordset } });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── POST /api/pedidos ───────────────────────────────────────────
// Body: { cliente_id, items: [{ producto_id, cantidad }] }
router.post("/", async (req, res) => {
    const { cliente_id, items } = req.body;
    if (!cliente_id || !Array.isArray(items) || !items.length)
        return res.status(400).json({ ok: false, error: "cliente_id e items[] son obligatorios" });

    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const req2 = new sql.Request(transaction);

        // 1. Crear cabecera del pedido
        const cabecera = await req2
            .input("cliente_id", sql.Int, cliente_id)
            .query(`
        INSERT INTO pedidos (cliente_id) OUTPUT INSERTED.id VALUES (@cliente_id)
      `);
        const pedido_id = cabecera.recordset[0].id;

        let total = 0;

        // 2. Insertar cada línea y descontar stock
        for (const item of items) {
            const req3 = new sql.Request(transaction);

            // Verificar stock disponible
            const stockRes = await req3
                .input("pid", sql.Int, item.producto_id)
                .query("SELECT precio, stock FROM productos WHERE id=@pid AND activo=1");

            if (!stockRes.recordset.length)
                throw new Error(`Producto ID ${item.producto_id} no encontrado o inactivo`);

            const { precio, stock } = stockRes.recordset[0];
            if (stock < item.cantidad)
                throw new Error(`Stock insuficiente para producto ID ${item.producto_id} (disponible: ${stock})`);

            const req4 = new sql.Request(transaction);
            await req4
                .input("pedido_id",   sql.Int,          pedido_id)
                .input("producto_id", sql.Int,          item.producto_id)
                .input("cantidad",    sql.Int,          item.cantidad)
                .input("precio_unit", sql.Decimal(10,2),precio)
                .query(`
          INSERT INTO pedido_detalle (pedido_id, producto_id, cantidad, precio_unit)
          VALUES (@pedido_id, @producto_id, @cantidad, @precio_unit)
        `);

            // Descontar stock
            const req5 = new sql.Request(transaction);
            await req5
                .input("cant", sql.Int, item.cantidad)
                .input("pid",  sql.Int, item.producto_id)
                .query("UPDATE productos SET stock = stock - @cant WHERE id=@pid");

            total += precio * item.cantidad;
        }

        // 3. Actualizar total en cabecera
        const req6 = new sql.Request(transaction);
        await req6
            .input("total",    sql.Decimal(10,2), total)
            .input("pedido_id",sql.Int,           pedido_id)
            .query("UPDATE pedidos SET total=@total WHERE id=@pedido_id");

        await transaction.commit();
        res.status(201).json({ ok: true, data: { id: pedido_id, total } });

    } catch (err) {
        await transaction.rollback();
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ── PATCH /api/pedidos/:id/estado ──────────────────────────────
// Actualiza solo el estado del pedido
router.patch("/:id/estado", async (req, res) => {
    const { estado } = req.body;
    const validos = ["pendiente","pagado","enviado","entregado","cancelado"];
    if (!validos.includes(estado))
        return res.status(400).json({ ok: false, error: `Estado inválido. Opciones: ${validos.join(", ")}` });

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id",     sql.Int,          req.params.id)
            .input("estado", sql.NVarChar(30), estado)
            .query(`
        UPDATE pedidos
        SET estado=@estado, fecha_actualizacion=GETDATE()
        OUTPUT INSERTED.*
        WHERE id=@id
      `);
        if (!result.recordset.length)
            return res.status(404).json({ ok: false, error: "Pedido no encontrado" });
        res.json({ ok: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
