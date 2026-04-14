/*
 DATABASE CONNECTION - PostgreSQL Pool Configuration
 =================================================
 Centralized database connection using pg Pool for efficient connection management.
 This handles multiple concurrent connections automatically.
 */
const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",           // Database username
  host: "localhost",          // Localhost for development
  database: "tic-tac-toe",    // Database name
  password: "postgres",       // Default password (CHANGE IN PRODUCTION!)
  port: 5432,                 // Default PostgreSQL port
});

module.exports = pool;