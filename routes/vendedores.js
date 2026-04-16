// routes/vendedores.js
const express = require("express");
const router = express.Router();
const { sql, getConnection } = require("../database/connection");

/**
 * @swagger
 * tags:
 *   name: Vendedores
 *   description: Gestión de vendedores
 */

/**
 * @swagger
 * /api/vendedores:
 *   get:
 *     summary: Obtener todos los vendedores
 *     tags: [Vendedores]
 *     responses:
 *       200:
 *         description: Lista de vendedores
 */
router.get("/", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
      SELECT v.id, v.nombre, v.email, v.telefono, v.descripcion,
             v.activo, v.fecha_registro,
             COUNT(p.id) AS total_productos
      FROM   vendedores v
      LEFT JOIN productos p ON p.vendedor_id = v.id AND p.activo = 1
      GROUP BY v.id, v.nombre, v.email, v.telefono, v.descripcion,
               v.activo, v.fecha_registro
      ORDER BY v.fecha_registro DESC
    `);
        res.json({ ok: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * @swagger
 * /api/vendedores/{id}:
 *   get:
 *     summary: Obtener un vendedor por ID
 *     tags: [Vendedores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Vendedor encontrado
 *       404:
 *         description: Vendedor no encontrado
 */
router.get("/:id", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool
            .request()
            .input("id", sql.Int, req.params.id)
            .query("SELECT * FROM vendedores WHERE id = @id");

        if (!result.recordset.length)
            return res.status(404).json({ ok: false, error: "Vendedor no encontrado" });

        res.json({ ok: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * @swagger
 * /api/vendedores:
 *   post:
 *     summary: Crear un nuevo vendedor
 *     tags: [Vendedores]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email]
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Tienda Tech MX"
 *               email:
 *                 type: string
 *                 example: "tech@tienda.mx"
 *               telefono:
 *                 type: string
 *                 example: "664-100-0001"
 *               descripcion:
 *                 type: string
 *                 example: "Electrónica y gadgets"
 *     responses:
 *       201:
 *         description: Vendedor creado
 *       409:
 *         description: Email ya registrado
 */
router.post("/", async (req, res) => {
    const { nombre, email, telefono, descripcion } = req.body;
    if (!nombre || !email)
        return res.status(400).json({ ok: false, error: "nombre y email son obligatorios" });

    try {
        const pool = await getConnection();
        const result = await pool
            .request()
            .input("nombre",      sql.NVarChar(120), nombre)
            .input("email",       sql.NVarChar(180), email)
            .input("telefono",    sql.NVarChar(30),  telefono  || null)
            .input("descripcion", sql.NVarChar(500), descripcion || null)
            .query(`
        INSERT INTO vendedores (nombre, email, telefono, descripcion)
        OUTPUT INSERTED.*
        VALUES (@nombre, @email, @telefono, @descripcion)
      `);
        res.status(201).json({ ok: true, data: result.recordset[0] });
    } catch (err) {
        if (err.number === 2627)
            return res.status(409).json({ ok: false, error: "El email ya está registrado" });
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * @swagger
 * /api/vendedores/{id}:
 *   put:
 *     summary: Actualizar un vendedor
 *     tags: [Vendedores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *               telefono:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Vendedor actualizado
 *       404:
 *         description: Vendedor no encontrado
 */
router.put("/:id", async (req, res) => {
    const { nombre, email, telefono, descripcion, activo } = req.body;
    try {
        const pool = await getConnection();
        const result = await pool
            .request()
            .input("id",          sql.Int,           req.params.id)
            .input("nombre",      sql.NVarChar(120), nombre)
            .input("email",       sql.NVarChar(180), email)
            .input("telefono",    sql.NVarChar(30),  telefono   || null)
            .input("descripcion", sql.NVarChar(500), descripcion || null)
            .input("activo",      sql.Bit,           activo ?? 1)
            .query(`
        UPDATE vendedores
        SET nombre = @nombre, email = @email, telefono = @telefono,
            descripcion = @descripcion, activo = @activo
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
        if (!result.recordset.length)
            return res.status(404).json({ ok: false, error: "Vendedor no encontrado" });
        res.json({ ok: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * @swagger
 * /api/vendedores/{id}:
 *   delete:
 *     summary: Eliminar un vendedor
 *     tags: [Vendedores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Vendedor eliminado
 *       404:
 *         description: Vendedor no encontrado
 */
router.delete("/:id", async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool
            .request()
            .input("id", sql.Int, req.params.id)
            .query("DELETE FROM vendedores OUTPUT DELETED.id WHERE id = @id");
        if (!result.recordset.length)
            return res.status(404).json({ ok: false, error: "Vendedor no encontrado" });
        res.json({ ok: true, message: "Vendedor eliminado" });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;