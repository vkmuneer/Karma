// First-run content taken from the trust's own profile documents. Everything here is editable from /admin.
const crypto = require('crypto');
const { db, getSetting, setSetting } = require('./db');
const { hashPassword } = require('./auth');

const SETTINGS = {
  org_name_en: 'Karma Omassery Disaster Management Team',
  org_name_ml: 'കർമ്മ ഓമശ്ശേരി',
  tagline_ml: 'ദുരന്തമുഖങ്ങളിലെ നന്മയുടെ കൈയൊപ്പ്',
  tagline_en: 'A signature of goodness on the frontlines of disaster',
  hero_image: '',
  phones: ['9447911098', '7415102101'],
  whatsapp: '919447911098',
  contact_email: '',
  address: 'Reg. Office: Room No 19/25, Omassery, Omassery PO, Kozhikode Dt. 673582, Kerala',
  facebook: 'https://www.facebook.com/karmaomassery/',
  instagram: 'https://www.instagram.com/karma_omassery/',
  youtube: '',
  map_embed: '',
  founded: '2018-06-14',
  stat_volunteers: '70',
  stat_awards: '50+',
  stat_equipment: '₹6 Lakh+',
  donation_details: 'For CSR support or donations, please contact the office bearers on the numbers above. Your logo can be displayed on rescue boats and equipment.',
  intro_ml: 'മലയോര മേഖലയുടെ പ്രവേശനകവാടമായ ഓമശ്ശേരി ആസ്ഥാനമായി പ്രവർത്തിക്കുന്ന പ്രശംസനീയമായ ഒരു കൂട്ടായ്മയാണ് \'കർമ്മ ഓമശ്ശേരി\'. നാടിന് ആപത്ത് വരുമ്പോൾ സ്വന്തം ജീവൻ പോലും തൃണവൽഗണിച്ച് ദുരന്തനിവാരണ രംഗത്തേക്ക് ഇറങ്ങിത്തിരിക്കുന്ന ഒരുപറ്റം സ്വയംസേവകരായ ചെറുപ്പക്കാരുടെ കൂട്ടായ്മയാണിത്. രജിസ്റ്റർ ചെയ്ത് പ്രവർത്തിക്കുന്ന ഒരു ചാരിറ്റബിൾ ട്രസ്റ്റാണ് കർമ്മ ഓമശ്ശേരി.',
  intro_en: 'Karma Omassery is a much-admired collective based in Omassery, the gateway to the hill region of Kozhikode. It is a group of young volunteers who step into disaster response with no regard for their own safety whenever their land faces danger. Karma Omassery is a registered charitable trust.',
  about_sections: [
    {
      title_ml: 'രൂപീകരണവും പ്രഫഷണൽ മികവും',
      title_en: 'Formation and professional excellence',
      body_ml: '2018 ജൂൺ 14-ന് ഉണ്ടായ കരിഞ്ചോല ഉരുൾപൊട്ടലിൽ രക്ഷാപ്രവർത്തനത്തിന് ഇറങ്ങിയ ഒരു കൂട്ടം യുവാക്കളാണ് \'കർമ ഓമശ്ശേരി\'ക്ക് രൂപം നൽകിയത്. 19 അംഗങ്ങളുമായി പ്രവർത്തനം ആരംഭിച്ച ഈ കൂട്ടായ്മ ഇന്ന് 70 സുസജ്ജരായ വളണ്ടിയർമാരുടെ ഒരു ടീമായി മാറിയിട്ടുണ്ട്.\n\nസമൂഹത്തിന്റെ വിവിധ തുറകളിൽ ജോലി ചെയ്യുന്നവരും വൈവിധ്യമാർന്ന കഴിവുകളുള്ളവരുമാണ് ഇതിലെ അംഗങ്ങൾ. പ്രഫഷണൽ ഏജൻസികളെപ്പോലെ സമർപ്പണബോധത്തോടെയും കൃത്യതയോടെയുമാണ് ഓരോ മിഷനിലും ഇവർ പങ്കാളികളാകുന്നത്.',
      body_en: 'Karma Omassery was formed by a group of young people who stepped in to rescue victims of the Karinchola landslide on 14 June 2018. Starting with 19 members, the collective has grown into a team of 70 well-equipped volunteers.\n\nOur members work in many walks of life and bring a wide range of skills. They take part in every mission with the dedication and precision of a professional agency.',
    },
    {
      title_ml: 'സർക്കാർ സംവിധാനങ്ങൾക്ക് താങ്ങായി',
      title_en: 'Standing with government agencies',
      body_ml: 'നാട്ടിൽ ഉണ്ടാകുന്ന ഏത് അടിയന്തര സാഹചര്യങ്ങളിലും ഫയർഫോഴ്സ്, പോലീസ്, മറ്റ് സർക്കാർ സംവിധാനങ്ങൾ എന്നിവർക്കൊപ്പം തോളോട് തോൾ ചേർന്ന് പ്രവർത്തിക്കാൻ കർമ്മ ഓമശ്ശേരി മുൻപന്തിയിലുണ്ട്. ഔദ്യോഗിക സംവിധാനങ്ങൾക്ക് വലിയൊരു താങ്ങും തണലുമാണ് ഈ പ്രാദേശിക കൂട്ടായ്മ.',
      body_en: 'In every emergency, Karma Omassery works shoulder to shoulder with the Fire & Rescue services, the Police and other government agencies. This local collective is a strong support to the official response system.',
    },
    {
      title_ml: 'ജനകീയ കൂട്ടായ്മ',
      title_en: 'A people\'s collective',
      body_ml: 'ആദ്യകാലങ്ങളിൽ വാടകയ്ക്കെടുത്ത ഉപകരണങ്ങളുമായി പ്രവർത്തനം തുടങ്ങിയ ടീം, പിന്നീട് ഓമശ്ശേരി ഗ്രാമപഞ്ചായത്തിന്റെയും നാട്ടുകാരുടെയും സഹായത്തോടെ മെഷിൻ കട്ടറുകളും ബോട്ടുകളും എഞ്ചിനുകളും പ്രാഥമിക രക്ഷാ ഉപകരണങ്ങളും കരസ്ഥമാക്കി. ഇന്ന് ആറു ലക്ഷത്തിലധികം രൂപയുടെ ഉപകരണങ്ങൾ \'കർമ\'ക്ക് സ്വന്തമായുണ്ട്.\n\nപ്രത്യേകിച്ച് മറ്റ് വരുമാന മാർഗ്ഗങ്ങളൊന്നുമില്ലാത്ത ഈ ട്രസ്റ്റ്, പൊതുജനങ്ങളിൽ നിന്നും പഞ്ചായത്തിൽ നിന്നും ലഭിക്കുന്ന പിന്തുണയും സഹകരണവും കൊണ്ടാണ് തങ്ങളുടെ ചെലവേറിയ മിഷനുകൾ മുന്നോട്ടുകൊണ്ടുപോകുന്നത്. ജനങ്ങളുടെ വിശ്വാസ്യതയും നാടിന്റെ പിന്തുണയുമാണ് കർമ്മ ഓമശ്ശേരിയുടെ ഏറ്റവും വലിയ കരുത്ത്.',
      body_en: 'The team began with rented equipment. With help from Omassery Grama Panchayat and local people, it has since acquired machine cutters, boats, engines and basic rescue gear. Today Karma owns equipment worth more than ₹6 lakh.\n\nThe trust has no other source of income. It carries out its costly missions with the support of the public and the Panchayat. The trust of the people and the backing of the community are Karma Omassery\'s greatest strength.',
    },
  ],
};

