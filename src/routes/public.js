const express = require('express');
const { db, allSettings } = require('../db');
const h = require('../helpers');

const router = express.Router();

const PUBLIC_MEMBER_FIELDS = 'id, name, role, designation, place, skills, occupation, bio, photo, joined_year, sort_order';
const ROLE_ORDER = "CASE role WHEN 'chairman' THEN 1 WHEN 'convenor' THEN 2 WHEN 'treasurer' THEN 3 WHEN 'vice_chairman' THEN 4 WHEN 'joint_convenor' THEN 5 WHEN 'executive' THEN 6 ELSE 7 END, sort_order, name COLLATE NOCASE";
const MISSION_COLS = "m.*, COALESCE(NULLIF(m.cover, ''), (SELECT src FROM photos WHERE mission_id = m.id ORDER BY id LIMIT 1)) AS cover, (SELECT COUNT(*) FROM photos WHERE mission_id = m.id) AS photo_count";
const EVENT_COLS = "e.*, COALESCE(NULLIF(e.cover, ''), (SELECT src FROM photos WHERE event_id = e.id ORDER BY id LIMIT 1)) AS cover, (SELECT COUNT(*) FROM photos WHERE event_id = e.id) AS photo_count";
const MISSION_ORDER = "CASE WHEN status = 'ongoing' THEN 0 ELSE 1 END, COALESCE(NULLIF(event_date, ''), '9999') DESC, id DESC";

// Shared locals for every page: settings, language, helpers and the live public alerts banner.
router.use((req, res, next) => {
  const lang = req.query.lang === 'en' || req.query.lang === 'ml' ? req.query.lang : (req.headers.cookie || '').match(/(?:^|;\s*)lang=(en|ml)/)?.[1] || 'ml';
  if (req.query.lang) res.cookie('lang', lang, { maxAge: 365 * 24 * 3600 * 1000, sameSite: 'lax', path: '/' });
  const settings = allSettings();
  delete settings.vapid_keys;
  const founded = settings.founded ? parseInt(settings.founded, 10) : null;
  res.locals.s = settings;
  res.locals.lang = lang;
  res.locals.t = h.translator(lang);
  res.locals.h = h;
  res.locals.path = req.path;
  res.locals.yearsOfService = founded ? new Date().getFullYear() - founded : null;
  res.locals.liveAlerts = db.prepare("SELECT * FROM alerts WHERE audience = 'public' ORDER BY id DESC LIMIT 20").all().filter(h.isActiveAlert);
  res.locals.pageTitle = '';
  res.locals.pageDescription = lang === 'ml' ? settings.intro_ml : settings.intro_en;
  res.locals.pageImage = '';
  next();
});

router.get('/', (req, res) => {
  const missions = db.prepare(`SELECT ${MISSION_COLS} FROM missions m ORDER BY featured DESC, ${MISSION_ORDER} LIMIT 6`).all();
  const today = h.todayIST();
  const upcomingEvents = db.prepare(`SELECT ${EVENT_COLS} FROM events e WHERE COALESCE(NULLIF(end_date, ''), event_date) >= ? ORDER BY event_date ASC LIMIT 3`).all(today);
  const recentEvents = db.prepare(`SELECT ${EVENT_COLS} FROM events e WHERE COALESCE(NULLIF(end_date, ''), event_date, '') < ? ORDER BY featured DESC, event_date DESC LIMIT 3`).all(today);
  const updates = db.prepare('SELECT * FROM updates ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC LIMIT 3').all();
  const photos = db.prepare('SELECT * FROM photos ORDER BY id DESC LIMIT 8').all();
  const missionCount = db.prepare('SELECT COUNT(*) n FROM missions').get().n;
  res.render('home', { missions, updates, photos, missionCount, upcomingEvents, recentEvents });
});

router.get('/about', (req, res) => {
  res.locals.pageTitle = res.locals.t('about');
  res.render('about');
});

router.get('/missions', (req, res) => {
  const category = h.MISSION_CATEGORIES.some((c) => c.key === req.query.category) ? req.query.category : '';
  const missions = category
    ? db.prepare(`SELECT ${MISSION_COLS} FROM missions m WHERE category = ? ORDER BY ${MISSION_ORDER}`).all(category)
    : db.prepare(`SELECT ${MISSION_COLS} FROM missions m ORDER BY ${MISSION_ORDER}`).all();
  const used = db.prepare('SELECT DISTINCT category FROM missions').all().map((r) => r.category);
  res.locals.pageTitle = res.locals.t('missions');
  res.render('missions', { missions, category, categories: h.MISSION_CATEGORIES.filter((c) => used.includes(c.key)) });
});

router.get('/missions/:id', (req, res, next) => {
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  if (!mission) return next();
  const photos = db.prepare('SELECT * FROM photos WHERE mission_id = ? ORDER BY id').all(mission.id);
  res.locals.pageTitle = mission.title;
  res.locals.pageDescription = mission.summary || '';
  res.locals.pageImage = mission.cover || (photos[0] && photos[0].src) || '';
  if (!mission.cover && photos[0]) mission.cover = photos[0].src;
  res.render('mission', { mission, photos });
});

