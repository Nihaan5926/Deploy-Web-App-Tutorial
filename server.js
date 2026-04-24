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

// --- Robust Database Setup ---
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ssps INTEGER DEFAULT 0, sas INTEGER DEFAULT 0, g1_region INTEGER DEFAULT 0, 
    ses INTEGER DEFAULT 0, cis INTEGER DEFAULT 0, iiu INTEGER DEFAULT 0, 
    dau INTEGER DEFAULT 0, oatsu INTEGER DEFAULT 0, total1 INTEGER DEFAULT 0,
    
    g2_region INTEGER DEFAULT 0, male_area INTEGER DEFAULT 0, si INTEGER DEFAULT 0, 
    ci INTEGER DEFAULT 0, ct INTEGER DEFAULT 0, cni INTEGER DEFAULT 0, total2 INTEGER DEFAULT 0,
    
    daily_reports INTEGER DEFAULT 0, weekly_reports INTEGER DEFAULT 0, total3 INTEGER DEFAULT 0,
    
    q_o_ssps INTEGER DEFAULT 0, q_o_sas INTEGER DEFAULT 0, q_o_g1_region INTEGER DEFAULT 0,
    q_o_ses INTEGER DEFAULT 0, q_o_cis INTEGER DEFAULT 0, q_o_iiu INTEGER DEFAULT 0,
    q_o_dau INTEGER DEFAULT 0, q_o_oatsu INTEGER DEFAULT 0, q_o_total INTEGER DEFAULT 0,
    
    q_d_ssps INTEGER DEFAULT 0, q_d_sas INTEGER DEFAULT 0, q_d_g1_region INTEGER DEFAULT 0,
    q_d_ses INTEGER DEFAULT 0, q_d_cis INTEGER DEFAULT 0, q_d_iiu INTEGER DEFAULT 0,
    q_d_dau INTEGER DEFAULT 0, q_d_oatsu INTEGER DEFAULT 0, q_d_total INTEGER DEFAULT 0,
    
    total_quota INTEGER DEFAULT 0
  );
