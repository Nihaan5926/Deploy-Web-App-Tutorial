const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Ensure data directory exists for Docker/Dockploy volume mounting
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const db = new Database(path.join(dataDir, 'dashboard.db'));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Database Setup ---
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Group 1
    ssps INTEGER, sas INTEGER, g1_region INTEGER, ses INTEGER, 
    cis INTEGER, iiu INTEGER, dau INTEGER, total1 INTEGER,
    
    -- Group 2
    g2_region INTEGER, male_area INTEGER, si INTEGER, 
    ci INTEGER, ct INTEGER, cni INTEGER, total2 INTEGER
  );
`);

// --- API Endpoints ---
app.get('/api/data', (req, res) => {
  const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp ASC').all();
  
  // Aggregate totals for charts
  const aggregates = {
    g1: { ssps: 0, sas: 0, region: 0, ses: 0, cis: 0, iiu: 0, dau: 0 },
    g2: { region: 0, male: 0, si: 0, ci: 0, ct: 0, cni: 0 }
  };

  logs.forEach(log => {
    aggregates.g1.ssps += log.ssps; aggregates.g1.sas += log.sas;
    aggregates.g1.region += log.g1_region; aggregates.g1.ses += log.ses;
    aggregates.g1.cis += log.cis; aggregates.g1.iiu += log.iiu;
    aggregates.g1.dau += log.dau;

    aggregates.g2.region += log.g2_region; aggregates.g2.male += log.male_area;
    aggregates.g2.si += log.si; aggregates.g2.ci += log.ci;
    aggregates.g2.ct += log.ct; aggregates.g2.cni += log.cni;
  });

  res.json({ logs, aggregates });
});

app.post('/api/logs', (req, res) => {
  const d = req.body;
  const date = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
  
  const stmt = db.prepare(`
    INSERT INTO logs (
      date, ssps, sas, g1_region, ses, cis, iiu, dau, total1,
      g2_region, male_area, si, ci, ct, cni, total2
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const info = stmt.run(
    date, d.ssps, d.sas, d.g1_region, d.ses, d.cis, d.iiu, d.dau, d.total1,
    d.g2_region, d.male_area, d.si, d.ci, d.ct, d.cni, d.total2
  );
  
  res.json({ id: info.lastInsertRowid });
});

const PORT = 3008;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
