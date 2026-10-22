// Admin panel (single page). Builds all DOM with el() so user content is never parsed as HTML.
(function () {
  const { api, uploadImage } = window.Karma;
  const app = document.getElementById('app');
  let META = null;
  let ADMIN = null;
  let current = 'dashboard';

  // ---------- tiny DOM helpers ----------
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'value') node.value = v;
      else if (k === 'checked') node.checked = Boolean(v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return node;
  }
  function toast(msg, isErr) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, isErr ? 6000 : 3500);
  }
  const fail = (err) => toast(err.message || String(err), true);
  // SQLite CURRENT_TIMESTAMP values are UTC without a zone marker.
  const fmtDate = (v) => {
    if (!v) return '';
    const str = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) ? v.replace(' ', 'T') + 'Z' : v;
    const d = new Date(str);
    return isNaN(d) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const roleName = (key) => (META.roles.find((r) => r.key === key) || { en: key }).en;
  const catName = (key) => (META.categories.find((c) => c.key === key) || { en: key }).en;
  const evCatName = (key) => (META.eventCategories.find((c) => c.key === key) || { en: key }).en;
  const telDigits = (p) => String(p || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');

  // ---------- resource schemas ----------
  const SCHEMAS = {
    alerts: {
      title: 'Alerts', singular: 'alert',
      help: 'Public alerts show as a banner on the website. Member alerts are only visible to logged-in members. Tick "Send notification" to push it to phones that enabled notifications, and use the WhatsApp button to post in your groups.',
      fields: () => [
        { name: 'title', label: 'Title', required: true },
        { name: 'message', label: 'Message', type: 'textarea', rows: 5 },
        { name: 'level', label: 'Level', type: 'select', options: [['info', 'Info'], ['warning', 'Warning'], ['critical', 'Critical / Emergency']], default: 'info' },
        { name: 'audience', label: 'Who can see it', type: 'select', options: [['members', 'Members only'], ['public', 'Public (website banner)']], default: 'members' },
        { name: 'expires_at', label: 'Hide after (optional)', type: 'datetime' },
        { name: '_push', label: 'Send notification to phones now', type: 'checkbox', virtual: true, default: true },
      ],
      row: (a) => ({
        title: a.title, sub: `${fmtDate(a.created_at)} · ${a.audience === 'public' ? 'Public' : 'Members'}${a.pushed_count ? ` · pushed to ${a.pushed_count}` : ''}`,
        badges: [[a.level, a.level === 'critical' ? 'b-crit' : a.level === 'warning' ? 'b-warn' : ''], a.expires_at && new Date(a.expires_at) < new Date() ? ['expired', ''] : ['active', 'b-ok']],
      }),
      afterSave: async (row, values, isNew) => {
        if (values._push) {
          try {
            const r = await api(`/api/admin/alerts/${row.id}/push`, { method: 'POST' });
            toast(`Notification sent to ${r.sent} of ${r.total} devices`);
          } catch (err) { fail(err); }
        }
      },
      extra: (row) => row && el('div', { class: 'quick' },
        el('a', { class: 'btn btn-whatsapp btn-sm', target: '_blank', rel: 'noopener', href: 'https://wa.me/?text=' + encodeURIComponent(`*${row.title}*\n${row.message || ''}\n— കർമ്മ ഓമശ്ശേരി`) }, 'Share on WhatsApp'),
        el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: async (e) => {
          e.target.disabled = true;
          try { const r = await api(`/api/admin/alerts/${row.id}/push`, { method: 'POST' }); toast(`Notification sent to ${r.sent} of ${r.total} devices`); } catch (err) { fail(err); }
          e.target.disabled = false;
        } }, 'Send notification again')),
    },
    missions: {
      title: 'Missions', singular: 'mission',
      help: 'Rescue operations shown on the Missions page. Dates can be a full date (2024-07-30), a month (2024-07) or just a year (2019). Add as many photos as you like; if no cover photo is chosen, the first photo is used.',
      fields: () => [
        { name: 'title', label: 'Title', required: true },
        { name: 'location', label: 'Location' },
        { name: 'category', label: 'Type', type: 'select', options: META.categories.map((c) => [c.key, c.en + ' · ' + c.ml]), default: 'other' },
        { name: 'status', label: 'Status', type: 'select', options: [['completed', 'Completed'], ['ongoing', 'Ongoing (shows LIVE badge)']], default: 'completed' },
        { name: 'event_date', label: 'Date', placeholder: 'YYYY-MM-DD, YYYY-MM or YYYY', half: true },
        { name: 'end_date', label: 'End date (optional)', placeholder: 'YYYY-MM-DD', half: true },
        { name: 'summary', label: 'Short summary (shown on cards)', type: 'textarea', rows: 2 },
        { name: 'body', label: 'Full story', type: 'textarea', rows: 8 },
        { name: 'cover', label: 'Cover photo', type: 'image' },
        { name: 'volunteers_count', label: 'Volunteers deployed', type: 'number', half: true },
        { name: 'featured', label: 'Show on home page first', type: 'checkbox' },
      ],
      row: (m) => ({ thumb: m.cover, glyph: (META.categories.find((c) => c.key === m.category) || {}).icon, title: m.title, sub: [m.event_date, m.location].filter(Boolean).join(' · '), badges: [[catName(m.category), ''], m.status === 'ongoing' && ['LIVE', 'b-crit'], m.featured && ['featured', 'b-signal']] }),
      extra: (row) => linkedPhotos('mission_id', row),
    },
    events: {
      title: 'Events', singular: 'event',
      help: 'Trainings, awareness classes, mock drills, camps, meetings and felicitations. Events with a future date appear under "Upcoming" on the website and move to "Past events" automatically. Add as many photos as you like.',
      fields: () => [
        { name: 'title', label: 'Title', required: true },
        { name: 'category', label: 'Type', type: 'select', options: META.eventCategories.map((c) => [c.key, c.en + ' · ' + c.ml]), default: 'training' },
        { name: 'event_date', label: 'Date', type: 'date', half: true, required: true },
        { name: 'end_date', label: 'End date (multi-day events)', type: 'date', half: true },
        { name: 'event_time', label: 'Time', placeholder: 'e.g. 10:00 AM – 1:00 PM', half: true },
        { name: 'venue', label: 'Venue', half: true },
        { name: 'summary', label: 'Short summary (shown on cards)', type: 'textarea', rows: 2 },
        { name: 'body', label: 'Details / report', type: 'textarea', rows: 8 },
        { name: 'cover', label: 'Cover photo (optional)', type: 'image' },
        { name: 'register_link', label: 'Registration / Google Form link (optional)', type: 'url', placeholder: 'https://…' },
        { name: 'featured', label: 'Highlight on home page', type: 'checkbox' },
      ],
      row: (e) => {
        const upcoming = (e.end_date || e.event_date || '') >= new Date().toISOString().slice(0, 10);
        return { thumb: e.cover, glyph: '📅', title: e.title, sub: [e.event_date, e.venue].filter(Boolean).join(' · '), badges: [[evCatName(e.category), ''], upcoming && ['upcoming', 'b-signal'], e.featured && ['featured', 'b-ink']] };
      },
      extra: (row) => linkedPhotos('event_id', row),
    },
    updates: {
      title: 'News & Updates', singular: 'update',
      help: 'News posts, event reports and announcements. Pinned posts stay on top.',
      fields: () => [
        { name: 'title', label: 'Title', required: true },
        { name: 'published_at', label: 'Date', type: 'date', default: new Date().toISOString().slice(0, 10) },
        { name: 'cover', label: 'Photo', type: 'image' },
        { name: 'body', label: 'Text', type: 'textarea', rows: 10 },
        { name: 'pinned', label: 'Pin to top', type: 'checkbox' },
      ],
      row: (u) => ({ thumb: u.cover, glyph: '📰', title: u.title, sub: fmtDate(u.published_at || u.created_at), badges: [u.pinned && ['pinned', 'b-signal']] }),
    },
    members: {
      title: 'Members & Volunteers', singular: 'member',
      help: 'Set the role to Chairman, Convenor, Treasurer or Executive Committee to show someone under Office Bearers on the Team page. Phone, address and blood group are never shown publicly — only to logged-in members.',
      fields: () => [
        { name: 'photo', label: 'Photo', type: 'image', maxSide: 800 },
        { name: 'name', label: 'Name', required: true },
        { name: 'role', label: 'Role', type: 'select', options: META.roles.map((r) => [r.key, `${r.en} · ${r.ml}`]), default: 'volunteer', half: true },
        { name: 'designation', label: 'Custom title (optional)', placeholder: 'e.g. Rescue Team Captain', half: true },
        { name: 'phone', label: 'Phone (used for member login)', type: 'tel', half: true },
        { name: 'phone2', label: 'Second phone', type: 'tel', half: true },
        { name: 'place', label: 'Place', half: true },
        { name: 'blood_group', label: 'Blood group', type: 'select', options: [['', '—']].concat(META.bloodGroups.map((b) => [b, b])), half: true },
        { name: 'occupation', label: 'Occupation', half: true },
        { name: 'joined_year', label: 'Joined (year)', half: true },
        { name: 'skills', label: 'Skills', type: 'tags', suggestions: () => META.skills, hint: 'Tap a suggestion, or type any new skill and tap Add. Manage the suggestion list under Skills.' },
        { name: 'bio', label: 'Short bio', type: 'textarea', rows: 3 },
        { name: 'address', label: 'Address (private)', type: 'textarea', rows: 2 },
        { name: 'sort_order', label: 'Order within role (lower first)', type: 'number', default: 100, half: true },
        { name: 'show_public', label: 'Show on public Team page', type: 'checkbox', default: true },
        { name: 'active', label: 'Active member (can log in)', type: 'checkbox', default: true },
      ],
      row: (m) => ({ thumb: m.photo, initials: m.name, title: m.name, sub: [m.place, m.phone, (m.skills || []).join(', ')].filter(Boolean).join(' · '), badges: [m.role !== 'volunteer' && [roleName(m.role), 'b-ink'], m.blood_group && [m.blood_group, ''], !m.active && ['inactive', 'b-warn'], m.has_pin && ['PIN', 'b-ok']] }),
      search: (m) => [m.name, m.place, m.phone, m.blood_group, (m.skills || []).join(' '), roleName(m.role)].join(' '),
      filters: (rows) => {
        const used = new Map();
        rows.forEach((m) => (m.skills || []).forEach((sk) => {
          const entry = used.get(sk.toLowerCase()) || { name: sk, n: 0 };
          entry.n++;
          used.set(sk.toLowerCase(), entry);
        }));
        return [['', 'All members'],
          { group: 'Role', options: META.roles.map((r) => ['role:' + r.key, r.en]) },
          { group: 'Skill', options: [...used.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, v]) => ['skill:' + k, `${v.name} (${v.n})`]) }];
      },
      filterBy: (m, f) => {
        if (!f) return true;
        const [kind, val] = [f.slice(0, f.indexOf(':')), f.slice(f.indexOf(':') + 1)];
        return kind === 'role' ? m.role === val : (m.skills || []).some((sk) => sk.toLowerCase() === val);
      },
      extra: (row) => row && memberPin(row),
      headActions: () => [el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: importMembers }, 'Import from Excel')],
    },
    join_requests: {
      title: 'Join Requests', singular: 'request', noCreate: true,
      help: 'People who filled the "Join as Volunteer" form on the website.',
      fields: () => [
        { name: 'name', label: 'Name', required: true },
        { name: 'phone', label: 'Phone', type: 'tel', half: true },
        { name: 'place', label: 'Place', half: true },
        { name: 'blood_group', label: 'Blood group', half: true },
        { name: 'status', label: 'Status', type: 'select', options: [['new', 'New'], ['contacted', 'Contacted'], ['added', 'Added as member'], ['rejected', 'Not suitable']], half: true },
        { name: 'skills', label: 'Skills' },
        { name: 'message', label: 'Message', type: 'textarea', rows: 3 },
      ],
      row: (j) => ({ initials: j.name, title: j.name, sub: [j.phone, j.place, fmtDate(j.created_at)].filter(Boolean).join(' · '), badges: [[j.status, j.status === 'new' ? 'b-signal' : '']] }),
      extra: (row) => row && el('div', { class: 'quick' },
        row.phone && el('a', { class: 'btn btn-whatsapp btn-sm', target: '_blank', rel: 'noopener', href: `https://wa.me/${telDigits(row.phone)}` }, 'WhatsApp'),
        row.status !== 'added' && el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
          try {
            await api('/api/admin/r/members', { method: 'POST', body: { name: row.name, phone: row.phone, place: row.place, blood_group: row.blood_group, skills: String(row.skills || '').split(',') } });
            await api(`/api/admin/r/join_requests/${row.id}`, { method: 'PUT', body: { status: 'added' } });
            toast(`${row.name} added to members`);
            closeSheet(); render();
          } catch (err) { fail(err); }
        } }, 'Add as member')),
    },
    needs: {
      title: 'Equipment Needs', singular: 'item',
      help: 'The equipment list and budget shown on the Support Us page. Tick "Received" when an item is sponsored.',
      fields: () => [
        { name: 'item', label: 'Item', required: true },
        { name: 'purpose', label: 'Why it is needed', type: 'textarea', rows: 2 },
        { name: 'amount', label: 'Estimated cost (₹)', type: 'number', half: true },
        { name: 'sort_order', label: 'Order', type: 'number', default: 100, half: true },
        { name: 'fulfilled', label: 'Received / sponsored', type: 'checkbox' },
      ],
      row: (n) => ({ glyph: '🛠️', title: n.item, sub: n.amount ? '₹' + Number(n.amount).toLocaleString('en-IN') : '', badges: [n.fulfilled && ['received', 'b-ok']] }),
    },
  };

  // ---------- form builder ----------
  function buildField(f, value) {
    const id = 'f-' + f.name;
    if (f.type === 'checkbox') {
      const input = el('input', { type: 'checkbox', id, name: f.name, checked: value == null ? f.default : Boolean(value) });
      return { node: el('label', { class: 'check', for: id }, input, f.label), get: () => input.checked };
    }
    if (f.type === 'image') {
      let url = value || '';
      const preview = el('div', { class: 'preview' });
      const file = el('input', { type: 'file', accept: 'image/*', class: 'sr-only', id });
      const removeBtn = el('button', { class: 'btn btn-outline btn-sm', type: 'button' }, 'Remove');
      const paint = () => {
        preview.replaceChildren(url ? el('img', { src: url, alt: '' }) : 'No photo');
        removeBtn.hidden = !url;
      };
      removeBtn.addEventListener('click', () => { url = ''; paint(); });
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        preview.replaceChildren('Uploading…');
        try { url = await uploadImage(file.files[0], f.maxSide || 1600); } catch (err) { fail(err); }
        file.value = '';
        paint();
      });
      paint();
      return {
        node: el('div', { class: 'field' }, el('span', { class: 'label' }, f.label),
          el('div', { class: 'img-field' }, preview, el('label', { class: 'btn btn-outline btn-sm', for: id }, 'Choose photo'), file, removeBtn)),
        get: () => url,
      };
    }
    if (f.type === 'tags') {
      let tags = Array.isArray(value) ? [...value] : [];
      const input = el('input', { id, placeholder: 'Type a skill, then tap Add', autocomplete: 'off', enterkeyhint: 'done' });
      const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm tag-add' }, 'Add');
      const box = el('div', { class: 'tags-input' });
      const suggest = el('div', { class: 'suggest' });
      const add = (t) => {
        for (const part of String(t).split(',')) {
          const v = part.trim().replace(/\s+/g, ' ');
          if (!v || tags.some((x) => x.toLowerCase() === v.toLowerCase())) continue;
          // Use the skill list's spelling when it matches ("swimming" → "Swimming").
          tags.push(f.suggestions().find((sug) => sug.toLowerCase() === v.toLowerCase()) || v);
        }
        paint();
      };
      const paint = () => {
        box.replaceChildren(...tags.map((t) => el('span', { class: 't' }, t, el('button', { type: 'button', 'aria-label': 'Remove ' + t, onclick: () => { tags = tags.filter((x) => x !== t); paint(); } }, '×'))), input, addBtn);
        const have = new Set(tags.map((t) => t.toLowerCase()));
        suggest.replaceChildren(...f.suggestions().filter((sug) => !have.has(sug.toLowerCase())).map((sug) => el('button', { type: 'button', onclick: () => add(sug) }, '+ ' + sug)));
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); input.value = ''; input.focus(); }
        if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); paint(); input.focus(); }
      });
      // Phone keyboards often send no Enter/comma key events, so also react to typed commas and the Add button.
      input.addEventListener('input', () => { if (input.value.includes(',')) { add(input.value); input.value = ''; input.focus(); } });
      addBtn.addEventListener('click', () => { add(input.value); input.value = ''; input.focus(); });
      input.addEventListener('blur', (e) => { if (input.value && e.relatedTarget !== addBtn) { add(input.value); input.value = ''; } });
      paint();
      const hint = f.hint ? el('p', { class: 'help', style: 'margin:4px 0 0' }, f.hint) : null;
      return { node: el('div', { class: 'field' }, el('label', { for: id }, f.label), box, suggest, hint), get: () => tags };
    }
    let input;
    const v = value == null ? (f.default ?? '') : value;
    if (f.type === 'textarea') input = el('textarea', { id, rows: f.rows || 4 });
    else if (f.type === 'select') input = el('select', { id }, f.options.map(([val, label]) => el('option', { value: val }, label)));
    else if (f.type === 'datetime') input = el('input', { id, type: 'datetime-local' });
    else input = el('input', { id, type: f.type || 'text', placeholder: f.placeholder, inputmode: f.type === 'number' ? 'numeric' : null });
    if (f.type === 'datetime') {
      if (v) { const d = new Date(v); if (!isNaN(d)) input.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    } else input.value = v;
    if (f.required) input.required = true;
    return {
      node: el('div', { class: 'field' + (f.half ? ' half' : '') }, el('label', { for: id }, f.label + (f.required ? ' *' : '')), input),
      get: () => (f.type === 'datetime' ? (input.value ? new Date(input.value).toISOString() : '') : input.value),
    };
  }

  function buildForm(fields, values) {
    const getters = {};
    const nodes = [];
    let pendingHalf = null;
    for (const f of fields) {
      const built = buildField(f, values ? values[f.name] : undefined);
      getters[f.name] = built.get;
      if (f.half) {
        if (pendingHalf) { nodes.push(el('div', { class: 'field-row' }, pendingHalf, built.node)); pendingHalf = null; }
        else pendingHalf = built.node;
      } else {
        if (pendingHalf) { nodes.push(pendingHalf); pendingHalf = null; }
        nodes.push(built.node);
      }
    }
    if (pendingHalf) nodes.push(pendingHalf);
    const read = () => Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
    return { nodes, read };
  }

  // ---------- sheet (editor panel) ----------
  let sheetEl = null;
  function openSheet(title, content, foot) {
    closeSheet();
    const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('div', { class: 'sheet-head' }, el('h2', {}, title), el('button', { class: 'sheet-close', type: 'button', 'aria-label': 'Close', onclick: closeSheet }, '×')),
      content, foot ? el('div', { class: 'sheet-foot' }, foot) : null);
    sheetEl = el('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheetEl) closeSheet(); } }, sheet);
    document.body.append(sheetEl);
    document.body.style.overflow = 'hidden';
    const first = sheet.querySelector('input:not([type=file]):not(.sr-only), textarea, select');
    if (first && window.matchMedia('(min-width: 900px)').matches) first.focus();
  }
  function closeSheet() {
    if (sheetEl) { sheetEl.remove(); sheetEl = null; document.body.style.overflow = ''; }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // Inline two-step confirmation (browser confirm() is unreliable in installed web apps).
  function confirmButton(label, onConfirm) {
    const wrap = el('span');
    const btn = el('button', { class: 'btn btn-danger btn-sm', type: 'button' }, label);
    btn.addEventListener('click', () => {
      wrap.replaceChildren(el('span', { class: 'confirm-bar' }, 'Are you sure?',
        el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: onConfirm }, 'Yes, ' + label.toLowerCase()),
        el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => wrap.replaceChildren(btn) }, 'Cancel')));
    });
    wrap.append(btn);
    return wrap;
  }

  function editItem(resource, row) {
    const schema = SCHEMAS[resource];
    const fields = schema.fields().filter((f) => !(f.virtual && row));
    const form = buildForm(fields, row);
    const formEl = el('form', { class: 'form', novalidate: true }, form.nodes);
    const save = async (e) => {
      e && e.preventDefault();
      const values = form.read();
      const missing = fields.find((f) => f.required && !values[f.name]);
      if (missing) return toast(`${missing.label} is required`, true);
      const body = Object.fromEntries(Object.entries(values).filter(([k]) => !k.startsWith('_')));
      saveBtn.disabled = true;
      try {
        const saved = row
          ? await api(`/api/admin/r/${resource}/${row.id}`, { method: 'PUT', body })
          : await api(`/api/admin/r/${resource}`, { method: 'POST', body });
        if (extra && extra.attach) await extra.attach(saved);
        toast('Saved');
        if (schema.afterSave) await schema.afterSave(saved, values, !row);
        render();
        if (!row && schema.extra) editItem(resource, saved); // reopen so photos / PIN can be added
        else closeSheet();
      } catch (err) { fail(err); }
      saveBtn.disabled = false;
    };
    formEl.addEventListener('submit', save);
    const saveBtn = el('button', { class: 'btn btn-primary', type: 'button', onclick: save }, row ? 'Save changes' : 'Create');
    const extra = schema.extra ? schema.extra(row) : null;
    openSheet((row ? 'Edit ' : 'New ') + schema.singular, el('div', { class: 'form' }, formEl, extra || null),
      [saveBtn, row ? confirmButton('Delete', async () => {
        try { await api(`/api/admin/r/${resource}/${row.id}`, { method: 'DELETE' }); toast('Deleted'); closeSheet(); render(); } catch (err) { fail(err); }
      }) : null]);
  }

  // ---------- photos linked to a mission or event ----------
  // On a new item, uploads are queued and attached right after the first save.
  function linkedPhotos(key, row) {
    const grid = el('div', { class: 'thumbs' });
    const queued = [];
    const thumb = (src, caption, onCaption, onDelete) => {
      const cap = el('input', { class: 'thumb-cap', placeholder: 'Caption', value: caption || '', 'aria-label': 'Photo caption' });
      cap.addEventListener('change', () => onCaption(cap.value));
      return el('div', { class: 'thumb-wrap' },
        el('div', { class: 'thumb' }, el('img', { src, alt: '' }), el('button', { type: 'button', 'aria-label': 'Delete photo', onclick: onDelete }, '×')), cap);
    };
    const paintQueued = () => queued.map((q, i) => thumb(q.src, q.caption, (v) => { q.caption = v; }, () => { queued.splice(i, 1); load(); }));
    const load = async () => {
      const saved = row ? (await api('/api/admin/r/photos')).filter((p) => p[key] === row.id).reverse() : [];
      grid.replaceChildren(...saved.map((p) => thumb(p.src, p.caption,
        async (v) => { try { await api(`/api/admin/r/photos/${p.id}`, { method: 'PUT', body: { caption: v } }); toast('Caption saved'); } catch (err) { fail(err); } },
        async () => { await api(`/api/admin/r/photos/${p.id}`, { method: 'DELETE' }); load(); })), ...paintQueued());
      title.textContent = `Photos (${saved.length + queued.length})`;
    };
    const title = el('strong', {}, 'Photos');
    const box = el('div', { class: 'group-box' },
      el('div', { class: 'group-box-head' }, title),
      el('p', { class: 'help' }, 'Select several photos at once. They are shown as a gallery on the website. Tap a caption box to add a caption.'),
      uploadZone((url) => (row ? api('/api/admin/r/photos', { method: 'POST', body: { src: url, [key]: row.id } }) : queued.push({ src: url, caption: '' })), load),
      grid);
    box.attach = async (saved) => {
      for (const q of queued.splice(0)) await api('/api/admin/r/photos', { method: 'POST', body: { src: q.src, caption: q.caption, [key]: saved.id } });
    };
    load().catch(fail);
    return box;
  }

  function uploadZone(onUploaded, done) {
    const input = el('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', id: 'zone-' + Math.random().toString(36).slice(2) });
    const status = el('span');
    const handle = async (files) => {
      const list = [...files].filter((f) => f.type.startsWith('image/'));
      let n = 0;
      for (const f of list) {
        status.textContent = ` Uploading ${++n} of ${list.length}…`;
        try { await onUploaded(await uploadImage(f)); } catch (err) { fail(err); }
      }
      status.textContent = list.length ? ` ${list.length} photo(s) added.` : '';
      input.value = '';
      done && done();
    };
    input.addEventListener('change', () => handle(input.files));
    const zone = el('div', { class: 'upload-zone' }, el('label', { class: 'btn btn-primary btn-sm', for: input.id }, 'Add photos'), input, ' or drop images here.', status);
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag'); handle(e.dataTransfer.files); });
    return zone;
  }

  // ---------- member PIN ----------
  function memberPin(member) {
    const box = el('div', { class: 'group-box' },
      el('strong', {}, 'Member login'),
      el('p', { class: 'help' }, member.has_pin
        ? 'This member has a PIN. Generating a new one logs them out everywhere.'
        : 'Generate a PIN so this member can log in with their phone number and see member-only alerts and the phone directory.'));
    const btn = el('button', { class: 'btn btn-outline btn-sm', type: 'button' }, member.has_pin ? 'Reset PIN' : 'Generate PIN');
    btn.addEventListener('click', async () => {
      if (!member.phone) return toast('Add a phone number first and save', true);
      try {
        const { pin } = await api(`/api/admin/members/${member.id}/pin`, { method: 'POST' });
        const msg = `കർമ്മ ഓമശ്ശേരി member login\n${location.origin}/member\nPhone: ${member.phone}\nPIN: ${pin}`;
        btn.replaceWith(el('div', { class: 'pin-box' }, el('span', {}, 'New PIN for ' + member.name), el('b', {}, pin),
          el('span', {}, 'Share it now. It will not be shown again.'),
          el('a', { class: 'btn btn-whatsapp btn-sm', target: '_blank', rel: 'noopener', href: `https://wa.me/${telDigits(member.phone)}?text=${encodeURIComponent(msg)}` }, 'Send on WhatsApp')));
        render();
      } catch (err) { fail(err); }
    });
    box.append(btn);
    return box;
  }

  function importMembers() {
    const input = el('input', { type: 'file', accept: '.xlsx,.csv', id: 'imp-file' });
    const out = el('p', { class: 'form-msg' });
    const go = el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      if (!input.files[0]) return toast('Choose a file first', true);
      const fd = new FormData();
      fd.append('file', input.files[0]);
      go.disabled = true;
      try {
        const r = await api('/api/admin/members/import', { method: 'POST', body: fd });
        out.className = 'form-msg ok';
        out.textContent = `Done: ${r.added} added, ${r.updated} updated (from ${r.total} rows).`;
        render();
      } catch (err) { out.className = 'form-msg err'; out.textContent = err.message; }
      go.disabled = false;
    } }, 'Import');
    openSheet('Import members', el('div', { class: 'form' },
      el('p', { class: 'help' }, 'Upload the Google Form spreadsheet (.xlsx or .csv). Columns named Name, Address, Phone number, Place, Blood group (and optionally Skills, Occupation) are read. Existing members are matched by phone number or name and updated; new ones are added.'),
      el('div', { class: 'field' }, el('label', { for: 'imp-file' }, 'Spreadsheet'), input), out), [go]);
  }

  // ---------- list views ----------
  async function resourceView(resource) {
    const schema = SCHEMAS[resource];
    const rows = await api(`/api/admin/r/${resource}`);
    const list = el('div', { class: 'rows' });
    let q = '';
    let f = '';
    const countEl = el('p', { class: 'filter-result' });
    const paint = () => {
      const shown = rows.filter((r) => (!q || (schema.search ? schema.search(r) : JSON.stringify(r)).toLowerCase().includes(q)) && (!schema.filterBy || schema.filterBy(r, f)));
      list.replaceChildren(...(shown.length ? shown.map((r) => rowNode(schema.row(r), () => editItem(resource, r))) : [el('p', { class: 'empty' }, rows.length ? 'Nothing matches this search.' : 'Nothing here yet.')]));
      if (countEl) countEl.textContent = (q || f) ? `${shown.length} of ${rows.length} shown` : '';
    };
    paint();
    const tools = el('div', { class: 'toolbar' },
      el('input', { type: 'search', id: 'list-search', placeholder: `Search ${rows.length} ${schema.title.toLowerCase()}…`, oninput: (e) => { q = e.target.value.toLowerCase(); paint(); } }),
      schema.filters ? el('select', { id: 'list-filter', onchange: (e) => { f = e.target.value; paint(); } }, schema.filters(rows).map((o) => (Array.isArray(o)
        ? el('option', { value: o[0] }, o[1])
        : o.options.length ? el('optgroup', { label: o.group }, o.options.map(([v, l]) => el('option', { value: v }, l))) : null))) : null);
    return [
      el('div', { class: 'view-head' }, el('h1', {}, schema.title),
        el('div', { class: 'actions' }, schema.headActions ? schema.headActions() : null,
          schema.noCreate ? null : el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => editItem(resource, null) }, '+ New ' + schema.singular))),
      schema.help ? el('p', { class: 'help' }, schema.help) : null,
      rows.length > 6 ? tools : null,
      countEl,
      list,
    ];
  }

  function rowNode(info, onClick) {
    const thumb = el('span', { class: 'row-thumb' });
    if (info.thumb) thumb.append(el('img', { src: info.thumb, alt: '', loading: 'lazy' }));
    else thumb.textContent = info.glyph || String(info.initials || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return el('button', { class: 'row', type: 'button', onclick: onClick }, thumb,
      el('span', { class: 'row-main' }, el('strong', {}, info.title), info.sub ? el('span', {}, info.sub) : null),
      el('span', { class: 'row-badges' }, (info.badges || []).filter(Boolean).map(([t, c]) => el('span', { class: 'b ' + (c || '') }, t))));
  }

  // ---------- gallery ----------
  // A photo links to one mission or one event; the select uses values like "mission_id:3" / "event_id:5".
  function linkOptions(missions, events) {
    return [
      el('option', { value: '' }, 'Not linked'),
      el('optgroup', { label: 'Missions' }, missions.map((m) => el('option', { value: 'mission_id:' + m.id }, m.title))),
      el('optgroup', { label: 'Events' }, events.map((e) => el('option', { value: 'event_id:' + e.id }, [e.event_date, e.title].filter(Boolean).join(' · ')))),
    ];
  }
  function linkFromValue(v) {
    const [key, id] = String(v || '').split(':');
    return { mission_id: key === 'mission_id' ? +id : null, event_id: key === 'event_id' ? +id : null };
  }
  const linkValue = (p) => (p.mission_id ? 'mission_id:' + p.mission_id : p.event_id ? 'event_id:' + p.event_id : '');

  async function galleryView() {
    const [photos, missions, events] = await Promise.all([api('/api/admin/r/photos'), api('/api/admin/r/missions'), api('/api/admin/r/events')]);
    const linkSel = el('select', { id: 'g-link' }, linkOptions(missions, events));
    const captionIn = el('input', { id: 'g-caption', placeholder: 'Caption for these photos (optional)' });
    const nameOf = (p) => (p.mission_id ? (missions.find((m) => m.id === p.mission_id) || {}).title : p.event_id ? (events.find((e) => e.id === p.event_id) || {}).title : '');
    const grid = el('div', { class: 'thumbs' }, photos.map((p) => {
      const label = [p.caption, nameOf(p)].filter(Boolean).join(' · ');
      const t = el('div', { class: 'thumb' }, el('img', { src: p.src, alt: '', loading: 'lazy' }), label ? el('div', { class: 'cap' }, label) : null);
      t.style.cursor = 'pointer';
      t.addEventListener('click', () => editPhoto(p, missions, events));
      return t;
    }));
    return [
      el('div', { class: 'view-head' }, el('h1', {}, 'Photo Gallery')),
      el('p', { class: 'help' }, 'Select many photos at once; they are resized on your phone before upload. Link them to a mission or an event to show them on that page too. Tap a photo to edit its caption, change the link or delete it.'),
      el('div', { class: 'group-box' },
        el('div', { class: 'field-row' }, el('div', { class: 'field' }, el('label', { for: 'g-caption' }, 'Caption'), captionIn), el('div', { class: 'field' }, el('label', { for: 'g-link' }, 'Mission or event'), linkSel)),
        uploadZone((url) => api('/api/admin/r/photos', { method: 'POST', body: { src: url, caption: captionIn.value, ...linkFromValue(linkSel.value) } }), render)),
      el('h2', { style: 'margin-top:24px' }, `${photos.length} photos`),
      grid,
    ];
  }

  function editPhoto(photo, missions, events) {
    const form = buildForm([
      { name: 'caption', label: 'Caption' },
      { name: 'taken_at', label: 'Date taken', type: 'date' },
    ], photo);
    const linkSel = el('select', { id: 'p-link' }, linkOptions(missions, events));
    linkSel.value = linkValue(photo);
    openSheet('Edit photo', el('div', { class: 'form' }, el('img', { src: photo.src, alt: '', style: 'border-radius:10px' }), form.nodes,
      el('div', { class: 'field' }, el('label', { for: 'p-link' }, 'Mission or event'), linkSel)), [
      el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
        try { await api(`/api/admin/r/photos/${photo.id}`, { method: 'PUT', body: { ...form.read(), ...linkFromValue(linkSel.value) } }); toast('Saved'); closeSheet(); render(); } catch (err) { fail(err); }
      } }, 'Save'),
      confirmButton('Delete', async () => { try { await api(`/api/admin/r/photos/${photo.id}`, { method: 'DELETE' }); closeSheet(); render(); } catch (err) { fail(err); } }),
    ]);
  }

  // ---------- dashboard ----------
  async function dashboardView() {
    const s = await api('/api/admin/stats');
    const tile = (n, label, view) => el('button', { class: 'dash-tile row', type: 'button', style: 'display:block', onclick: () => go(view) }, el('b', {}, n), el('span', {}, label));
    const todo = [];
    if (s.missingRoles.length) todo.push(`Assign office bearers: ${s.missingRoles.map(roleName).join(', ')} (Members → open a member → Role).`);
    if (s.membersWithPhone < s.members) todo.push(`${s.members - s.membersWithPhone} members have no phone number. Import the contact spreadsheet (Members → Import from Excel).`);
    if (s.membersWithSkills < s.members) todo.push(`${s.members - s.membersWithSkills} members have no skills listed yet. Members can add their own after logging in.`);
    if (s.membersWithPin < s.members) todo.push(`${s.members - s.membersWithPin} members cannot log in yet. Generate PINs from each member's page.`);
    if (!s.photos) todo.push('No photos yet. Add mission photos from the Gallery.');
    if (s.newJoinRequests) todo.push(`${s.newJoinRequests} new volunteer join request(s) waiting.`);
    return [
      el('div', { class: 'view-head' }, el('h1', {}, 'Welcome, ' + (ADMIN.name || ADMIN.username))),
      el('div', { class: 'quick', style: 'margin-bottom:20px' },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: () => { go('alerts'); setTimeout(() => editItem('alerts', null), 50); } }, '🚨 Send an alert'),
        el('button', { class: 'btn btn-outline', type: 'button', onclick: () => { go('updates'); setTimeout(() => editItem('updates', null), 50); } }, 'Post an update'),
        el('button', { class: 'btn btn-outline', type: 'button', onclick: () => { go('missions'); setTimeout(() => editItem('missions', null), 50); } }, 'Add a mission'),
        el('button', { class: 'btn btn-outline', type: 'button', onclick: () => { go('events'); setTimeout(() => editItem('events', null), 50); } }, 'Add an event'),
        el('button', { class: 'btn btn-outline', type: 'button', onclick: () => go('photos') }, 'Upload photos')),
      el('div', { class: 'dash-grid' },
        tile(s.members, 'active members', 'members'),
        tile(s.missions, 'missions', 'missions'),
        tile(s.events, 'events', 'events'),
        tile(s.updates, 'updates', 'updates'),
        tile(s.photos, 'photos', 'photos'),
        tile(s.activeAlerts, 'active alerts', 'alerts'),
        tile(`${s.memberPushDevices}/${s.pushDevices}`, 'member / all devices with notifications', 'alerts'),
        tile(s.newJoinRequests, 'new join requests', 'join_requests')),
      todo.length ? el('h2', {}, 'To do') : null,
      todo.length ? el('ul', { class: 'todo' }, todo.map((t) => el('li', {}, t))) : null,
    ];
  }

  // ---------- settings ----------
  async function settingsView() {
    const s = await api('/api/admin/settings');
    const fields = [
      { name: 'org_name_ml', label: 'Name (Malayalam)', half: true },
      { name: 'org_name_en', label: 'Name (English)', half: true },
      { name: 'tagline_ml', label: 'Tagline (Malayalam)', half: true },
      { name: 'tagline_en', label: 'Tagline (English)', half: true },
      { name: 'intro_ml', label: 'Introduction (Malayalam)', type: 'textarea', rows: 4 },
      { name: 'intro_en', label: 'Introduction (English)', type: 'textarea', rows: 4 },
      { name: 'hero_image', label: 'Home page photo (optional, replaces the logo)', type: 'image' },
      { name: 'phones', label: 'Emergency phone numbers (comma separated, first is the SOS button)' },
      { name: 'whatsapp', label: 'WhatsApp number with country code', placeholder: '919447911098', half: true },
      { name: 'contact_email', label: 'Email', type: 'email', half: true },
      { name: 'address', label: 'Office address', type: 'textarea', rows: 2 },
      { name: 'facebook', label: 'Facebook page URL', half: true },
      { name: 'instagram', label: 'Instagram URL', half: true },
      { name: 'youtube', label: 'YouTube URL', half: true },
      { name: 'map_embed', label: 'Google Maps embed URL (https://www.google.com/maps/embed?...)', half: true },
      { name: 'founded', label: 'Founded on', type: 'date', half: true },
      { name: 'stat_volunteers', label: 'Number of volunteers', half: true },
      { name: 'stat_awards', label: 'Awards (e.g. 50+)', half: true },
      { name: 'stat_equipment', label: 'Equipment value (e.g. ₹6 Lakh+)', half: true },
      { name: 'donation_details', label: 'Donation / CSR details (bank details, UPI ID…)', type: 'textarea', rows: 4 },
    ];
    const form = buildForm(fields, { ...s, phones: (s.phones || []).join(', ') });

    // About page sections: repeatable title/body pairs in both languages.
    let sections = (s.about_sections || []).map((x) => ({ ...x }));
    const secWrap = el('div', { class: 'form' });
    const paintSections = () => {
      secWrap.replaceChildren(...sections.map((sec, i) => {
        const inp = (key, label, area) => {
          const id = `sec-${i}-${key}`;
          const node = area ? el('textarea', { id, rows: 5 }) : el('input', { id });
          node.value = sec[key] || '';
          node.addEventListener('input', () => { sec[key] = node.value; });
          return el('div', { class: 'field' }, el('label', { for: id }, label), node);
        };
        return el('div', { class: 'group-box' },
          el('div', { class: 'group-box-head' }, el('strong', {}, `Section ${i + 1}`),
            el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => { sections.splice(i, 1); paintSections(); } }, 'Remove')),
          el('div', { class: 'field-row' }, inp('title_ml', 'Heading (Malayalam)'), inp('title_en', 'Heading (English)')),
          inp('body_ml', 'Text (Malayalam)', true), inp('body_en', 'Text (English)', true));
      }), el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => { sections.push({}); paintSections(); } }, '+ Add section'));
    };
    paintSections();

    const save = async () => {
      const v = form.read();
      v.phones = String(v.phones || '').split(',').map((p) => p.trim()).filter(Boolean);
      v.about_sections = sections.filter((x) => x.title_ml || x.title_en || x.body_ml || x.body_en);
      try { await api('/api/admin/settings', { method: 'PUT', body: v }); toast('Settings saved'); } catch (err) { fail(err); }
    };
    const saveBtn = () => el('button', { class: 'btn btn-primary', type: 'button', onclick: save }, 'Save settings');
    return [
      el('div', { class: 'view-head' }, el('h1', {}, 'Site Settings'), saveBtn()),
      el('form', { class: 'form card', novalidate: true, onsubmit: (e) => e.preventDefault() }, form.nodes),
      el('h2', { style: 'margin-top:28px' }, 'About page sections'),
      secWrap,
      el('div', { style: 'margin-top:20px' }, saveBtn()),
    ];
  }

  // ---------- skills ----------
  async function skillsView() {
    const { skills } = await api('/api/admin/skills');
    META.skills = skills.filter((x) => x.listed).map((x) => x.name);
    const addIn = el('input', { id: 'sk-new', placeholder: 'e.g. Snake Rescue, Tree Climbing', autocomplete: 'off', enterkeyhint: 'done' });
    const addSkill = async () => {
      if (!addIn.value.trim()) return toast('Type a skill name first', true);
      try { await api('/api/admin/skills', { method: 'POST', body: { name: addIn.value } }); toast('Skill added'); render(); } catch (err) { fail(err); }
    };
    addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } });

    const rowFor = (sk) => {
      const actions = el('span', { class: 'row-badges' });
      const showDefault = () => actions.replaceChildren(...[
        sk.listed ? null : el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: async () => {
          try { await api('/api/admin/skills', { method: 'POST', body: { name: sk.name } }); toast('Added to the list'); render(); } catch (err) { fail(err); }
        } }, 'Add to list'),
        el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: showRename }, 'Rename'),
        el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: showRemove }, 'Remove')].filter(Boolean));
      const showRename = () => {
        const inp = el('input', { value: sk.name, 'aria-label': 'New name for ' + sk.name, style: 'min-height:36px;max-width:200px' });
        actions.replaceChildren(inp,
          el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
            try { const r = await api('/api/admin/skills/rename', { method: 'POST', body: { from: sk.name, to: inp.value } }); toast(`Renamed. ${r.membersUpdated} member(s) updated.`); render(); } catch (err) { fail(err); }
          } }, 'Save'),
          el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: showDefault }, 'Cancel'));
        inp.focus();
      };
      const showRemove = () => {
        actions.replaceChildren(el('span', { class: 'confirm-bar' },
          sk.count ? `${sk.count} member(s) have this skill.` : 'Remove from the list?',
          el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => removeSkill(false) }, sk.count ? 'Remove from list only' : 'Remove'),
          sk.count ? el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => removeSkill(true) }, 'Remove from members too') : null,
          el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: showDefault }, 'Cancel')));
      };
      const removeSkill = async (fromMembers) => {
        try { const r = await api('/api/admin/skills/remove', { method: 'POST', body: { name: sk.name, fromMembers } }); toast(fromMembers ? `Removed from the list and ${r.membersUpdated} member(s)` : 'Removed from the list'); render(); } catch (err) { fail(err); }
      };
      showDefault();
      return el('div', { class: 'row skill-row', style: 'cursor:default' },
        el('span', { class: 'row-main' }, el('strong', {}, sk.name), el('span', {}, sk.count ? `${sk.count} member${sk.count > 1 ? 's' : ''}` : 'No members yet')),
        actions);
    };
    const listed = skills.filter((x) => x.listed);
    const extra = skills.filter((x) => !x.listed);
    return [
      el('div', { class: 'view-head' }, el('h1', {}, 'Skills')),
      el('p', { class: 'help' }, 'This list appears as suggestions when you edit a member and as checkboxes on members\' own profile page. Renaming a skill updates every member who has it.'),
      el('div', { class: 'group-box' },
        el('div', { class: 'field' }, el('label', { for: 'sk-new' }, 'Add a new skill (separate several with commas)'), addIn),
        el('div', {}, el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: addSkill }, '+ Add skill'))),
      extra.length ? el('h2', { style: 'margin-top:24px' }, 'Typed by members, not in the list yet') : null,
      extra.length ? el('div', { class: 'rows' }, extra.map(rowFor)) : null,
      el('h2', { style: 'margin-top:24px' }, `Skill list (${listed.length})`),
      el('div', { class: 'rows' }, listed.map(rowFor)),
    ];
  }

  // ---------- account ----------
  async function accountView() {
    const admins = await api('/api/admin/admins');
    const pw = buildForm([
      { name: 'current', label: 'Current password', type: 'password' },
      { name: 'password', label: 'New password (min 8 characters)', type: 'password' },
    ]);
    const add = buildForm([
      { name: 'username', label: 'Username', half: true },
      { name: 'name', label: 'Full name', half: true },
      { name: 'password', label: 'Password (min 8 characters)', type: 'password' },
    ]);
    return [
      el('div', { class: 'view-head' }, el('h1', {}, 'Account & Admins')),
      el('div', { class: 'form card' }, el('h2', {}, 'Change your password'), pw.nodes,
        el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
          try { await api('/api/admin/password', { method: 'POST', body: pw.read() }); toast('Password changed'); render(); } catch (err) { fail(err); }
        } }, 'Change password')),
      el('div', { class: 'form card', style: 'margin-top:20px' }, el('h2', {}, 'Admins'),
        el('p', { class: 'help' }, 'Everyone listed here can edit the whole website.'),
        el('div', { class: 'rows' }, admins.map((a) => el('div', { class: 'row', style: 'cursor:default' },
          el('span', { class: 'row-main' }, el('strong', {}, a.name || a.username), el('span', {}, '@' + a.username)),
          a.id === ADMIN.id ? el('span', { class: 'b b-ok' }, 'you') : confirmButton('Remove', async () => {
            try { await api(`/api/admin/admins/${a.id}`, { method: 'DELETE' }); toast('Removed'); render(); } catch (err) { fail(err); }
          })))),
        el('h3', { style: 'margin-top:12px' }, 'Add another admin'), add.nodes,
        el('button', { class: 'btn btn-outline', type: 'button', onclick: async () => {
          try { await api('/api/admin/admins', { method: 'POST', body: add.read() }); toast('Admin added'); render(); } catch (err) { fail(err); }
        } }, 'Add admin')),
    ];
  }

  // ---------- shell ----------
  const VIEWS = [
    ['dashboard', 'Dashboard', dashboardView],
    ['alerts', 'Alerts', () => resourceView('alerts')],
    ['missions', 'Missions', () => resourceView('missions')],
    ['events', 'Events', () => resourceView('events')],
    ['updates', 'Updates', () => resourceView('updates')],
    ['photos', 'Gallery', galleryView],
    ['members', 'Members', () => resourceView('members')],
    ['join_requests', 'Join requests', () => resourceView('join_requests')],
    ['needs', 'Equipment needs', () => resourceView('needs')],
    ['settings', 'Settings', settingsView],
    ['skills', 'Skills', skillsView],
    ['account', 'Account', accountView],
  ];

  function go(view) {
    current = view;
    history.replaceState(null, '', '#' + view);
    render();
  }

  async function render() {
    const main = document.querySelector('.admin-main');
    if (!main) return;
    document.querySelectorAll('.admin-nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === current));
    const view = VIEWS.find((v) => v[0] === current) || VIEWS[0];
    try {
      const nodes = await view[2]();
      main.replaceChildren(...nodes.filter(Boolean));
    } catch (err) {
      if (err.status === 401) return showLogin();
      main.replaceChildren(el('p', { class: 'form-msg err' }, err.message));
    }
  }

  function showShell() {
    app.replaceChildren(el('div', { class: 'admin-shell' },
      el('aside', { class: 'admin-side' },
        el('div', { class: 'admin-side-head' }, el('img', { src: '/img/logo-160.png', alt: '' }), el('strong', {}, 'Karma Admin'),
          el('a', { href: '/', target: '_blank', rel: 'noopener' }, 'View website ↗')),
        el('nav', { class: 'admin-nav' }, VIEWS.map(([key, label]) => el('button', { type: 'button', 'data-view': key, onclick: () => go(key) }, label)),
          el('button', { type: 'button', onclick: async () => { await api('/api/admin/logout', { method: 'POST' }); showLogin(); } }, 'Log out'))),
      el('main', { class: 'admin-main' })));
    render();
  }

  function showLogin() {
    const msg = el('p', { class: 'form-msg' });
    const form = el('form', { class: 'form card login-card', novalidate: true },
      el('img', { src: '/img/logo.png', alt: 'Karma Omassery logo' }),
      el('h1', {}, 'Admin login'),
      el('div', { class: 'field' }, el('label', { for: 'l-user' }, 'Username'), el('input', { id: 'l-user', name: 'username', autocomplete: 'username', required: true })),
      el('div', { class: 'field' }, el('label', { for: 'l-pass' }, 'Password'), el('input', { id: 'l-pass', name: 'password', type: 'password', autocomplete: 'current-password', required: true })),
      el('button', { class: 'btn btn-primary', type: 'submit' }, 'Log in'), msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/login', { method: 'POST', body: { username: form.username.value, password: form.password.value } });
        boot();
      } catch (err) { msg.className = 'form-msg err'; msg.textContent = err.message; }
    });
    app.replaceChildren(el('div', { class: 'login-wrap' }, form));
  }

  async function boot() {
    try {
      const me = await api('/api/admin/me');
      ADMIN = me.admin;
      META = me.meta;
      const hash = location.hash.slice(1);
      if (VIEWS.some((v) => v[0] === hash)) current = hash;
      showShell();
    } catch (err) {
      showLogin();
    }
  }

  boot();
})();
