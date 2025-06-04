const { Pool, types } = require("pg");

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
  port: 5432,
});

// Get the OIDs for our custom types
pool
  .query(
    `SELECT t.oid, t.typname
   FROM pg_type t
   JOIN pg_namespace n ON t.typnamespace = n.oid
   WHERE t.typname IN ('user_role', 'reservation_status')
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
      console.log("Executed query", { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error("Error executing query", { text, error });
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
};

module.exports = db;
