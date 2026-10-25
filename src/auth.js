const crypto = require('crypto');
const { db } = require('./db');

const SESSION_DAYS = 30;

// Sections a moderator can be given. Managing staff accounts is always admin-only.
const SECTIONS = ['alerts', 'missions', 'events', 'updates', 'photos', 'join_requests', 'needs', 'members', 'skills', 'settings'];
const DEFAULT_MODERATOR_SECTIONS = ['alerts', 'missions', 'events', 'updates', 'photos', 'join_requests', 'needs'];
const COOKIE = { admin: 'karma_admin', member: 'karma_member' };

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === test.length && crypto.timingSafeEqual(expected, test);
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_DAYS * 24 * 3600 * 1000,
    path: '/',
  };
}

function createSession(req, res, kind, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  db.prepare('INSERT INTO sessions (token, kind, user_id, expires_at) VALUES (?, ?, ?, ?)').run(token, kind, userId, expires);
  res.cookie(COOKIE[kind], token, cookieOptions(req));
}

function destroySession(req, res, kind) {
  const token = parseCookies(req)[COOKIE[kind]];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE[kind], { path: '/' });
}

function destroyUserSessions(kind, userId) {
  db.prepare('DELETE FROM sessions WHERE kind = ? AND user_id = ?').run(kind, userId);
}

function sessionUser(req, kind) {
  const token = parseCookies(req)[COOKIE[kind]];
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ? AND kind = ?').get(token, kind);
  if (!s) return null;
  if (s.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  if (kind === 'admin') {
    const staff = db.prepare('SELECT id, username, name, role, permissions, member_id FROM admins WHERE id = ? AND active = 1').get(s.user_id);
    if (!staff) return null;
    let perms = [];
    try { perms = JSON.parse(staff.permissions || '[]'); } catch { perms = []; }
    staff.permissions = staff.role === 'admin' ? SECTIONS.slice() : perms.filter((p) => SECTIONS.includes(p));
    return staff;
  }
  return db.prepare('SELECT * FROM members WHERE id = ? AND active = 1').get(s.user_id) || null;
}

// Attach req.admin / req.member for every request.
function loadUsers(req, res, next) {
  req.admin = sessionUser(req, 'admin');
  req.member = sessionUser(req, 'member');
  res.locals.admin = req.admin;
  res.locals.member = req.member;
  next();
}

// State-changing API calls must come from our own scripts (custom header can't be sent cross-site without CORS).
function requireFetch(req, res, next) {
  if (req.method === 'GET' || req.get('X-Requested-With') === 'fetch') return next();
  res.status(403).json({ error: 'Bad request origin' });
}

// Any staff login (admin or moderator).
function requireAdmin(req, res, next) {
  if (req.admin) return next();
  res.status(401).json({ error: 'Admin login required' });
}

// Full administrators only.
function requireFullAdmin(req, res, next) {
  if (!req.admin) return res.status(401).json({ error: 'Admin login required' });
  if (req.admin.role === 'admin') return next();
  res.status(403).json({ error: 'Only administrators can do this' });
}

function can(staff, ...sections) {
  return Boolean(staff) && (staff.role === 'admin' || sections.some((s) => staff.permissions.includes(s)));
}

// Staff with at least one of the given sections.
function requirePermission(...sections) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: 'Admin login required' });
    if (can(req.admin, ...sections)) return next();
    res.status(403).json({ error: 'Your account does not have access to this section. Ask an administrator.' });
  };
}

function requireMember(req, res, next) {
  if (req.member) return next();
  res.status(401).json({ error: 'Member login required' });
}

// Small in-memory limiter for login / public form endpoints.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count++;
    hits.set(key, entry);
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
    if (entry.count > max) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    next();
  };
}

function cleanupSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

module.exports = {
  hashPassword, verifyPassword, createSession, destroySession, destroyUserSessions,
  loadUsers, requireFetch, requireAdmin, requireFullAdmin, requirePermission, can, SECTIONS, DEFAULT_MODERATOR_SECTIONS, requireMember, rateLimit, cleanupSessions,
};
