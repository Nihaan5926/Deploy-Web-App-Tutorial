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
    id INTEGER PRIMARY KEY,
    name TEXT,
    date TEXT,
    amount REAL,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed data if empty
const rowCount = db.prepare('SELECT count(*) as count FROM transactions').get();
if (rowCount.count === 0) {
  const insert = db.prepare('INSERT INTO transactions (id, name, date, amount, image) VALUES (?, ?, ?, ?, ?)');
  insert.run(1025, 'Jessica Alba', '05.10.22', 300.00, 'https://i.pravatar.cc/50?u=1');
  insert.run(1026, 'Denisse James', '05.10.22', 450.00, 'https://i.pravatar.cc/50?u=2');
  insert.run(1027, 'Kat Addams', '05.10.22', 100.00, 'https://i.pravatar.cc/50?u=3');
  insert.run(1028, 'Lisa Woods', '05.10.22', 250.00, 'https://i.pravatar.cc/50?u=4');
}

// --- API Endpoints ---
app.get('/api/data', (req, res) => {
  const transactions = db.prepare('SELECT * FROM transactions').all();
  res.json({
    topProduct: "Floral Skirt",
    topProductValue: 91,
    thisYear: 15000.00,
    lastYear: 9000.00,
    salesReport: { desktop: 60, tablet: 30, mobile: 10 },
    transactions: transactions
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
