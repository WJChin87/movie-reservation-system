require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const db = require("../config/database");

async function runMigrations() {
  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, "migrations");
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    // Run each migration in a transaction
    for (const file of sqlFiles) {
      console.log(`Running migration: ${file}`);
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");

      await db.transaction(async (client) => {
        await client.query(sql);
      });

      console.log(`✓ Migration ${file} completed`);
    }

    console.log("\nAll migrations completed successfully! 🎉");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
