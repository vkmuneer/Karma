# Karma Omassery — website & member portal

Website for **കർമ്മ ഓമശ്ശേരി / Karma Omassery Disaster Management Team**, a registered charitable trust of
volunteer rescuers based in Omassery, Kozhikode.

The site works well on phones. Office bearers manage everything from `/admin`, and nobody needs to touch code.

## What's in it

**Public website** (Malayalam by default, with an English toggle)
- Home page with emergency call (SOS) button, live alert banner, stats, featured missions, latest news and photos
- About, Missions (filter by type, with a photo gallery on each mission), News & Updates, Gallery
- Team page: office bearers (Chairman, Convenor, Treasurer…), Executive Committee, and all volunteers with
  their skills, plus search and a skill filter. Phone numbers, addresses and blood groups are **never** shown publicly.
- Alerts page, Support Us page (equipment needs / CSR budget), Contact, and a "Join as Volunteer" form
- Installable as an app on phones (PWA), with offline fallback for pages already visited

**Member portal** (`/member`). Members log in with their phone number and a PIN
- Member-only alerts
- Team phone directory with tap-to-call and a blood-group filter
- Members update their own photo, skills, blood group, occupation and bio
- Phone notifications for alerts

**Admin panel** (`/admin`)
- Dashboard with a to-do list (unassigned office bearers, members without skills or PINs, new join requests)
- **Alerts:** public (site banner) or members-only, info/warning/critical, optional expiry. Sends a push
  notification to subscribed phones and has a one-tap WhatsApp share button for your groups
- **Missions**, **News & Updates**, **Gallery:** photos are resized on the phone before upload
- **Members:** roles, skills, photos, private contact details, PIN generation (sent by WhatsApp),
  and **Import from Excel** (the Google Form "Contact Information" sheet)
- **Join requests:** from the website form, with one tap to add as a member
- **Events** (trainings, awareness classes, drills, camps…) and **Skills** (the skill list members choose from)
- **Equipment needs**, **Site settings** (names, taglines, intro and About text in both languages, phones, social links, stats,
  donation details)
- **Staff & Moderators**: administrators have full access; moderators log in at `/admin` with their own
  username and password and see only the sections ticked for them (Members, Skills and Settings are off by default)

## Run locally

```bash
npm install
ADMIN_PASSWORD='choose-a-strong-password' npm start
# open http://localhost:3000 and http://localhost:3000/admin  (username: admin)
```

If `ADMIN_PASSWORD` is not set on the first start, a random password is printed in the console.
To reset it later (this also restores full admin access): `npm run reset-admin -- admin 'new-password'`.

### First steps after launch
1. Log in at `/admin` and change the password (Account).
2. **Members → Import from Excel:** upload `Contact_Information_final_karma.xlsx` to load phone numbers,
   addresses and blood groups. The repository only contains names and places. The spreadsheet is git-ignored on purpose.
3. Open the Chairman, Convenor and Treasurer and set their **Role**. Add Executive Committee members the same way.
4. Generate PINs for members and send them on WhatsApp. Members can then add their own skills and photos.
5. Add photos to missions, and fill in donation/bank details under Settings.

## Deploying

This is a Node.js (20–26) app with an SQLite database, so it needs a host that runs Node and has a **persistent disk**.
Static hosts such as GitHub Pages or plain Netlify won't work.
All data (database + uploaded photos) lives in one folder, set by `DATA_DIR` (default `./data`). Back it up.

- **VPS (any provider):** `npm ci --omit=dev && DATA_DIR=/var/karma PORT=3000 node server.js` behind Nginx/Caddy with HTTPS
  (use pm2 or systemd to keep it running).
- **Docker:** `docker build -t karma . && docker run -d -p 3000:3000 -v karma-data:/data -e ADMIN_PASSWORD=... karma`
- **Render / Railway / Fly.io:** deploy from this repo with the Dockerfile and attach a persistent volume at `/data`.

Push notifications need **HTTPS** (they also work on `localhost`). On iPhone, members must first "Add to Home Screen".
Set the contact email under Settings (or `VAPID_SUBJECT=mailto:you@example.org`) so push services accept the messages.

| Env var | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `DATA_DIR` | Database + uploads folder (default `./data`) |
| `UPLOAD_DIR` | Override uploads folder (default `$DATA_DIR/uploads`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | First admin account (only used when no admin exists) |
| `VAPID_SUBJECT` | Contact for web push, e.g. `mailto:karma@example.org` |
| `TRUST_PROXY` | Set to `1` on hosting platforms with a proxy in front (Railway, Render, Fly.io) |

## Project layout

```
server.js              app entry
src/db.js              SQLite schema and settings
src/seed.js            first-run content (from the trust's profile document)
src/routes/public.js   public pages (server-rendered EJS)
src/routes/api.js      admin, member, push and join-form API
src/importer.js        Excel/CSV member import
views/                 page templates
public/                CSS, JS (site, admin), service worker, icons
```