`);

// --- Auto-Migration for Old Databases adding OATSU & Quotas ---
const tableInfo = db.prepare("PRAGMA table_info(logs)").all();
const hasDualNetwork = tableInfo.some(col => col.name === 'q_o_ssps');
const hasOatsu = tableInfo.some(col => col.name === 'oatsu');

if (!hasDualNetwork) {
  db.exec(`
    ALTER TABLE logs ADD COLUMN daily_reports INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN weekly_reports INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN total3 INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN q_o_ssps INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_o_sas INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_o_g1_region INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_o_ses INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_o_cis INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_o_iiu INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_o_dau INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_o_total INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN q_d_ssps INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_d_sas INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_d_g1_region INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_d_ses INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_d_cis INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_d_iiu INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_d_dau INTEGER DEFAULT 0; ALTER TABLE logs ADD COLUMN q_d_total INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN total_quota INTEGER DEFAULT 0;
  `);
}

if (!hasOatsu) {
  db.exec(`
    ALTER TABLE logs ADD COLUMN oatsu INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN q_o_oatsu INTEGER DEFAULT 0;
    ALTER TABLE logs ADD COLUMN q_d_oatsu INTEGER DEFAULT 0;
  `);
}

// --- API Endpoints ---
app.get('/api/data', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC').all();
    
    const aggregates = {
      g1: { ssps: 0, sas: 0, region: 0, ses: 0, cis: 0, iiu: 0, dau: 0, oatsu: 0, total: 0 },
      g2: { region: 0, male: 0, si: 0, ci: 0, ct: 0, cni: 0, total: 0 },
      g3: { daily: 0, weekly: 0, total: 0 },
      quota: { ooredoo: 0, dhiraagu: 0, total: 0 },
      grandTotal: 0
    };

    logs.forEach(log => {
      aggregates.g1.ssps += (log.ssps || 0); aggregates.g1.sas += (log.sas || 0); aggregates.g1.region += (log.g1_region || 0); 
      aggregates.g1.ses += (log.ses || 0); aggregates.g1.cis += (log.cis || 0); aggregates.g1.iiu += (log.iiu || 0); 
      aggregates.g1.dau += (log.dau || 0); aggregates.g1.oatsu += (log.oatsu || 0); aggregates.g1.total += (log.total1 || 0);

      aggregates.g2.region += (log.g2_region || 0); aggregates.g2.male += (log.male_area || 0); aggregates.g2.si += (log.si || 0); 
      aggregates.g2.ci += (log.ci || 0); aggregates.g2.ct += (log.ct || 0); aggregates.g2.cni += (log.cni || 0); 
      aggregates.g2.total += (log.total2 || 0);
      
      aggregates.g3.daily += (log.daily_reports || 0); aggregates.g3.weekly += (log.weekly_reports || 0); 
      aggregates.g3.total += (log.total3 || 0);
      
      aggregates.quota.ooredoo += (log.q_o_total || 0);
      aggregates.quota.dhiraagu += (log.q_d_total || 0);
      aggregates.quota.total += (log.total_quota || 0);

      aggregates.grandTotal += ((log.total1 || 0) + (log.total2 || 0) + (log.total3 || 0));
    });

    res.json({ logs, aggregates });
  } catch (err) {
    res.status(500).json({ error: "Database read error" });
  }
});

app.post('/api/logs', (req, res) => {
  try {
    const d = req.body;
    const date = new Date().toISOString().split('T')[0];
    
    const total1 = d.ssps + d.sas + d.g1_region + d.ses + d.cis + d.iiu + d.dau + d.oatsu;
    const total2 = d.g2_region + d.male_area + d.si + d.ci + d.ct + d.cni;
    const total3 = d.daily_reports + d.weekly_reports;
    
    const q_o_total = d.q_o_ssps + d.q_o_sas + d.q_o_g1_region + d.q_o_ses + d.q_o_cis + d.q_o_iiu + d.q_o_dau + d.q_o_oatsu;
    const q_d_total = d.q_d_ssps + d.q_d_sas + d.q_d_g1_region + d.q_d_ses + d.q_d_cis + d.q_d_iiu + d.q_d_dau + d.q_d_oatsu;
    const total_quota = q_o_total + q_d_total;

    const stmt = db.prepare(`
      INSERT INTO logs (
        date, ssps, sas, g1_region, ses, cis, iiu, dau, oatsu, total1, 
        g2_region, male_area, si, ci, ct, cni, total2,
        daily_reports, weekly_reports, total3,
        q_o_ssps, q_o_sas, q_o_g1_region, q_o_ses, q_o_cis, q_o_iiu, q_o_dau, q_o_oatsu, q_o_total,
        q_d_ssps, q_d_sas, q_d_g1_region, q_d_ses, q_d_cis, q_d_iiu, q_d_dau, q_d_oatsu, q_d_total,
        total_quota
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      date, d.ssps, d.sas, d.g1_region, d.ses, d.cis, d.iiu, d.dau, d.oatsu, total1, 
      d.g2_region, d.male_area, d.si, d.ci, d.ct, d.cni, total2,
      d.daily_reports, d.weekly_reports, total3,
      d.q_o_ssps, d.q_o_sas, d.q_o_g1_region, d.q_o_ses, d.q_o_cis, d.q_o_iiu, d.q_o_dau, d.q_o_oatsu, q_o_total,
      d.q_d_ssps, d.q_d_sas, d.q_d_g1_region, d.q_d_ses, d.q_d_cis, d.q_d_iiu, d.q_d_dau, d.q_d_oatsu, q_d_total,
      total_quota
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
    
    const total1 = d.ssps + d.sas + d.g1_region + d.ses + d.cis + d.iiu + d.dau + d.oatsu;
    const total2 = d.g2_region + d.male_area + d.si + d.ci + d.ct + d.cni;
    const total3 = d.daily_reports + d.weekly_reports;
    
    const q_o_total = d.q_o_ssps + d.q_o_sas + d.q_o_g1_region + d.q_o_ses + d.q_o_cis + d.q_o_iiu + d.q_o_dau + d.q_o_oatsu;
    const q_d_total = d.q_d_ssps + d.q_d_sas + d.q_d_g1_region + d.q_d_ses + d.q_d_cis + d.q_d_iiu + d.q_d_dau + d.q_d_oatsu;
    const total_quota = q_o_total + q_d_total;

    const stmt = db.prepare(`
      UPDATE logs SET 
        ssps=?, sas=?, g1_region=?, ses=?, cis=?, iiu=?, dau=?, oatsu=?, total1=?,
        g2_region=?, male_area=?, si=?, ci=?, ct=?, cni=?, total2=?,
        daily_reports=?, weekly_reports=?, total3=?,
        q_o_ssps=?, q_o_sas=?, q_o_g1_region=?, q_o_ses=?, q_o_cis=?, q_o_iiu=?, q_o_dau=?, q_o_oatsu=?, q_o_total=?,
        q_d_ssps=?, q_d_sas=?, q_d_g1_region=?, q_d_ses=?, q_d_cis=?, q_d_iiu=?, q_d_dau=?, q_d_oatsu=?, q_d_total=?,
        total_quota=?
      WHERE id = ?
    `);
    
    stmt.run(
      d.ssps, d.sas, d.g1_region, d.ses, d.cis, d.iiu, d.dau, d.oatsu, total1, 
      d.g2_region, d.male_area, d.si, d.ci, d.ct, d.cni, total2,
      d.daily_reports, d.weekly_reports, total3,
      d.q_o_ssps, d.q_o_sas, d.q_o_g1_region, d.q_o_ses, d.q_o_cis, d.q_o_iiu, d.q_o_dau, d.q_o_oatsu, q_o_total,
      d.q_d_ssps, d.q_d_sas, d.q_d_g1_region, d.q_d_ses, d.q_d_cis, d.q_d_iiu, d.q_d_dau, d.q_d_oatsu, q_d_total,
      total_quota, req.params.id
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
