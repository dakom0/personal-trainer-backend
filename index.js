const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendBookingNotification } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 4000;

// Whitelist of allowed origins
const allowedOrigins = [
  'https://trainerpr0.netlify.app',
  'http://localhost:3000', // Assuming your local frontend runs on port 3000
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
};

app.use(cors(corsOptions));
app.use(express.json());

// --- AUTH MIDDLEWARE ---
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- LOGIN ENDPOINT ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username !== process.env.DASHBOARD_USER) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, process.env.DASHBOARD_PASS_HASH);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// --- BOOKINGS ENDPOINTS (PROTECTED) ---
app.get('/api/bookings', requireAuth, (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY date, time', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM bookings WHERE id = $1', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// --- PATCH: UPDATE BOOKING STATUS (PROTECTED) ---
app.patch('/api/bookings/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });
  db.run(
    'UPDATE bookings SET status = $1 WHERE id = $2',
    [status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

// --- PUBLIC: CREATE BOOKING ---
app.post('/api/bookings', requireClientAuth, (req, res) => {
  const { name, email, date, time, message, phone } = req.body;
  const userId = req.user.userId; // Get the user ID from the authenticated token

  console.log('Creating booking for user:', userId);
  console.log('Booking data:', { name, email, date, time, message, phone, userId });

  db.run(
    'INSERT INTO bookings (name, email, date, time, message, phone, status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [name, email, date, time, message, phone, 'pending', userId],
    function (err) {
      if (err) {
        console.error('Error creating booking:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Booking created successfully, ID:', this.lastID);
      // Send email notification
      sendBookingNotification({ name, email, date, time, message, phone })
        .then(() => res.json({ id: this.lastID }))
        .catch((emailErr) => {
          console.error("Email sending failed:", emailErr);
          res.status(500).json({ error: "Booking saved, but email failed to send." });
        });
    }
  );
});

// --- PUBLIC: USER REGISTRATION ---
app.post('/api/client/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)',
      [email, password_hash, name],
      function (err) {
        if (err) {
          console.error("REGISTRATION ERROR:", err);
          if (err.code === '23505') {
            return res.status(400).json({ error: 'Email already in use.' });
          }
          return res.status(500).json({ error: 'An error occurred during registration.' });
        }
        res.status(201).json({ id: this.lastID });
      }
    );
  } catch (error) {
    console.error("Server error during registration:", error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// --- PUBLIC: USER LOGIN ---
app.post('/api/client/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = $1', [email], async (err, user) => {
    if (err || !user) {
      console.error('Login error or user not found:', err);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, name: user.name });
  });
});

// --- PUBLIC: CLIENT BOOKINGS (AUTH REQUIRED) ---
function requireClientAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- CLIENT BOOKING CREATION ---
app.post('/api/client/bookings', requireClientAuth, (req, res) => {
  const { name, email, date, time, message, phone } = req.body;
  const userId = req.user.userId;

  console.log('Creating booking for user:', userId);
  console.log('Booking data:', { name, email, date, time, message, phone, userId });

  db.run(
    'INSERT INTO bookings (name, email, date, time, message, phone, status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [name, email, date, time, message, phone, 'pending', userId],
    function (err) {
      if (err) {
        console.error('Error creating booking:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('Booking created successfully, ID:', this.lastID);
      // Send email notification
      sendBookingNotification({ name, email, date, time, message, phone })
        .then(() => res.json({ id: this.lastID }))
        .catch((emailErr) => {
          console.error("Email sending failed:", emailErr);
          res.status(500).json({ error: "Booking saved, but email failed to send." });
        });
    }
  );
});

// --- CLIENT BOOKINGS ENDPOINT ---
app.get('/api/client/bookings', requireClientAuth, (req, res) => {
  console.log('Fetching bookings for user:', req.user.userId);

  db.all('SELECT * FROM bookings WHERE user_id = $1', [req.user.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching client bookings:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Found bookings:', rows);
    res.json(rows);
  });
});

// --- CLIENT BOOKING UPDATE ---
app.put('/api/client/bookings/:id', requireClientAuth, (req, res) => {
  const { date, time, message, phone } = req.body;
  db.run(
    'UPDATE bookings SET date = $1, time = $2, message = $3, phone = $4 WHERE id = $5 AND user_id = $6',
    [date, time, message, phone, req.params.id, req.user.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

// Delete booking for client
app.delete('/api/client/bookings/:id', requireClientAuth, (req, res) => {
  db.run('DELETE FROM bookings WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// --- USERS LIST ENDPOINT (PROTECTED) ---
app.get('/api/users', requireAuth, (req, res) => {
  db.all('SELECT id, email, name, password_hash FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- TEMPORARY DEBUG ENDPOINT ---
app.get('/api/debug/bookings', (req, res) => {
  db.all('SELECT * FROM bookings', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});