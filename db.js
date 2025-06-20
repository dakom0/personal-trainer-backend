const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

let db;

// Check if we are in the Heroku environment by looking for the DATABASE_URL
if (process.env.DATABASE_URL) {
  // Use PostgreSQL on Heroku
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Heroku Postgres
    }
  });

  pool.connect(err => {
    if (err) {
      console.error('Connection error', err.stack);
    } else {
      console.log('Connected to the PostgreSQL database.');
    }
  });

  // Export an object with the same interface as sqlite3
  db = {
    // The 'run' method for INSERT, UPDATE, DELETE
    run: (sql, params = [], callback) => {
      // The `run` callback in sqlite3 is function(err), where `this` holds metadata.
      // We can't perfectly replicate `this.lastID` for postgres without RETURNING id,
      // but we can provide rowCount for `this.changes`.
      pool.query(sql, params, (err, result) => {
        const context = {
          changes: result ? result.rowCount : 0
        };
        // The original callback is bound to the context object.
        callback.call(context, err);
      });
    },
    // The 'all' method for SELECT queries that return multiple rows
    all: (sql, params = [], callback) => {
      pool.query(sql, params, (err, result) => {
        callback(err, result ? result.rows : []);
      });
    },
    // The 'get' method for SELECT queries that return a single row
    get: (sql, params = [], callback) => {
      pool.query(sql, params, (err, result) => {
        callback(err, result && result.rows.length > 0 ? result.rows[0] : undefined);
      });
    }
  };

} else {
  // Use SQLite for local development
  db = new sqlite3.Database('./bookings.db', (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the local SQLite database.');
  });
}

module.exports = db;