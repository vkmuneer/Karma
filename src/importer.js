// Imports volunteers from the Google Forms "Contact Information" spreadsheet (xlsx or csv).
const ExcelJS = require('exceljs');
const { db } = require('./db');
const { BLOOD_GROUPS } = require('./helpers');

// "MUHAMMED BASHEER P.V" -> "Muhammed Basheer P.V"; short tokens (initials, house codes) stay upper-case.
function titleCase(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').split(' ').map((w) => {
    const letters = w.replace(/[^A-Za-z]/g, '');
    if (letters.length <= 2 || /^([A-Za-z]\.)+[A-Za-z]?\.?$/.test(w)) return w.toUpperCase();
    return w.toLowerCase().replace(/[a-z]/, (c) => c.toUpperCase());
  }).join(' ').replace(/\bDr\b\.?/i, 'Dr.').replace(/\(h\)|\(ho\)/gi, (m) => m.toUpperCase());
}

// Returns up to two phone numbers, keeping international numbers in + form.
function splitPhones(raw) {
  if (raw == null) return [];
  const text = typeof raw === 'object' && raw.text ? raw.text : String(raw);
  const chunks = text.split(/[,/]|\.\s+|\s{2,}/).map((c) => c.replace(/[^\d+]/g, '')).filter((c) => c.replace(/\D/g, '').length >= 9);
  return chunks.map((c) => {
    let d = c.replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length > 10) return '+' + d;
    return d;
  }).slice(0, 2);
}

function normBlood(v) {
  const s = String(v || '').toUpperCase().replace(/\s+/g, '')
    .replace(/\+?VE$/, '+').replace(/POS(ITIVE)?$/, '+').replace(/NEG(ATIVE)?$/, '-').replace(/\+-|-\+$/, '-');
  return BLOOD_GROUPS.includes(s) ? s : (s || null);
}

function cellText(cell) {
  const v = cell && cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.hyperlink) return String(v.hyperlink);
  }
  return String(v);
}

async function readRows(filePath, originalName = filePath) {
  const wb = new ExcelJS.Workbook();
  let ws;
  if (/\.csv$/i.test(originalName)) ws = await wb.csv.readFile(filePath);
  else { await wb.xlsx.readFile(filePath); ws = wb.worksheets[0]; }
  if (!ws) throw new Error('No worksheet found');

  const header = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { header[col] = cellText(cell).trim().toLowerCase(); });
  const find = (...names) => header.findIndex((h) => h && names.some((n) => h.includes(n)));
  const cols = {
    name: find('name'),
    address: find('address'),
    phone: find('phone', 'mobile'),
    place: find('place', 'location'),
    blood: find('blood'),
    skills: find('skill'),
    occupation: find('occupation', 'job', 'profession'),
  };
  if (cols.name < 0) throw new Error('Could not find a "Name" column in the first row');

  const rows = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const get = (c) => (c > 0 ? cellText(row.getCell(c)).trim() : '');
    const name = get(cols.name);
    if (!name) return;
    const phones = splitPhones(get(cols.phone));
    rows.push({
      name: titleCase(name),
      address: titleCase(get(cols.address)) || null,
      phone: phones[0] || null,
      phone2: phones[1] || null,
      place: titleCase(get(cols.place)) || null,
      blood_group: normBlood(get(cols.blood)),
      skills: get(cols.skills) ? get(cols.skills).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : null,
      occupation: get(cols.occupation) || null,
    });
  });
  return rows;
}

const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);

// Matches existing members by phone, then by name. Only fills fields present in the sheet.
function upsertMembers(rows) {
  const members = db.prepare('SELECT id, name, phone FROM members').all();
  let added = 0, updated = 0;
  const tx = db.transaction(() => {
    for (const r of rows) {
      const existing = members.find((m) => (r.phone && m.phone && last10(m.phone) === last10(r.phone)))
        || members.find((m) => m.name.toLowerCase() === r.name.toLowerCase());
      if (existing) {
        const fields = ['address', 'phone', 'phone2', 'place', 'blood_group', 'occupation'].filter((f) => r[f]);
        if (r.skills) { r.skills = require('./skills').canonicalize(r.skills); fields.push('skills'); }
        if (!fields.length) continue;
        const values = fields.map((f) => (f === 'skills' ? JSON.stringify(r.skills) : r[f]));
        db.prepare(`UPDATE members SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(...values, existing.id);
        updated++;
      } else {
        const info = db.prepare(`INSERT INTO members (name, address, phone, phone2, place, blood_group, skills, occupation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(r.name, r.address, r.phone, r.phone2, r.place, r.blood_group, JSON.stringify(require('./skills').canonicalize(r.skills || [])), r.occupation);
        members.push({ id: info.lastInsertRowid, name: r.name, phone: r.phone });
        added++;
      }
    }
  });
  tx();
  return { added, updated, total: rows.length };
}

module.exports = { readRows, upsertMembers, titleCase, splitPhones };