const MISSIONS = [
  { title: 'കരിഞ്ചോല ഉരുൾപൊട്ടൽ (Karinchola Landslide)', location: 'Karinchola, Kattippara, Kozhikode', category: 'landslide', event_date: '2018-06-14', featured: 1,
    summary: 'സംഘടനയുടെ തുടക്കം കുറിച്ച ആദ്യ സജീവദൗത്യം; അതിവേഗ രക്ഷാപ്രവർത്തനം.',
    body: 'കരിഞ്ചോലയിലുണ്ടായ ഉരുൾപൊട്ടലിലെ രക്ഷാപ്രവർത്തനത്തോടെയാണ് കർമ്മ ഓമശ്ശേരി ദുരന്തനിവാരണ രംഗത്ത് സജീവമാകുന്നത്. 19 അംഗങ്ങളുമായാണ് ടീം അന്ന് രക്ഷാപ്രവർത്തനത്തിന് ഇറങ്ങിയത്.' },
  { title: 'ചെങ്ങന്നൂർ & കുട്ടനാട് പ്രളയം (Chengannur & Kuttanad Floods)', location: 'Chengannur, Kuttanad', category: 'flood', event_date: '2018-08',
    summary: '2018-ലെ മഹാപ്രളയത്തിൽ ചെങ്ങന്നൂരിലും കുട്ടനാട്ടിലും രക്ഷാപ്രവർത്തനം.',
    body: '2018-ലെ മഹാപ്രളയത്തിൽ വെള്ളത്തിൽ കുടുങ്ങിയവരെ രക്ഷിക്കാനും ദുരിതാശ്വാസം എത്തിക്കാനും ടീം ചെങ്ങന്നൂരിലും കുട്ടനാട്ടിലും പ്രവർത്തിച്ചു.' },
  { title: 'പുത്തുമല ഉരുൾപൊട്ടൽ (Puthumala Landslide)', location: 'Puthumala, Wayanad', category: 'landslide', event_date: '2019-08',
    summary: 'വയനാട്ടിലെ ദുരന്തഭൂമിയിൽ ദിവസങ്ങളോളം നടത്തിയ തിരച്ചിൽ.',
    body: 'വയനാട്ടിലെ പുത്തുമലയിൽ ഉണ്ടായ വൻ ഉരുൾപൊട്ടലിൽ ദിവസങ്ങളോളം പ്രതികൂല കാലാവസ്ഥയോട് പൊരുതി ടീം രക്ഷാപ്രവർത്തനം നടത്തി.' },
  { title: 'നിലമ്പൂർ ഉരുൾപൊട്ടൽ (Nilambur Landslide)', location: 'Nilambur, Malappuram', category: 'landslide', event_date: '2019-08',
    summary: 'നിലമ്പൂരിലെ ഉരുൾപൊട്ടലിൽ തിരച്ചിലും രക്ഷാപ്രവർത്തനവും.',
    body: 'നിലമ്പൂരിൽ ഉണ്ടായ വൻ ഉരുൾപൊട്ടലിൽ പ്രതികൂല കാലാവസ്ഥയിലും ദിവസങ്ങളോളം ടീം തിരച്ചിലിൽ പങ്കാളികളായി.' },
  { title: 'പ്രളയ ദുരിതാശ്വാസം 2019 (Flood Relief)', location: 'Kozhikode', category: 'flood', event_date: '2019',
    summary: '2019 ലെയും തുടർന്നുള്ള പ്രളയങ്ങളിലും നൂറുകണക്കിന് കുടുംബങ്ങൾക്ക് ആശ്വാസമായി മാറിയ ഇടപെടൽ.',
    body: '2019-ലെ മഹാപ്രളയ സമയത്തും തുടർന്നുള്ള പ്രളയകാലങ്ങളിലും തങ്ങളാൽ കഴിയുന്ന വിധത്തിൽ നാടിനും നാട്ടുകാർക്കും ആശ്വാസമേകാൻ ടീമിന് സാധിച്ചു.' },
  { title: 'കരിപ്പൂർ വിമാനദുരന്തം (Karipur Air Crash)', location: 'Calicut International Airport, Karipur', category: 'accident', event_date: '2020-08-07', featured: 1,
    summary: 'കരിപ്പൂർ വിമാനത്താവളത്തിൽ എയർ ഇന്ത്യ എക്സ്പ്രസ് വിമാനം അപകടത്തിൽപ്പെട്ടപ്പോൾ നടത്തിയ രക്ഷാപ്രവർത്തനം.',
    body: '2020 ഓഗസ്റ്റ് 7-ന് കോഴിക്കോട് കരിപ്പൂർ അന്താരാഷ്ട്ര വിമാനത്താവളത്തിൽ വന്ദേ ഭാരത് ദൗത്യത്തിന്റെ ഭാഗമായി ദുബായിൽ നിന്ന് എത്തിയ എയർ ഇന്ത്യ എക്സ്പ്രസ് വിമാനം റൺവേയിൽ നിന്ന് തെന്നിമാറി താഴേക്ക് പതിച്ചുണ്ടായ ദുരന്തത്തിൽ കർമ്മ ടീം രക്ഷാപ്രവർത്തനത്തിൽ പങ്കാളികളായി.' },
  { title: 'ഷിരൂർ ദുരന്തം (Shirur, Karnataka)', location: 'Shirur, Uttara Kannada, Karnataka', category: 'search', event_date: '2024-07', featured: 1,
    summary: 'അതീവ പ്രതികൂല സാഹചര്യത്തിൽ കർണ്ണാടക ഷിരൂരിൽ നടത്തിയ സമാനതകളില്ലാത്ത രക്ഷാപ്രവർത്തനം.',
    body: 'അതീവ പ്രതികൂല സാഹചര്യത്തിൽ കർണ്ണാടകയിലെ ഷിരൂരിൽ ഉണ്ടായ മണ്ണിടിച്ചിലിൽ കാണാതായവർക്കായുള്ള തിരച്ചിലിൽ കർമ്മ ടീം പങ്കാളികളായി.' },
  { title: 'മുണ്ടക്കൈ ഉരുൾപൊട്ടൽ (Mundakkai, Wayanad)', location: 'Mundakkai & Chooralmala, Wayanad', category: 'landslide', event_date: '2024-07-30', featured: 1,
    summary: 'വയനാട്ടിലെ ദുരന്തഭൂമിയിൽ ആഴ്ചകളോളം തളരാതെ നടത്തിയ തിരച്ചിലും ജീവൻരക്ഷാ സേവനങ്ങളും.',
    body: 'വയനാട്ടിലെ മുണ്ടക്കൈയിൽ ഉണ്ടായ ഉരുൾപൊട്ടലിൽ ആഴ്ചകളോളം പ്രതികൂല കാലാവസ്ഥയോട് പൊരുതി ടീം തിരച്ചിലും ജീവൻരക്ഷാ പ്രവർത്തനങ്ങളും നടത്തി.' },
  { title: 'അരിപ്പാറ & ആനക്കാംപൊയിൽ ജലരക്ഷ (Waterfall Rescues)', location: 'Arippara, Anakkampoyil, Pathankayam', category: 'water', event_date: '', status: 'ongoing',
    summary: 'അപകടക്കയങ്ങളിലും കുത്തൊഴുക്കുകളിലും കാണാതായവരെ കണ്ടെത്താൻ നടത്തുന്ന ദൗത്യങ്ങൾ.',
    body: 'മലയോര മേഖലയിലെ പ്രധാന വിനോദസഞ്ചാര കേന്ദ്രങ്ങളായ അരിപ്പാറ, ആനക്കാംപൊയിൽ, പതങ്കയം വെള്ളച്ചാട്ടങ്ങളിൽ ഉണ്ടാകുന്ന അപകടങ്ങളിൽ ജീവൻ പണയം വെച്ചാണ് ടീം ഇറങ്ങിച്ചെല്ലുന്നത്. കാണാതാകുന്നവരെ കണ്ടെത്താനും രക്ഷിക്കാനുമായി ദിവസങ്ങളോളം തളരാതെ പരിശ്രമിക്കാറുണ്ട്.' },
];

