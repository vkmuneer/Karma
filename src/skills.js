// The skill list admins manage (Admin → Skills), plus helpers that keep member skills tidy.
const { db, getSetting, setSetting } = require('./db');
const { SKILLS, parseSkills } = require('./helpers');

const key = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// "boat driving" → "Boat Driving"; names typed with capitals are kept as written.
function tidy(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return t === t.toLowerCase() ? t.replace(/(^|\s)([a-z])/g, (m, sp, c) => sp + c.toUpperCase()) : t;
}

function skillList() {
  const list = getSetting('skills_list');
  return Array.isArray(list) && list.length ? list : SKILLS;
}

function saveList(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const name = tidy(raw);
    if (!name || seen.has(key(name))) continue;
    seen.add(key(name));
    out.push(name);
  }
  setSetting('skills_list', out.slice(0, 300));
  return out;
}

// Maps "swimming " to the list's spelling "Swimming" and drops duplicates.
function canonicalize(skills) {
  const byKey = new Map(skillList().map((s) => [key(s), s]));
  const seen = new Set();
  const out = [];
  for (const raw of skills || []) {
    const name = tidy(raw);
    if (!name || seen.has(key(name))) continue;
    seen.add(key(name));
    out.push(byKey.get(key(name)) || name);
  }
  return out.slice(0, 30);
}

// Every skill in use with how many active members have it, including ones not in the list.
function usage() {
  const counts = new Map();
  for (const m of db.prepare('SELECT skills FROM members WHERE active = 1').all()) {
    for (const s of parseSkills(m.skills)) {
      const k = key(s);
      const entry = counts.get(k) || { name: s, count: 0 };
      entry.count++;
      counts.set(k, entry);
    }
  }
  return counts;
}

function updateMembers(transform) {
  const rows = db.prepare("SELECT id, skills FROM members WHERE skills NOT IN ('[]', '')").all();
  const update = db.prepare('UPDATE members SET skills = ? WHERE id = ?');
  let changed = 0;
  db.transaction(() => {
    for (const r of rows) {
      const before = parseSkills(r.skills);
      const after = transform(before);
      if (JSON.stringify(after) !== JSON.stringify(before)) { update.run(JSON.stringify(after), r.id); changed++; }
    }
  })();
  return changed;
}

function rename(from, to) {
  to = tidy(to);
  if (!to) throw new Error('New name is empty');
  const list = skillList().map((s) => (key(s) === key(from) ? to : s));
  if (!list.some((s) => key(s) === key(to))) list.push(to);
  saveList(list);
  return updateMembers((skills) => canonicalize(skills.map((s) => (key(s) === key(from) ? to : s))));
}

function remove(name, fromMembers) {
  saveList(skillList().filter((s) => key(s) !== key(name)));
  return fromMembers ? updateMembers((skills) => skills.filter((s) => key(s) !== key(name))) : 0;
}

module.exports = { skillList, saveList, canonicalize, usage, rename, remove, skillKey: key };
