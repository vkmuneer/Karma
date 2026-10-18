(function () {
  const { api, uploadImage, pushSupported, registerSW, currentSubscription, subscribePush } = window.Karma;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  registerSW();

  // ---------- menu drawer ----------
  const menuBtn = $('.menu-btn');
  const drawer = $('#drawer');
  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', () => {
      const open = drawer.hidden;
      drawer.hidden = !open;
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  // ---------- lightbox ----------
  const box = $('#lightbox');
  if (box) {
    const img = $('img', box);
    const cap = $('.lightbox-caption', box);
    const close = () => { box.hidden = true; img.src = ''; };
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.js-lightbox');
      if (!trigger) return;
      img.src = trigger.dataset.src;
      cap.textContent = trigger.dataset.caption || '';
      box.hidden = false;
    });
    box.addEventListener('click', (e) => { if (e.target !== img) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });
  }

  // ---------- push buttons ----------
  const pushButtons = $$('.js-push');
  const pushOn = $$('.push-on');
  async function refreshPush() {
    if (!pushSupported) return;
    let sub = null;
    try { sub = await currentSubscription(); } catch (e) { /* ignore */ }
    // Re-send an existing subscription so it gets linked to a member login.
    if (sub && document.body.dataset.relink !== 'done') {
      document.body.dataset.relink = 'done';
      api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } }).catch(() => {});
    }
    pushButtons.forEach((b) => { b.hidden = Boolean(sub); });
    pushOn.forEach((el) => { el.hidden = !sub; });
  }
  pushButtons.forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await subscribePush(); } catch (err) { window.alert(err.message); }
    b.disabled = false;
    refreshPush();
  }));
  if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(refreshPush);
  else pushButtons.forEach((b) => { b.hidden = true; });
  if (!pushSupported) pushButtons.forEach((b) => { b.hidden = true; });

  // ---------- list filters ----------
  function bindFilter(inputSel, selectSel, itemsSel, emptySel, match) {
    const input = $(inputSel);
    if (!input) return;
    const select = selectSel ? $(selectSel) : null;
    const run = () => {
      const q = input.value.trim().toLowerCase();
      const f = select ? select.value : '';
      let shown = 0;
      $$(itemsSel).forEach((el) => {
        const ok = (!q || el.dataset.name.includes(q)) && match(el, f);
        el.hidden = !ok;
        if (ok) shown++;
      });
      if (emptySel && $(emptySel)) $(emptySel).hidden = shown > 0;
    };
    input.addEventListener('input', run);
    if (select) select.addEventListener('change', run);
  }
  bindFilter('#team-search', '#team-skill', '#volunteer-list .person', '#team-empty', (el, f) => !f || el.dataset.skills.split('|').includes(f));
  bindFilter('#dir-search', '#dir-blood', '#dir-list li', null, (el, f) => !f || el.dataset.blood === f);

  // ---------- forms ----------
  function formMsg(form, text, ok) {
    const el = $('.form-msg', form);
    el.textContent = text;
    el.className = 'form-msg ' + (ok ? 'ok' : 'err');
  }
  function formData(form) {
    const out = {};
    new FormData(form).forEach((v, k) => {
      if (k in out) out[k] = [].concat(out[k], v);
      else out[k] = v;
    });
    return out;
  }

  const join = $('#join-form');
  if (join) join.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', join);
    btn.disabled = true;
    try {
      await api('/api/join', { method: 'POST', body: formData(join) });
      join.reset();
      formMsg(join, $('.form-msg', join).dataset.ok, true);
    } catch (err) { formMsg(join, err.message, false); }
    btn.disabled = false;
  });

  const login = $('#member-login');
  if (login) login.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/member/login', { method: 'POST', body: formData(login) });
      location.reload();
    } catch (err) { formMsg(login, err.message, false); }
  });

  const logout = $('#member-logout');
  if (logout) logout.addEventListener('click', async () => {
    await api('/api/member/logout', { method: 'POST' }).catch(() => {});
    location.href = '/member';
  });

  // ---------- member tabs ----------
  const tabs = $$('.tab');
  function showTab(id) {
    tabs.forEach((t) => { const on = t.dataset.tab === id; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); });
    $$('.tabpanel').forEach((p) => { p.hidden = p.id !== id; });
  }
  tabs.forEach((t) => t.addEventListener('click', () => { showTab(t.dataset.tab); history.replaceState(null, '', '#' + t.dataset.tab); }));
  if (tabs.length && location.hash && $(location.hash + '.tabpanel')) showTab(location.hash.slice(1));

  const profile = $('#profile-form');
  if (profile) {
    const file = $('#pf-file');
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      formMsg(profile, 'Uploading…', true);
      try {
        const url = await uploadImage(file.files[0], 800);
        $('#pf-photo').value = url;
        $('#pf-preview').innerHTML = '';
        const img = document.createElement('img');
        img.src = url; img.alt = '';
        $('#pf-preview').appendChild(img);
        formMsg(profile, 'Photo ready. Press Save to keep it.', true);
      } catch (err) { formMsg(profile, err.message, false); }
    });
    profile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = formData(profile);
      const skills = [].concat(data.skills || []).concat(String(data.skills_other || '').split(',').map((s) => s.trim()).filter(Boolean));
      delete data.skills_other;
      data.skills = skills;
      try {
        await api('/api/member/me', { method: 'PUT', body: data });
        formMsg(profile, 'Saved ✓', true);
      } catch (err) { formMsg(profile, err.message, false); }
    });
  }

  const pinForm = $('#pin-form');
  if (pinForm) pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/member/pin', { method: 'POST', body: formData(pinForm) });
      pinForm.reset();
      formMsg(pinForm, 'PIN changed ✓', true);
    } catch (err) { formMsg(pinForm, err.message, false); }
  });
})();
