// src/server.js
require("dotenv").config();
const swaggerUi   = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const express = require("express");
const morgan  = require("morgan");
const cors    = require("cors");
const { getConnection, closeConnection } = require("./database/connection");

// ── Rutas ────────────────────────────────────────────────────────
const vendedoresRouter = require("./routes/vendedores");
const productosRouter  = require("./routes/productos");
const pedidosRouter    = require("./routes/pedidos");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Ruta de salud ────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({
        ok: true,
        message: "🛒  Marketplace API corriendo",
        version: "1.0.0",
        endpoints: {
            vendedores: "/api/vendedores",
            productos:  "/api/productos",
            pedidos:    "/api/pedidos",
        },
    });
});

// ── API Routes ───────────────────────────────────────────────────
app.use("/api/vendedores", vendedoresRouter);
app.use("/api/productos",  productosRouter);
app.use("/api/pedidos",    pedidosRouter);

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ ok: false, error: "Ruta no encontrada" });
});

// ── Error handler global ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
});

// ── Arranque ─────────────────────────────────────────────────────
async function start() {
    try {
        await getConnection();                         // Verificar DB al arrancar
        app.listen(PORT, () => {
            console.log(`\n🚀  Servidor corriendo en http://localhost:${PORT}`);
            console.log(`📦  Endpoints disponibles:`);
            console.log(`    GET  /api/vendedores`);
            console.log(`    GET  /api/productos`);
            console.log(`    GET  /api/pedidos\n`);
        });
    } catch (err) {
        console.error("No se pudo iniciar el servidor:", err.message);
        process.exit(1);
    }
}

// Cerrar conexión limpiamente al apagar
process.on("SIGINT",  async () => { await closeConnection(); process.exit(0); });
process.on("SIGTERM", async () => { await closeConnection(); process.exit(0); });

start();
