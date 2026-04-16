// src/database/connection.js
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const sql = require("mssql");

// ← Agrega esto temporalmente
console.log("DB_SERVER:", process.env.DB_SERVER);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);

const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let pool = null;

/**
 * Retorna el pool de conexión (singleton).
 * Si no existe, lo crea y lo guarda para reutilizarlo.
 */
async function getConnection() {
    if (pool) return pool;

    try {
        pool = await sql.connect(config);
        console.log("✅  Conexión a SQL Server establecida correctamente.");
        return pool;
    } catch (err) {
        console.error("❌  Error al conectar con SQL Server:", err.message);
        throw err;
    }
}

/**
 * Cierra el pool de conexión (útil al apagar el servidor).
 */
async function closeConnection() {
    if (pool) {
        await pool.close();
        pool = null;
        console.log("🔌  Conexión a SQL Server cerrada.");
    }
}

module.exports = { sql, getConnection, closeConnection };
