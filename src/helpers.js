// View helpers: translations, formatting and shared constants.

const ROLES = [
  { key: 'chairman', en: 'Chairman', ml: 'ചെയർമാൻ', group: 'office' },
  { key: 'vice_chairman', en: 'Vice Chairman', ml: 'വൈസ് ചെയർമാൻ', group: 'office' },
  { key: 'convenor', en: 'Convenor', ml: 'കൺവീനർ', group: 'office' },
  { key: 'joint_convenor', en: 'Joint Convenor', ml: 'ജോയിന്റ് കൺവീനർ', group: 'office' },
  { key: 'treasurer', en: 'Treasurer', ml: 'ട്രഷറർ', group: 'office' },
  { key: 'executive', en: 'Executive Committee', ml: 'എക്സിക്യൂട്ടീവ് കമ്മിറ്റി', group: 'executive' },
  { key: 'volunteer', en: 'Volunteer', ml: 'വളണ്ടിയർ', group: 'volunteer' },
];

const SKILLS = [
  'Swimming', 'Scuba Diving', 'Boat Operation', 'Rope Rescue', 'First Aid', 'Medical / Doctor', 'Nursing',
  'Paramedic / Ambulance', 'Driving (Heavy)', 'Driving (Light)', 'Hydraulic Cutter / Spreader', 'Chainsaw / Tree Cutting',
  'Drone Operation', 'Radio / Communication', 'Electrical', 'Mechanical', 'Search & Rescue', 'Mountaineering',
  'Fire Safety', 'Photography / Media', 'Cooking / Camp Support', 'Counselling', 'Logistics',
];

