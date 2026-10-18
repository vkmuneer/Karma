const webpush = require('web-push');
const { db, getSetting, setSetting } = require('./db');

function vapidKeys() {
  let keys = getSetting('vapid_keys');
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    setSetting('vapid_keys', keys);
  }
  return keys;
}

function configure() {
  const keys = vapidKeys();
  const email = getSetting('contact_email');
  const subject = process.env.VAPID_SUBJECT || (email ? `mailto:${email}` : 'mailto:admin@example.org');
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
}

function publicKey() {
  return vapidKeys().publicKey;
}

function saveSubscription(sub, memberId = null) {
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new Error('Invalid subscription');
  }
  if (!/^https:\/\//.test(sub.endpoint)) throw new Error('Invalid endpoint');
  db.prepare(`INSERT INTO push_subs (endpoint, keys, member_id) VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys, member_id = COALESCE(excluded.member_id, push_subs.member_id)`)
    .run(sub.endpoint, JSON.stringify({ p256dh: sub.keys.p256dh, auth: sub.keys.auth }), memberId);
}

function removeSubscription(endpoint) {
  db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(endpoint);
}

// Sends a notification for an alert. Member-only alerts go to devices linked to a member login.
async function sendAlert(alert) {
  configure();
  const subs = alert.audience === 'public'
    ? db.prepare('SELECT * FROM push_subs').all()
    : db.prepare('SELECT * FROM push_subs WHERE member_id IS NOT NULL').all();
  const payload = JSON.stringify({
    title: (alert.level === 'critical' ? '🚨 ' : alert.level === 'warning' ? '⚠️ ' : '') + alert.title,
    body: (alert.message || '').slice(0, 240),
    url: alert.audience === 'public' ? `/alerts#alert-${alert.id}` : `/member#alert-${alert.id}`,
    tag: `alert-${alert.id}`,
  });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, payload, { TTL: 24 * 3600, urgency: alert.level === 'critical' ? 'high' : 'normal' });
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) removeSubscription(s.endpoint);
      else console.warn('Push failed:', err.statusCode || err.message);
    }
  }));
  return { sent, total: subs.length };
}

module.exports = { publicKey, saveSubscription, removeSubscription, sendAlert };
