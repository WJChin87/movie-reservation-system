const { Pool, types } = require("pg");

// Validate required environment variables
const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Add parser for custom types
types.setTypeParser(types.builtins.INT8, (val) => parseInt(val));
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));

// Add custom type parsers for enums
const parseEnum = (enumValue) => enumValue;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || "5432"),
  // Add connection error handling
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Add pool error handler
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Get the OIDs for our custom types
pool
  .query(
    `SELECT t.oid, t.typname
     FROM pg_type t
     JOIN pg_namespace n ON t.typnamespace = n.oid
     WHERE t.typname IN ('user_role')
     AND n.nspname = 'public'`
  )
  .then((result) => {
    result.rows.forEach((row) => {
      types.setTypeParser(row.oid, parseEnum);
    });
  })
  .catch((err) => {
    console.error("Error setting up enum parsers:", err);
  });

// Helper functions for common database operations
const db = {
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log("Executed query", {
        text: text.replace(/\s+/g, " ").trim(),
        params,
        duration,
        rows: res.rowCount,
      });
      return res;
    } catch (error) {
      console.error("Error executing query", {
        text: text.replace(/\s+/g, " ").trim(),
        params,
        error: error.message,
        code: error.code,
        detail: error.detail,
      });
      throw error;
    }
  },

  getClient: async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;

    // Set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout(() => {
      console.error("A client has been checked out for more than 5 seconds!");
      console.error(
        `The last executed query on this client was: ${client.lastQuery}`
      );
    }, 5000);

    // Monkey patch the query method to keep track of the last query executed
    client.query = (...args) => {
      client.lastQuery = args;
      return query.apply(client, args);
    };

    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release.apply(client);
    };

    return client;
  },

  transaction: async (callback) => {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  // Add health check method
  healthCheck: async () => {
    try {
      await pool.query("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  },
};

module.exports = db;