const NEEDS = [
  { item: 'ട്രാൻസ്‌പോർട്ടേഷൻ വാഹനം (Rescue transport vehicle)', purpose: 'യന്ത്രോപകരണങ്ങളും രക്ഷാപ്രവർത്തനത്തിനുള്ള ആളുകളെയും എത്തിക്കാൻ', amount: 1100000 },
  { item: 'ഹൈഡ്രോളിക് കട്ടറുകളും സ്പ്രെഡറുകളും (Hydraulic cutters & spreaders)', purpose: 'അവശിഷ്ടങ്ങൾ തകർത്ത് ആളുകളെ പുറത്തെടുക്കാൻ', amount: 450000 },
  { item: 'ഡ്രോൺ ക്യാമറകളും തെർമൽ സിസ്റ്റവും (Drone & thermal camera)', purpose: 'നദികളിലെയും മറ്റും ആളുകളെ കണ്ടെത്താൻ', amount: 350000 },
  { item: 'വളണ്ടിയർ പി.പി.ഇ & ലൈഫ് ജാക്കറ്റുകൾ (PPE & life jackets)', purpose: '70 രക്ഷാപ്രവർത്തകരുടെ സുരക്ഷയ്ക്കായി', amount: 250000 },
  { item: 'സാറ്റലൈറ്റ് കമ്യൂണിക്കേഷൻ സിസ്റ്റം (Satellite communication)', purpose: 'നെറ്റ്‌വർക്ക് ഇല്ലാത്ത സ്ഥലങ്ങളിലെ ആശയവിനിമയത്തിന്', amount: 200000 },
  { item: 'പ്രഥമശുശ്രൂഷ സമഗ്ര കിറ്റുകൾ (Comprehensive first-aid kits)', purpose: 'അടിയന്തര വൈദ്യസഹായം ലഭ്യമാക്കാൻ', amount: 150000 },
];

