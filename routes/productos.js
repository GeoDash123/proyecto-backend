// src/routes/productos.js
const express = require("express");
const router = express.Router();
const { sql, getConnection } = require("../database/connection");

// ── GET /api/productos ──────────────────────────────────────────
// Soporta ?categoria_id=X  &  ?vendedor_id=Y  &  ?buscar=texto
router.get("/", async (req, res) => {
    try {
        const { categoria_id, vendedor_id, buscar } = req.query;
        const pool = await getConnection();
        const req2 = pool.request();

        let where = "WHERE p.activo = 1";
        if (categoria_id) { where += " AND p.categoria_id = @cat"; req2.input("cat", sql.Int, categoria_id); }
        if (vendedor_id)  { where += " AND p.vendedor_id  = @ven"; req2.input("ven", sql.Int, vendedor_id);  }
        if (buscar)       { where += " AND p.nombre LIKE @bus";    req2.input("bus", sql.NVarChar, `%${buscar}%`); }

        const result = await req2.query(`
      SELECT p.*, v.nombre AS vendedor, c.nombre AS categoria
      FROM   productos p
      JOIN   vendedores  v ON v.id = p.vendedor_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      ${where}
      ORDER BY p.fecha_creacion DESC
    `);
        res.json({ ok: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── GET /api/productos/:id ──────────────────────────────────────
router.get("/:id", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query(`
        SELECT p.*, v.nombre AS vendedor, c.nombre AS categoria
        FROM   productos p
        JOIN   vendedores  v ON v.id = p.vendedor_id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE  p.id = @id
      `);
        if (!result.recordset.length)
            return res.status(404).json({ ok: false, error: "Producto no encontrado" });
        res.json({ ok: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── POST /api/productos ─────────────────────────────────────────
router.post("/", async (req, res) => {
    const { vendedor_id, categoria_id, nombre, descripcion, precio, stock } = req.body;
    if (!vendedor_id || !nombre || precio === undefined)
        return res.status(400).json({ ok: false, error: "vendedor_id, nombre y precio son obligatorios" });

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("vendedor_id",  sql.Int,           vendedor_id)
            .input("categoria_id", sql.Int,           categoria_id || null)
            .input("nombre",       sql.NVarChar(200), nombre)
            .input("descripcion",  sql.NVarChar(1000),descripcion || null)
            .input("precio",       sql.Decimal(10,2), precio)
            .input("stock",        sql.Int,           stock ?? 0)
            .query(`
        INSERT INTO productos (vendedor_id, categoria_id, nombre, descripcion, precio, stock)
        OUTPUT INSERTED.*
        VALUES (@vendedor_id, @categoria_id, @nombre, @descripcion, @precio, @stock)
      `);
        res.status(201).json({ ok: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── PUT /api/productos/:id ──────────────────────────────────────
router.put("/:id", async (req, res) => {
    const { nombre, descripcion, precio, stock, activo, categoria_id } = req.body;
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input("id",           sql.Int,           req.params.id)
            .input("nombre",       sql.NVarChar(200), nombre)
            .input("descripcion",  sql.NVarChar(1000),descripcion || null)
            .input("precio",       sql.Decimal(10,2), precio)
            .input("stock",        sql.Int,           stock)
            .input("activo",       sql.Bit,           activo ?? 1)
            .input("categoria_id", sql.Int,           categoria_id || null)
            .query(`
        UPDATE productos
        SET nombre=@nombre, descripcion=@descripcion, precio=@precio,
            stock=@stock, activo=@activo, categoria_id=@categoria_id
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
        if (!result.recordset.length)
            return res.status(404).json({ ok: false, error: "Producto no encontrado" });
        res.json({ ok: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ── DELETE /api/productos/:id ───────────────────────────────────
router.delete("/:id", async (req, res) => {
    try {
        const pool = await getConnection();
        // Soft delete: solo desactivar
        const result = await pool.request()
            .input("id", sql.Int, req.params.id)
            .query("UPDATE productos SET activo=0 OUTPUT INSERTED.id WHERE id=@id");
        if (!result.recordset.length)
            return res.status(404).json({ ok: false, error: "Producto no encontrado" });
        res.json({ ok: true, message: "Producto desactivado" });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;