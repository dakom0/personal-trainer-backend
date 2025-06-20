const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bookings.db');

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS bookings`);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      user_id INTEGER
    )
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT
  )
`);

});

module.exports = db;