const MISSION_CATEGORIES = [
  { key: 'landslide', en: 'Landslide', ml: 'ഉരുൾപൊട്ടൽ', icon: '⛰️' },
  { key: 'flood', en: 'Flood Relief', ml: 'പ്രളയം', icon: '🌊' },
  { key: 'water', en: 'Water Rescue', ml: 'ജലരക്ഷ', icon: '🛟' },
  { key: 'accident', en: 'Accident', ml: 'അപകടം', icon: '🚑' },
  { key: 'search', en: 'Search Operation', ml: 'തിരച്ചിൽ', icon: '🔦' },
  { key: 'relief', en: 'Relief / Camp', ml: 'ദുരിതാശ്വാസം', icon: '🤝' },
  { key: 'training', en: 'Training / Awareness', ml: 'പരിശീലനം', icon: '🎓' },
  { key: 'other', en: 'Other', ml: 'മറ്റുള്ളവ', icon: '⭐' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const STRINGS = {
  home: { en: 'Home', ml: 'ഹോം' },
  about: { en: 'About', ml: 'ഞങ്ങളെക്കുറിച്ച്' },
  missions: { en: 'Missions', ml: 'ദൗത്യങ്ങൾ' },
  updates: { en: 'Updates', ml: 'വാർത്തകൾ' },
  gallery: { en: 'Gallery', ml: 'ഗാലറി' },
  team: { en: 'Team', ml: 'ടീം' },
  alerts: { en: 'Alerts', ml: 'അറിയിപ്പുകൾ' },
  support: { en: 'Support Us', ml: 'പിന്തുണയ്ക്കുക' },
  contact: { en: 'Contact', ml: 'ബന്ധപ്പെടുക' },
  join: { en: 'Join as Volunteer', ml: 'വളണ്ടിയറാകുക' },
  member_login: { en: 'Member Login', ml: 'അംഗങ്ങൾക്ക്' },
  member_area: { en: 'Member Area', ml: 'അംഗങ്ങളുടെ പേജ്' },
  members_tab: { en: 'Members', ml: 'അംഗങ്ങൾ' },
  emergency: { en: 'Emergency? Call us', ml: 'അടിയന്തര സാഹചര്യം? വിളിക്കൂ' },
  call_now: { en: 'Call now', ml: 'ഇപ്പോൾ വിളിക്കൂ' },
  founded: { en: 'Founded', ml: 'സ്ഥാപിതം' },
  volunteers: { en: 'Trained volunteers', ml: 'പരിശീലനം ലഭിച്ച വളണ്ടിയർമാർ' },
  awards: { en: 'Awards & honours', ml: 'പുരസ്കാരങ്ങൾ' },
  equipment: { en: 'Rescue equipment', ml: 'രക്ഷാ ഉപകരണങ്ങൾ' },
  years: { en: 'Years of service', ml: 'വർഷത്തെ സേവനം' },
  recent_missions: { en: 'Recent missions', ml: 'പ്രധാന ദൗത്യങ്ങൾ' },
  latest_updates: { en: 'Latest updates', ml: 'പുതിയ വാർത്തകൾ' },
  view_all: { en: 'View all', ml: 'എല്ലാം കാണുക' },
  read_more: { en: 'Read more', ml: 'കൂടുതൽ വായിക്കാം' },
  office_bearers: { en: 'Office Bearers', ml: 'ഭാരവാഹികൾ' },
  executive_committee: { en: 'Executive Committee', ml: 'എക്സിക്യൂട്ടീവ് കമ്മിറ്റി' },
  all_volunteers: { en: 'Our Volunteers', ml: 'ഞങ്ങളുടെ വളണ്ടിയർമാർ' },
  skills: { en: 'Skills', ml: 'കഴിവുകൾ' },
  search: { en: 'Search', ml: 'തിരയുക' },
  filter_skill: { en: 'All skills', ml: 'എല്ലാ കഴിവുകളും' },
  no_items: { en: 'Nothing here yet.', ml: 'ഇവിടെ ഇതുവരെ ഒന്നുമില്ല.' },
  active_alerts: { en: 'Active alerts', ml: 'നിലവിലെ അറിയിപ്പുകൾ' },
  past_alerts: { en: 'Past alerts', ml: 'പഴയ അറിയിപ്പുകൾ' },
  enable_notifications: { en: 'Get alert notifications', ml: 'അറിയിപ്പുകൾ ലഭിക്കാൻ' },
  notifications_on: { en: 'Notifications are on', ml: 'അറിയിപ്പുകൾ ഓണാണ്' },
  share_whatsapp: { en: 'Share on WhatsApp', ml: 'വാട്സാപ്പിൽ പങ്കിടുക' },
  photos: { en: 'Photos', ml: 'ഫോട്ടോകൾ' },
  location: { en: 'Location', ml: 'സ്ഥലം' },
  date: { en: 'Date', ml: 'തീയതി' },
  status_ongoing: { en: 'Ongoing', ml: 'നടന്നുകൊണ്ടിരിക്കുന്നു' },
  status_completed: { en: 'Completed', ml: 'പൂർത്തിയായി' },
  equipment_needs: { en: 'Equipment we need', ml: 'ആവശ്യമായ ഉപകരണങ്ങൾ' },
  total: { en: 'Total', ml: 'ആകെ' },
  fulfilled: { en: 'Received', ml: 'ലഭിച്ചു' },
  address: { en: 'Address', ml: 'വിലാസം' },
  phone: { en: 'Phone', ml: 'ഫോൺ' },
  name: { en: 'Name', ml: 'പേര്' },
  place: { en: 'Place', ml: 'സ്ഥലം' },
  blood_group: { en: 'Blood group', ml: 'രക്തഗ്രൂപ്പ്' },
  message: { en: 'Message', ml: 'സന്ദേശം' },
  submit: { en: 'Submit', ml: 'സമർപ്പിക്കുക' },
  join_intro: { en: 'Want to serve with us? Leave your details and our team will contact you.', ml: 'ഞങ്ങളോടൊപ്പം സേവനം ചെയ്യാൻ താൽപര്യമുണ്ടോ? വിവരങ്ങൾ നൽകൂ, ഞങ്ങൾ ബന്ധപ്പെടാം.' },
  join_thanks: { en: 'Thank you! We will contact you soon.', ml: 'നന്ദി! ഞങ്ങൾ ഉടൻ ബന്ധപ്പെടാം.' },
  follow_us: { en: 'Follow us', ml: 'ഞങ്ങളെ പിന്തുടരുക' },
  registered_trust: { en: 'Registered Charitable Trust', ml: 'രജിസ്റ്റേർഡ് ചാരിറ്റബിൾ ട്രസ്റ്റ്' },
  back: { en: 'Back', ml: 'തിരികെ' },
  language: { en: 'മലയാളം', ml: 'English' },
};

function translator(lang) {
  return (key) => (STRINGS[key] ? STRINGS[key][lang] || STRINGS[key].en : key);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Escapes text, then turns blank-line-separated blocks into paragraphs and links bare URLs.
function paragraphs(text) {
  if (!text) return '';
  return String(text).trim().split(/\n\s*\n/).map((block) => {
    let html = escapeHtml(block.trim());
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return `<p>${html.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ml: ['ജനു', 'ഫെബ്രു', 'മാർ', 'ഏപ്രി', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗ', 'സെപ്', 'ഒക്ടോ', 'നവം', 'ഡിസം'],
};

// Accepts YYYY, YYYY-MM, YYYY-MM-DD or a full timestamp.
function formatDate(value, lang = 'en') {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return String(value);
  const [, y, mo, d] = m;
  const months = MONTHS[lang] || MONTHS.en;
  if (!mo) return y;
  if (!d) return `${months[+mo - 1]} ${y}`;
  return `${+d} ${months[+mo - 1]} ${y}`;
}

function formatINR(n) {
  if (n == null || n === '') return '';
  return '₹' + Number(n).toLocaleString('en-IN');
}

function roleLabel(member, lang = 'en') {
  if (member.designation) return member.designation;
  const r = ROLES.find((x) => x.key === member.role);
  return r ? r[lang] : member.role;
}

function categoryInfo(key) {
  return MISSION_CATEGORIES.find((c) => c.key === key) || MISSION_CATEGORIES[MISSION_CATEGORIES.length - 1];
}

function parseSkills(value) {
  if (Array.isArray(value)) return value;
  try { const v = JSON.parse(value || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

function initials(name) {
  return String(name || '?').replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function telLink(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  return 'tel:' + (digits.startsWith('+') ? digits : digits.length === 10 ? '+91' + digits : digits);
}

function whatsappShare(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

function isActiveAlert(a) {
  return !a.expires_at || new Date(a.expires_at) > new Date();
}

module.exports = {
  ROLES, SKILLS, MISSION_CATEGORIES, BLOOD_GROUPS, STRINGS,
  translator, escapeHtml, paragraphs, formatDate, formatINR, roleLabel, categoryInfo,
  parseSkills, initials, telLink, whatsappShare, isActiveAlert,
};
