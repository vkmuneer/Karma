const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const { db, getSetting, setSetting, allSettings, UPLOAD_DIR } = require('../db');
const auth = require('../auth');
const push = require('../push');
const { readRows, upsertMembers } = require('../importer');
const { ROLES, MISSION_CATEGORIES, EVENT_CATEGORIES, BLOOD_GROUPS, SKILLS, parseSkills, isActiveAlert } = require('../helpers');

const router = express.Router();
router.use(express.json({ limit: '1mb' }));
router.use(auth.requireFetch);

// ---------- uploads ----------
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_TYPES[file.mimetype])),
});
const sheetUpload = multer({ dest: os.tmpdir(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/upload', (req, res, next) => (req.admin || req.member ? next() : res.status(401).json({ error: 'Login required' })),
  imageUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Please choose a JPG, PNG, WebP or GIF image.' });
    res.json({ url: '/uploads/' + req.file.filename });
  });

function removeUpload(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  fs.unlink(file, () => {});
}

// ---------- generic admin resources ----------
// Field types: text | int | bool | skills. Only listed fields can be written.
const RESOURCES = {
  missions: {
    order: "CASE WHEN status = 'ongoing' THEN 0 ELSE 1 END, COALESCE(NULLIF(event_date, ''), '9999') DESC, id DESC",
    fields: { title: 'text', location: 'text', category: 'text', event_date: 'text', end_date: 'text', status: 'text', summary: 'text', body: 'text', cover: 'text', volunteers_count: 'int', featured: 'bool' },
    required: ['title'],
  },
  events: {
    order: "COALESCE(NULLIF(event_date, ''), '0000') DESC, id DESC",
    fields: { title: 'text', category: 'text', event_date: 'text', end_date: 'text', event_time: 'text', venue: 'text', summary: 'text', body: 'text', cover: 'text', register_link: 'text', featured: 'bool' },
    required: ['title'],
  },
  updates: {
    order: 'pinned DESC, COALESCE(published_at, created_at) DESC, id DESC',
    fields: { title: 'text', body: 'text', cover: 'text', published_at: 'text', pinned: 'bool' },
    required: ['title'],
  },
  photos: {
    order: 'id DESC',
    fields: { src: 'text', caption: 'text', mission_id: 'int', event_id: 'int', taken_at: 'text' },
    required: ['src'],
    onDelete: (row) => removeUpload(row.src),
  },
  alerts: {
    order: 'id DESC',
    fields: { title: 'text', message: 'text', level: 'text', audience: 'text', expires_at: 'text' },
    required: ['title'],
  },
  needs: {
    order: 'sort_order, id',
    fields: { item: 'text', purpose: 'text', amount: 'int', fulfilled: 'bool', sort_order: 'int' },
    required: ['item'],
  },
  members: {
    order: "CASE role WHEN 'chairman' THEN 1 WHEN 'convenor' THEN 2 WHEN 'treasurer' THEN 3 WHEN 'vice_chairman' THEN 4 WHEN 'joint_convenor' THEN 5 WHEN 'executive' THEN 6 ELSE 7 END, sort_order, name COLLATE NOCASE",
    fields: { name: 'text', role: 'text', designation: 'text', sort_order: 'int', phone: 'text', phone2: 'text', address: 'text', place: 'text', blood_group: 'text', skills: 'skills', occupation: 'text', bio: 'text', photo: 'text', joined_year: 'text', show_public: 'bool', active: 'bool' },
    required: ['name'],
    hidden: ['pin_hash'],
  },
  join_requests: {
    order: "CASE status WHEN 'new' THEN 0 ELSE 1 END, id DESC",
    fields: { name: 'text', phone: 'text', place: 'text', blood_group: 'text', skills: 'text', message: 'text', status: 'text' },
    required: ['name'],
  },
};

function clean(type, value) {
  if (value === undefined) return undefined;
  if (type === 'int') return value === '' || value === null ? null : (Number.isFinite(+value) ? Math.round(+value) : null);
  if (type === 'bool') return value === true || value === 1 || value === '1' || value === 'on' || value === 'true' ? 1 : 0;
  if (type === 'skills') return JSON.stringify((Array.isArray(value) ? value : String(value).split(',')).map((s) => String(s).trim()).filter(Boolean).slice(0, 30));
  return value === null ? null : String(value).slice(0, 20000);
}

function pick(resource, body) {
  const out = {};
  for (const [f, type] of Object.entries(resource.fields)) {
    const v = clean(type, body[f]);
    if (v !== undefined) out[f] = v;
  }
  return out;
}

function present(row, resource) {
  if (!row) return row;
  for (const h of resource.hidden || []) { row['has_' + h.replace('_hash', '')] = Boolean(row[h]); delete row[h]; }
  if ('skills' in row && resource.fields.skills === 'skills') row.skills = parseSkills(row.skills);
  return row;
}

router.get('/admin/r/:res', auth.requireAdmin, (req, res) => {
  const r = RESOURCES[req.params.res];
  if (!r) return res.status(404).json({ error: 'Unknown resource' });
  const rows = db.prepare(`SELECT * FROM ${req.params.res} ORDER BY ${r.order}`).all();
  res.json(rows.map((row) => present(row, r)));
});

router.post('/admin/r/:res', auth.requireAdmin, (req, res) => {
  const r = RESOURCES[req.params.res];
  if (!r) return res.status(404).json({ error: 'Unknown resource' });
  const data = pick(r, req.body);
  for (const f of r.required) if (!data[f]) return res.status(400).json({ error: `${f} is required` });
  const cols = Object.keys(data);
  const info = db.prepare(`INSERT INTO ${req.params.res} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => data[c]));
  res.json(present(db.prepare(`SELECT * FROM ${req.params.res} WHERE id = ?`).get(info.lastInsertRowid), r));
});

router.put('/admin/r/:res/:id', auth.requireAdmin, (req, res) => {
  const r = RESOURCES[req.params.res];
  if (!r) return res.status(404).json({ error: 'Unknown resource' });
  const data = pick(r, req.body);
  for (const f of r.required) if (f in data && !data[f]) return res.status(400).json({ error: `${f} is required` });
  const cols = Object.keys(data);
  if (cols.length) db.prepare(`UPDATE ${req.params.res} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => data[c]), req.params.id);
  const row = db.prepare(`SELECT * FROM ${req.params.res} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(present(row, r));
});

router.delete('/admin/r/:res/:id', auth.requireAdmin, (req, res) => {
  const r = RESOURCES[req.params.res];
  if (!r) return res.status(404).json({ error: 'Unknown resource' });
  const row = db.prepare(`SELECT * FROM ${req.params.res} WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM ${req.params.res} WHERE id = ?`).run(req.params.id);
  if (r.onDelete) r.onDelete(row);
  if (req.params.res === 'members') auth.destroyUserSessions('member', row.id);
  res.json({ ok: true });
});

// ---------- admin: auth & accounts ----------
router.post('/admin/login', auth.rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req, res) => {
  const { username, password } = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(String(username || '').trim());
  if (!admin || !auth.verifyPassword(password, admin.pass_hash)) return res.status(401).json({ error: 'Wrong username or password' });
  auth.createSession(req, res, 'admin', admin.id);
  res.json({ id: admin.id, username: admin.username, name: admin.name });
});

router.post('/admin/logout', (req, res) => {
  auth.destroySession(req, res, 'admin');
  res.json({ ok: true });
});

router.get('/admin/me', (req, res) => {
  if (!req.admin) return res.status(401).json({ error: 'Not logged in' });
  res.json({
    admin: req.admin,
    meta: { roles: ROLES, categories: MISSION_CATEGORIES, eventCategories: EVENT_CATEGORIES, bloodGroups: BLOOD_GROUPS, skills: SKILLS },
  });
});

router.post('/admin/password', auth.requireAdmin, (req, res) => {
  const { current, password } = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!auth.verifyPassword(current, admin.pass_hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').run(auth.hashPassword(password), admin.id);
  res.json({ ok: true });
});

router.get('/admin/admins', auth.requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, username, name, created_at FROM admins ORDER BY id').all());
});

router.post('/admin/admins', auth.requireAdmin, (req, res) => {
  const { username, name, password } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: 'Username: 3-32 letters, numbers, . _ -' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    db.prepare('INSERT INTO admins (username, name, pass_hash) VALUES (?, ?, ?)').run(username, name || username, auth.hashPassword(password));
  } catch {
    return res.status(400).json({ error: 'That username is already taken' });
  }
  res.json({ ok: true });
});

router.delete('/admin/admins/:id', auth.requireAdmin, (req, res) => {
  if (+req.params.id === req.admin.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
  auth.destroyUserSessions('admin', +req.params.id);
  res.json({ ok: true });
});

// ---------- admin: settings, stats, alerts, members ----------
const PRIVATE_SETTINGS = ['vapid_keys', 'seeded'];

router.get('/admin/settings', auth.requireAdmin, (req, res) => {
  const s = allSettings();
  for (const k of PRIVATE_SETTINGS) delete s[k];
  res.json(s);
});

router.put('/admin/settings', auth.requireAdmin, (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
    if (PRIVATE_SETTINGS.includes(k) || !/^[a-z0-9_]{1,40}$/.test(k)) continue;
    setSetting(k, v);
  }
  res.json({ ok: true });
});

router.get('/admin/stats', auth.requireAdmin, (req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  const assigned = db.prepare("SELECT DISTINCT role FROM members WHERE active = 1 AND role IN ('chairman','convenor','treasurer')").all().map((r) => r.role);
  res.json({
    members: count('SELECT COUNT(*) n FROM members WHERE active = 1'),
    membersWithPin: count('SELECT COUNT(*) n FROM members WHERE active = 1 AND pin_hash IS NOT NULL'),
    membersWithSkills: count("SELECT COUNT(*) n FROM members WHERE active = 1 AND skills NOT IN ('[]', '')"),
    membersWithPhone: count("SELECT COUNT(*) n FROM members WHERE active = 1 AND phone IS NOT NULL AND phone != ''"),
    missions: count('SELECT COUNT(*) n FROM missions'),
    events: count('SELECT COUNT(*) n FROM events'),
    updates: count('SELECT COUNT(*) n FROM updates'),
    photos: count('SELECT COUNT(*) n FROM photos'),
    activeAlerts: db.prepare('SELECT expires_at FROM alerts').all().filter(isActiveAlert).length,
    newJoinRequests: count("SELECT COUNT(*) n FROM join_requests WHERE status = 'new'"),
    pushDevices: count('SELECT COUNT(*) n FROM push_subs'),
    memberPushDevices: count('SELECT COUNT(*) n FROM push_subs WHERE member_id IS NOT NULL'),
    missingRoles: ['chairman', 'convenor', 'treasurer'].filter((r) => !assigned.includes(r)),
  });
});

router.post('/admin/alerts/:id/push', auth.requireAdmin, async (req, res) => {
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Not found' });
  try {
    const result = await push.sendAlert(alert);
    db.prepare('UPDATE alerts SET pushed_count = pushed_count + ? WHERE id = ?').run(result.sent, alert.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Push failed: ' + err.message });
  }
});

// Generates a new 6-digit PIN for a member and returns it once so the admin can share it.
router.post('/admin/members/:id/pin', auth.requireAdmin, (req, res) => {
  const member = db.prepare('SELECT id FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  const pin = String(crypto.randomInt(100000, 1000000));
  db.prepare('UPDATE members SET pin_hash = ? WHERE id = ?').run(auth.hashPassword(pin), member.id);
  auth.destroyUserSessions('member', member.id);
  res.json({ pin });
});

router.post('/admin/members/import', auth.requireAdmin, sheetUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose an .xlsx or .csv file' });
  try {
    const rows = await readRows(req.file.path, req.file.originalname);
    res.json(upsertMembers(rows));
  } catch (err) {
    res.status(400).json({ error: 'Could not read the file: ' + err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// ---------- member portal ----------
const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const PUBLIC_MEMBER_FIELDS = 'id, name, role, designation, phone, phone2, place, blood_group, skills, occupation, photo';

router.post('/member/login', auth.rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req, res) => {
  const { phone, pin } = req.body || {};
  const digits = last10(phone);
  if (digits.length < 9 || !pin) return res.status(400).json({ error: 'Enter your phone number and PIN' });
  const candidates = db.prepare('SELECT * FROM members WHERE active = 1 AND pin_hash IS NOT NULL').all()
    .filter((m) => last10(m.phone) === digits || last10(m.phone2) === digits);
  const member = candidates.find((m) => auth.verifyPassword(String(pin).trim(), m.pin_hash));
  if (!member) return res.status(401).json({ error: 'Phone number or PIN is wrong. Ask the admin for a PIN if you do not have one.' });
  auth.createSession(req, res, 'member', member.id);
  res.json({ ok: true });
});

router.post('/member/logout', (req, res) => {
  auth.destroySession(req, res, 'member');
  res.json({ ok: true });
});

router.get('/member/me', auth.requireMember, (req, res) => {
  const m = { ...req.member };
  delete m.pin_hash;
  m.skills = parseSkills(m.skills);
  res.json({ member: m, skills: SKILLS, bloodGroups: BLOOD_GROUPS });
});

router.put('/member/me', auth.requireMember, (req, res) => {
  const b = req.body || {};
  const data = {};
  for (const f of ['phone2', 'place', 'occupation', 'bio', 'photo', 'address']) if (b[f] !== undefined) data[f] = clean('text', b[f]);
  if (b.blood_group !== undefined) data.blood_group = BLOOD_GROUPS.includes(b.blood_group) ? b.blood_group : null;
  if (b.skills !== undefined) data.skills = clean('skills', b.skills);
  const cols = Object.keys(data);
  if (cols.length) db.prepare(`UPDATE members SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => data[c]), req.member.id);
  res.json({ ok: true });
});

