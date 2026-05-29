const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = "buatPasswordKuatDisini123!@#"; // Samakan dengan di EA

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inisialisasi Database SQLite
const db = new sqlite3.Database('./trading_journal.db', (err) => {
    if (err) console.error(err.message);
    else console.log('✅ Terhubung ke database trading_journal.db');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tradeId TEXT UNIQUE,
        accountNumber TEXT,
        accountCurrency TEXT,
        symbol TEXT,
        type TEXT,
        lotSize REAL,
        openPrice REAL,
        closePrice REAL,
        stopLoss REAL,
        takeProfit REAL,
        atr REAL,
        oprHigh REAL,
        oprLow REAL,
        profitLoss REAL,
        pips REAL,
        duration INTEGER,
        magicNumber INTEGER,
        openTime TEXT,
        closeTime TEXT,
        status TEXT DEFAULT 'OPEN'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS opr_levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT,
        accountNumber TEXT,
        oprHigh REAL,
        oprLow REAL,
        atr REAL,
        session TEXT,
        timestamp TEXT
    )`);
});

// Middleware Verifikasi Password Webhook
const verifySecret = (req, res, next) => {
    const secret = req.headers['x-webhook-secret'];
    if (secret !== WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Wrong Webhook Secret' });
    }
    next();
};

// === ENDPOINT WEBHOOK DARI EA MT5 ===

// 1. Trade Open / Close
app.post('/webhook/trade', verifySecret, (req, res) => {
    const data = req.body;
    if (data.action === 'OPEN') {
        const stmt = db.prepare(`INSERT OR REPLACE INTO trades 
            (tradeId, accountNumber, accountCurrency, symbol, type, lotSize, openPrice, stopLoss, takeProfit, atr, oprHigh, oprLow, magicNumber, openTime, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`);
        stmt.run(data.tradeId, String(data.accountNumber), data.accountCurrency, data.symbol, data.type, data.lotSize, data.price, data.stopLoss, data.takeProfit, data.atr, data.oprHigh, data.oprLow, data.magicNumber, data.timestamp);
    } 
    else if (data.action === 'CLOSE') {
        const stmt = db.prepare(`UPDATE trades SET 
            closePrice = ?, profitLoss = ?, pips = ?, duration = ?, closeTime = ?, status = 'CLOSED' 
            WHERE tradeId = ?`);
        stmt.run(data.price, data.profitLoss, data.pips, data.duration, data.timestamp, data.tradeId);
    }
    res.status(200).json({ success: true });
});

// 2. OPR Levels
app.post('/webhook/opr', verifySecret, (req, res) => {
    const data = req.body;
    const stmt = db.prepare(`INSERT INTO opr_levels (symbol, accountNumber, oprHigh, oprLow, atr, session, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(data.symbol, String(data.accountNumber), data.oprHigh, data.oprLow, data.atr, data.session, data.timestamp);
    res.status(200).json({ success: true });
});

// === ENDPOINT API UNTUK DASHBOARD ===

app.get('/api/trades', (req, res) => {
    db.all(`SELECT * FROM trades ORDER BY openTime DESC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/opr', (req, res) => {
    db.all(`SELECT * FROM opr_levels ORDER BY timestamp DESC LIMIT 10`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/stats', (req, res) => {
    db.get(`SELECT 
        COUNT(*) as totalTrades,
        SUM(CASE WHEN profitLoss > 0 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN profitLoss < 0 THEN 1 ELSE 0 END) as losses,
        SUM(profitLoss) as totalProfit
        FROM trades WHERE status = 'CLOSED'`, [], (err, row) => {
        res.json(row || {});
    });
});

const port = process.env.PORT || 3000;

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
});