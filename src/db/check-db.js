const pool = require("../config/database");

async function checkDatabase() {
  try {
    console.log("Checking database connection and structure...");

    // Test connection
    const client = await pool.connect();
    console.log("Successfully connected to database");

    // Check if tables exist
    const tables = ["users", "movies", "genres", "movie_genres"];
    for (const table of tables) {
      const result = await client.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `,
        [table]
      );

      console.log(`Table ${table} exists:`, result.rows[0].exists);
    }

    client.release();
    process.exit(0);
  } catch (err) {
    console.error("Error checking database:", err);
    process.exit(1);
  }
}

checkDatabase();
