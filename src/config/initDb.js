require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

async function initializeDatabase() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, "init.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the SQL commands
    await pool.query(sql);

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
