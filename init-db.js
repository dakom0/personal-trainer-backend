require('dotenv').config();
const { Pool } = require('pg');

const createTables = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  );
`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

console.log('Connecting to database to initialize schema...');

pool.query(createTables)
  .then(() => {
    console.log('Tables created successfully (if they did not exist).');
    pool.end();
  })
  .catch((err) => {
    console.error('Error creating tables:', err);
    pool.end();
  }); 