router.get('/events', (req, res) => {
  const today = h.todayIST();
  const upcoming = db.prepare(`SELECT ${EVENT_COLS} FROM events e WHERE COALESCE(NULLIF(end_date, ''), event_date) >= ? ORDER BY event_date ASC, id`).all(today);
  const past = db.prepare(`SELECT ${EVENT_COLS} FROM events e WHERE COALESCE(NULLIF(end_date, ''), event_date, '') < ? ORDER BY event_date DESC, id DESC`).all(today);
  res.locals.pageTitle = res.locals.t('events');
  res.render('events', { upcoming, past });
});

router.get('/events/:id', (req, res, next) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return next();
  const photos = db.prepare('SELECT * FROM photos WHERE event_id = ? ORDER BY id').all(event.id);
  res.locals.pageTitle = event.title;
  res.locals.pageDescription = event.summary || '';
  res.locals.pageImage = event.cover || (photos[0] && photos[0].src) || '';
  if (!event.cover && photos[0]) event.cover = photos[0].src;
  res.render('event', { event, photos });
});

router.get('/updates', (req, res) => {
  const updates = db.prepare('SELECT * FROM updates ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC').all();
  res.locals.pageTitle = res.locals.t('updates');
  res.render('updates', { updates });
});

router.get('/updates/:id', (req, res, next) => {
  const update = db.prepare('SELECT * FROM updates WHERE id = ?').get(req.params.id);
  if (!update) return next();
  res.locals.pageTitle = update.title;
  res.locals.pageDescription = (update.body || '').slice(0, 160);
  res.locals.pageImage = update.cover || '';
  res.render('update', { update });
});

router.get('/gallery', (req, res) => {
  const photos = db.prepare(`SELECT p.*, m.title AS mission_title, e.title AS event_title FROM photos p
    LEFT JOIN missions m ON m.id = p.mission_id LEFT JOIN events e ON e.id = p.event_id ORDER BY p.id DESC`).all();
  res.locals.pageTitle = res.locals.t('gallery');
  res.render('gallery', { photos });
});

router.get('/team', (req, res) => {
  const members = db.prepare(`SELECT ${PUBLIC_MEMBER_FIELDS} FROM members WHERE active = 1 AND show_public = 1 ORDER BY ${ROLE_ORDER}`).all()
    .map((m) => ({ ...m, skills: h.parseSkills(m.skills) }));
  const groupOf = (m) => (h.ROLES.find((r) => r.key === m.role) || { group: 'volunteer' }).group;
  const allSkills = [...new Set(members.flatMap((m) => m.skills))].sort();
  res.locals.pageTitle = res.locals.t('team');
  res.render('team', {
    office: members.filter((m) => groupOf(m) === 'office'),
    executive: members.filter((m) => groupOf(m) === 'executive'),
    volunteers: members.filter((m) => groupOf(m) === 'volunteer'),
    allSkills,
    total: members.length,
  });
});

router.get('/alerts', (req, res) => {
  const all = db.prepare("SELECT * FROM alerts WHERE audience = 'public' ORDER BY id DESC LIMIT 50").all();
  res.locals.pageTitle = res.locals.t('alerts');
  res.render('alerts', { active: all.filter(h.isActiveAlert), past: all.filter((a) => !h.isActiveAlert(a)) });
});

router.get('/support', (req, res) => {
  const needs = db.prepare('SELECT * FROM needs ORDER BY sort_order, id').all();
  res.locals.pageTitle = res.locals.t('support');
  res.render('support', { needs, total: needs.reduce((a, n) => a + (n.amount || 0), 0) });
});

router.get('/contact', (req, res) => {
  res.locals.pageTitle = res.locals.t('contact');
  res.render('contact');
});

router.get('/join', (req, res) => {
  res.locals.pageTitle = res.locals.t('join');
  res.render('join', { bloodGroups: h.BLOOD_GROUPS });
});

router.get('/member', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.locals.pageTitle = res.locals.t('member_area');
  if (!req.member) return res.render('member', { directory: [], alerts: [], me: null });
  const directory = db.prepare(`SELECT id, name, role, designation, phone, phone2, place, blood_group, skills, occupation, photo
    FROM members WHERE active = 1 ORDER BY ${ROLE_ORDER}`).all().map((m) => ({ ...m, skills: h.parseSkills(m.skills) }));
  const alerts = db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT 30').all();
  const me = { ...req.member, skills: h.parseSkills(req.member.skills) };
  delete me.pin_hash;
  res.render('member', { directory, alerts, me, skillOptions: h.SKILLS, bloodGroups: h.BLOOD_GROUPS });
});

router.get('/admin', (req, res) => {
  res.render('admin');
});

module.exports = router;
