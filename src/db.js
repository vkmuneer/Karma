const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'karma.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT,
  pass_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL,           -- 'admin' | 'member'
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'volunteer',
  designation TEXT,             -- optional custom title shown instead of the role label
  sort_order INTEGER DEFAULT 100,
  phone TEXT,
  phone2 TEXT,
  address TEXT,
  place TEXT,
  blood_group TEXT,
  skills TEXT DEFAULT '[]',     -- JSON array of strings
  occupation TEXT,
  bio TEXT,
  photo TEXT,
  joined_year TEXT,
  show_public INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  pin_hash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  location TEXT,
  category TEXT DEFAULT 'other',
  event_date TEXT,              -- YYYY, YYYY-MM or YYYY-MM-DD
  end_date TEXT,
  status TEXT DEFAULT 'completed',
  summary TEXT,
  body TEXT,
  cover TEXT,
  volunteers_count INTEGER,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  event_date TEXT,              -- YYYY-MM-DD
  end_date TEXT,
  event_time TEXT,              -- free text, e.g. "10:00 AM – 1:00 PM"
  venue TEXT,
  summary TEXT,
  body TEXT,
  cover TEXT,
  register_link TEXT,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  cover TEXT,
  published_at TEXT,
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src TEXT NOT NULL,
  caption TEXT,
  mission_id INTEGER REFERENCES missions(id) ON DELETE SET NULL,
  taken_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT,
  level TEXT DEFAULT 'info',    -- info | warning | critical
  audience TEXT DEFAULT 'members', -- public | members
  expires_at TEXT,
  pushed_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS needs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item TEXT NOT NULL,
  purpose TEXT,
  amount INTEGER,
  fulfilled INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 100
);

CREATE TABLE IF NOT EXISTS join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  place TEXT,
  blood_group TEXT,
  skills TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',    -- new | contacted | added | rejected
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL,
  keys TEXT NOT NULL,
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Columns added after the first release; existing databases get them on startup.
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn('photos', 'event_id', 'INTEGER REFERENCES events(id) ON DELETE SET NULL');
// Staff accounts: 'admin' has full access; 'moderator' only the sections listed in permissions.
addColumn('admins', 'role', "TEXT DEFAULT 'admin'");
addColumn('admins', 'permissions', "TEXT DEFAULT '[]'");
addColumn('admins', 'member_id', 'INTEGER REFERENCES members(id) ON DELETE SET NULL');
addColumn('admins', 'active', 'INTEGER DEFAULT 1');

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

function allSettings() {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
  }
  return out;
}

module.exports = { db, getSetting, setSetting, allSettings, DATA_DIR, UPLOAD_DIR };
