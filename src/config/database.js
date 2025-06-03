const { Pool, types } = require("pg");

// Add parser for custom types
types.setTypeParser(types.builtins.INT8, (val) => parseInt(val));
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));

// Add custom type parsers for enums
const parseEnum = (enumValue) => enumValue;
const USER_ROLE_OID = null; // We'll get this from the database
const RESERVATION_STATUS_OID = null; // We'll get this from the database

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
    `
  SELECT t.oid, t.typname
  FROM pg_type t
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE t.typname IN ('user_role', 'reservation_status')
    AND n.nspname = 'public'
`
  )
  .then((result) => {
    result.rows.forEach((row) => {
      if (row.typname === "user_role") {
        types.setTypeParser(row.oid, parseEnum);
      } else if (row.typname === "reservation_status") {
        types.setTypeParser(row.oid, parseEnum);
      }
    });
  })
  .catch((err) => {
    console.error("Error setting up enum parsers:", err);
  });

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Successfully connected to PostgreSQL database");
    release();
  }
});

module.exports = pool;
