const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const dataDir = process.env.DB_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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
    ssps INTEGER, sas INTEGER, g1_region INTEGER, ses INTEGER, 
    cis INTEGER, iiu INTEGER, dau INTEGER, total1 INTEGER,
    g2_region INTEGER, male_area INTEGER, si INTEGER, 
    ci INTEGER, ct INTEGER, cni INTEGER, total2 INTEGER
  );
`);

// --- Auto-Migration ---
const tableInfo = db.prepare("PRAGMA table_info(logs)").all();
const hasDailyReports = tableInfo.some(col => col.name === 'daily_reports');
const hasNetwork = tableInfo.some(col => col.name === 'network_type');

if (!hasDailyReports) {
  db.exec(`
    ALTER TABLE logs ADD COLUMN daily_reports INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN weekly_reports INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN total3 INTEGER DEFAULT 0;
  `);
}

if (!hasNetwork) {
  db.exec(`
    ALTER TABLE logs ADD COLUMN network_type TEXT DEFAULT 'Ooredoo';
    ALTER TABLE logs ADD COLUMN quota_ssps INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN quota_sas INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN quota_g1_region INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN quota_ses INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN quota_cis INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN quota_iiu INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN quota_dau INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN total_quota INTEGER DEFAULT 0;
  `);
  console.log("Database updated with Quota and Network columns!");
}

// --- API Endpoints ---
app.get('/api/data', (req, res) => {
  const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC').all();
  
  const aggregates = {
    g1: { ssps: 0, sas: 0, region: 0, ses: 0, cis: 0, iiu: 0, dau: 0, total: 0 },
    g2: { region: 0, male: 0, si: 0, ci: 0, ct: 0, cni: 0, total: 0 },
    g3: { daily: 0, weekly: 0, total: 0 },
    quota: { total: 0 },
    grandTotal: 0
  };

  logs.forEach(log => {
    aggregates.g1.ssps += log.ssps; aggregates.g1.sas += log.sas; aggregates.g1.region += log.g1_region; 
    aggregates.g1.ses += log.ses; aggregates.g1.cis += log.cis; aggregates.g1.iiu += log.iiu; 
    aggregates.g1.dau += log.dau; aggregates.g1.total += log.total1;

    aggregates.g2.region += log.g2_region; aggregates.g2.male += log.male_area; aggregates.g2.si += log.si; 
    aggregates.g2.ci += log.ci; aggregates.g2.ct += log.ct; aggregates.g2.cni += log.cni; 
    aggregates.g2.total += log.total2;
    
    aggregates.g3.daily += (log.daily_reports || 0); aggregates.g3.weekly += (log.weekly_reports || 0); 
    aggregates.g3.total += (log.total3 || 0);
    
    aggregates.quota.total += (log.total_quota || 0);
    aggregates.grandTotal += (log.total1 + log.total2 + (log.total3 || 0));
  });

  res.json({ logs, aggregates });
});

app.post('/api/logs', (req, res) => {
  try {
    const d = req.body;
    const date = new Date().toISOString().split('T')[0]; // Changed to ISO format for better sorting
    
    // Server-side calculation to prevent "bad math" from frontend
    const total1 = d.ssps + d.sas + d.g1_region + d.ses + d.cis + d.iiu + d.dau;
    const total2 = d.g2_region + d.male_area + d.si + d.ci + d.ct + d.cni;
    const total3 = d.daily_reports + d.weekly_reports;
    const total_quota = d.quota_ssps + d.quota_sas + d.quota_g1_region + d.quota_ses + d.quota_cis + d.quota_iiu + d.quota_dau;

    const stmt = db.prepare(`
      INSERT INTO logs (
        date, network_type,
        ssps, sas, g1_region, ses, cis, iiu, dau, total1, 
        g2_region, male_area, si, ci, ct, cni, total2,
        daily_reports, weekly_reports, total3,
        quota_ssps, quota_sas, quota_g1_region, quota_ses, quota_cis, quota_iiu, quota_dau, total_quota
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      date, d.network_type,
      d.ssps, d.sas, d.g1_region, d.ses, d.cis, d.iiu, d.dau, total1, 
      d.g2_region, d.male_area, d.si, d.ci, d.ct, d.cni, total2,
      d.daily_reports, d.weekly_reports, total3,
      d.quota_ssps, d.quota_sas, d.quota_g1_region, d.quota_ses, d.quota_cis, d.quota_iiu, d.quota_dau, total_quota
    );
    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save data" });
  }
});

app.put('/api/logs/:id', (req, res) => {
  try {
    const d = req.body;
    
    // Server-side calculation to prevent "bad math"
    const total1 = d.ssps + d.sas + d.g1_region + d.ses + d.cis + d.iiu + d.dau;
    const total2 = d.g2_region + d.male_area + d.si + d.ci + d.ct + d.cni;
    const total3 = d.daily_reports + d.weekly_reports;
    const total_quota = d.quota_ssps + d.quota_sas + d.quota_g1_region + d.quota_ses + d.quota_cis + d.quota_iiu + d.quota_dau;

    const stmt = db.prepare(`
      UPDATE logs SET 
        network_type=?,
        ssps=?, sas=?, g1_region=?, ses=?, cis=?, iiu=?, dau=?, total1=?,
        g2_region=?, male_area=?, si=?, ci=?, ct=?, cni=?, total2=?,
        daily_reports=?, weekly_reports=?, total3=?,
        quota_ssps=?, quota_sas=?, quota_g1_region=?, quota_ses=?, quota_cis=?, quota_iiu=?, quota_dau=?, total_quota=?
      WHERE id = ?
    `);
    
    stmt.run(
      d.network_type,
      d.ssps, d.sas, d.g1_region, d.ses, d.cis, d.iiu, d.dau, total1, 
      d.g2_region, d.male_area, d.si, d.ci, d.ct, d.cni, total2,
      d.daily_reports, d.weekly_reports, total3,
      d.quota_ssps, d.quota_sas, d.quota_g1_region, d.quota_ses, d.quota_cis, d.quota_iiu, d.quota_dau, total_quota,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update data" });
  }
});

app.delete('/api/logs/:id', (req, res) => {
  db.prepare('DELETE FROM logs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
