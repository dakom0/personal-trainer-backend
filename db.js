const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

const isProduction = process.env.NODE_ENV === 'production';

let db;
let query;
let get;
let all;
let run;

if (isProduction) {
  // --- Production: PostgreSQL on Heroku ---
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set for production.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  console.log('Connected to the PostgreSQL database.');

  // Compatibility layer to mimic node-sqlite3 API
  query = (sql, params = []) => pool.query(sql, params);

  get = async (sql, params = [], callback) => {
    try {
      const result = await pool.query(sql, params);
      callback(null, result.rows[0]);
    } catch (err) {
      callback(err, null);
    }
  };

  all = async (sql, params = [], callback) => {
    try {
      const result = await pool.query(sql, params);
      callback(null, result.rows);
    } catch (err) {
      callback(err, null);
    }
  };

  run = async (sql, params = [], callback) => {
    try {
      // For INSERT, we need to return the lastID. We assume the table has a primary key named 'id'.
      const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
      const querySql = isInsert ? `${sql} RETURNING id` : sql;

      const result = await pool.query(querySql, params);

      // Mimic sqlite3's 'this' context for the callback
      const context = {
        lastID: result.rows[0]?.id || null,
        changes: result.rowCount,
      };

      // The callback in sqlite3 is often called as function(err) { ... }, so 'this' is bound.
      callback.call(context, null);

    } catch (err) {
      callback.call({ lastID: null, changes: 0 }, err);
    }
  };

  db = { query, get, all, run };

} else {
  // --- Development: SQLite ---
  const sqliteDb = new sqlite3.Database('./bookings.db', (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the local SQLite database.');
  });

  db = sqliteDb; // Use the original sqlite3 object in development
}

module.exports = db;