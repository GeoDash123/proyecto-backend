// swagger.js
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Marketplace API",
            version: "1.0.0",
            description: "API REST para gestión de vendedores, productos y pedidos",
        },
        servers: [
            { url: "http://localhost:3000", description: "Servidor local" }
        ],
    },
    apis: ["./routes/*.js"],  // Lee los comentarios JSDoc de tus rutas
};

module.exports = swaggerJsdoc(options);