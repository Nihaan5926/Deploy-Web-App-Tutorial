const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.db');

app.use(express.json());
app.use(express.static('public'));

// Initialize Database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT,
        value REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// API: Get all statistics
app.get('/api/stats', (req, res) => {
    db.all("SELECT * FROM stats ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: Add a new stat
app.post('/api/stats', (req, res) => {
    const { label, value } = req.body;
    db.run("INSERT INTO stats (label, value) VALUES (?, ?)", [label, value], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, label, value });
    });
});

const PORT = 3008;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