function seed() {
  if (getSetting('seeded')) return;

  for (const [k, v] of Object.entries(SETTINGS)) if (getSetting(k) === null) setSetting(k, v);

  const insMission = db.prepare(`INSERT INTO missions (title, location, category, event_date, status, summary, body, featured)
    VALUES (@title, @location, @category, @event_date, @status, @summary, @body, @featured)`);
  for (const m of MISSIONS) insMission.run({ status: 'completed', featured: 0, ...m });

  const insNeed = db.prepare('INSERT INTO needs (item, purpose, amount, sort_order) VALUES (?, ?, ?, ?)');
  NEEDS.forEach((n, i) => insNeed.run(n.item, n.purpose, n.amount, i + 1));

  // Names and places only; phone, address and blood group come from the private spreadsheet via Admin → Members → Import.
  const insMember = db.prepare('INSERT INTO members (name, place) VALUES (?, ?)');
  for (const v of require('../seed/volunteers.json')) insMember.run(v.name, v.place);

  db.prepare(`INSERT INTO updates (title, body, published_at, pinned) VALUES (?, ?, date('now'), 1)`).run(
    'കർമ്മ ഓമശ്ശേരിയുടെ പുതിയ വെബ്സൈറ്റ്',
    'കർമ്മ ഓമശ്ശേരി ഡിസാസ്റ്റർ മാനേജ്മെന്റ് ടീമിന്റെ ഔദ്യോഗിക വെബ്സൈറ്റിലേക്ക് സ്വാഗതം. ഞങ്ങളുടെ ദൗത്യങ്ങൾ, അറിയിപ്പുകൾ, ഫോട്ടോകൾ എന്നിവ ഇവിടെ ലഭ്യമാകും.\n\nWelcome to the official website of Karma Omassery Disaster Management Team. Follow our missions, alerts and photos here.',
  );

  setSetting('seeded', true);
}

function ensureAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  if (count > 0) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('base64url');
  db.prepare('INSERT INTO admins (username, name, pass_hash) VALUES (?, ?, ?)').run(username, 'Administrator', hashPassword(password));
  console.log('\n==============================================');
  console.log(' Admin account created');
  console.log(`   username: ${username}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`   password: ${password}`);
  console.log(' Log in at /admin and change the password.');
  console.log('==============================================\n');
}

module.exports = { seed, ensureAdmin };