router.post('/member/pin', auth.requireMember, (req, res) => {
  const { current, pin } = req.body || {};
  if (!auth.verifyPassword(String(current || ''), req.member.pin_hash)) return res.status(400).json({ error: 'Current PIN is wrong' });
  if (!/^\d{4,8}$/.test(String(pin || ''))) return res.status(400).json({ error: 'New PIN must be 4 to 8 digits' });
  db.prepare('UPDATE members SET pin_hash = ? WHERE id = ?').run(auth.hashPassword(String(pin)), req.member.id);
  res.json({ ok: true });
});

router.get('/member/directory', auth.requireMember, (req, res) => {
  const rows = db.prepare(`SELECT ${PUBLIC_MEMBER_FIELDS} FROM members WHERE active = 1 ORDER BY ${RESOURCES.members.order}`).all();
  res.json(rows.map((r) => ({ ...r, skills: parseSkills(r.skills) })));
});

router.get('/member/alerts', auth.requireMember, (req, res) => {
  res.json(db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT 50').all());
});

// ---------- push subscriptions ----------
router.get('/push/key', (req, res) => res.json({ key: push.publicKey() }));

router.post('/push/subscribe', auth.rateLimit({ windowMs: 60 * 1000, max: 20 }), (req, res) => {
  try {
    push.saveSubscription(req.body && req.body.subscription, req.member ? req.member.id : null);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/push/unsubscribe', (req, res) => {
  if (req.body && req.body.endpoint) push.removeSubscription(String(req.body.endpoint));
  res.json({ ok: true });
});

// ---------- public join form ----------
router.post('/join', auth.rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }), (req, res) => {
  const b = req.body || {};
  const name = clean('text', b.name || '').trim().slice(0, 100);
  const phone = clean('text', b.phone || '').trim().slice(0, 30);
  if (!name || last10(phone).length < 10) return res.status(400).json({ error: 'Please enter your name and a valid phone number' });
  if (b.website) return res.json({ ok: true }); // honeypot
  db.prepare('INSERT INTO join_requests (name, phone, place, blood_group, skills, message) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, phone, String(b.place || '').slice(0, 100), BLOOD_GROUPS.includes(b.blood_group) ? b.blood_group : null,
      String(b.skills || '').slice(0, 500), String(b.message || '').slice(0, 2000));
  res.json({ ok: true });
});

router.use((req, res) => res.status(404).json({ error: 'Not found' }));

router.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Something went wrong' });
});

module.exports = router;
