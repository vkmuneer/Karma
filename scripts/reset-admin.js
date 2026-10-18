// Usage: npm run reset-admin -- <username> <new-password>
const { db } = require('../src/db');
const { hashPassword } = require('../src/auth');

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 8) {
  console.error('Usage: npm run reset-admin -- <username> <new-password (min 8 chars)>');
  process.exit(1);
}
const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
if (existing) db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').run(hashPassword(password), existing.id);
else db.prepare('INSERT INTO admins (username, name, pass_hash) VALUES (?, ?, ?)').run(username, username, hashPassword(password));
db.prepare("DELETE FROM sessions WHERE kind = 'admin'").run();
console.log(`${existing ? 'Password reset' : 'Admin created'} for "${username}".`);
