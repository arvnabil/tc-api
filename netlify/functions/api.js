// File ini berfungsi sebagai "pembungkus" untuk aplikasi Express Anda
// agar bisa berjalan sebagai Netlify Function.

const serverless = require("serverless-http");
const app = require("../../server"); // Mengimpor aplikasi Express dari server.js

// Mengekspor handler yang akan digunakan oleh Netlify
module.exports.handler = serverless(app);
