const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');

const app = express();
const db = new Database('dashboard.db');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Database Setup ---
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date TEXT,
    amount REAL,
    device TEXT
  );
`);

// --- API Endpoints ---

// Get all transactions
app.get('/api/data', (req, res) => {
  const transactions = db.prepare('SELECT * FROM transactions ORDER BY id DESC').all();
  
  // Calculate device distribution for the pie chart
  const counts = { desktop: 0, tablet: 0, mobile: 0 };
  transactions.forEach(t => { if(counts[t.device] !== undefined) counts[t.device]++; });
  
  res.json({
    transactions: transactions,
    deviceStats: counts
  });
});

// Add new transaction
app.post('/api/transactions', (req, res) => {
  const { name, amount, device } = req.body;
  const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '.');
  const stmt = db.prepare('INSERT INTO transactions (name, date, amount, device) VALUES (?, ?, ?, ?)');
  const info = stmt.run(name, amount, device);
  res.json({ id: info.lastInsertRowid });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
