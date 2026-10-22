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

  // ---------- lightbox (with prev/next for photo sets) ----------
  const box = $('#lightbox');
  if (box) {
    const img = $('img', box);
    const cap = $('.lightbox-caption', box);
    const count = $('.lightbox-count', box);
    const prev = $('.lightbox-prev', box);
    const next = $('.lightbox-next', box);
    let set = [];
    let index = 0;
    const show = (i) => {
      index = (i + set.length) % set.length;
      const item = set[index];
      img.src = item.dataset.src;
      cap.textContent = item.dataset.caption || '';
      count.textContent = set.length > 1 ? `${index + 1} / ${set.length}` : '';
      prev.hidden = next.hidden = set.length < 2;
    };
    const close = () => { box.hidden = true; img.src = ''; document.body.style.overflow = ''; };
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.js-lightbox');
      if (!trigger) return;
      const group = trigger.closest('[data-gallery]');
      set = group ? $$('.js-lightbox', group) : [trigger];
      show(set.indexOf(trigger));
      box.hidden = false;
      document.body.style.overflow = 'hidden';
    });
    prev.addEventListener('click', (e) => { e.stopPropagation(); show(index - 1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); show(index + 1); });
    box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('lightbox-close')) close(); });
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
    let startX = null;
    box.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (startX === null || set.length < 2) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
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
  // Member directory: text search plus blood group and skill filters.
  const dirSearch = $('#dir-search');
  if (dirSearch) {
    const blood = $('#dir-blood');
    const skill = $('#dir-skill');
    const run = () => {
      const q = dirSearch.value.trim().toLowerCase();
      let shown = 0;
      $$('#dir-list li').forEach((el) => {
        const ok = (!q || el.dataset.name.includes(q)) && (!blood.value || el.dataset.blood === blood.value)
          && (!skill || !skill.value || el.dataset.skills.split('|').includes(skill.value));
        el.hidden = !ok;
        if (ok) shown++;
      });
      $('#dir-count').textContent = shown;
    };
    [dirSearch, blood, skill].filter(Boolean).forEach((c) => c.addEventListener(c === dirSearch ? 'input' : 'change', run));
  }

  // Team page: search and skill filter cover every group (office bearers, executive, volunteers).
  const teamSearch = $('#team-search');
  if (teamSearch) {
    const skillSel = $('#team-skill');
    const result = $('#team-result');
    const clear = $('#team-clear');
    const run = () => {
      const q = teamSearch.value.trim().toLowerCase();
      const skill = skillSel ? skillSel.value : '';
      const filtering = Boolean(q || skill);
      let total = 0;
      $$('.team-group').forEach((group) => {
        let shown = 0;
        $$('.person', group).forEach((el) => {
          const ok = (!q || el.dataset.name.includes(q)) && (!skill || el.dataset.skills.split('|').includes(skill));
          el.hidden = !ok;
          if (ok) shown++;
        });
        group.hidden = shown === 0;
        const count = $('[data-group-count]', group);
        if (count) count.textContent = shown;
        total += shown;
      });
      result.hidden = !filtering || total === 0;
      result.textContent = (total === 1 ? result.dataset.one : result.dataset.many).replace('{n}', total);
      $('#team-empty').hidden = !filtering || total > 0;
      clear.hidden = !filtering;
    };
    teamSearch.addEventListener('input', run);
    if (skillSel) skillSel.addEventListener('change', run);
    clear.addEventListener('click', () => { teamSearch.value = ''; if (skillSel) skillSel.value = ''; run(); teamSearch.focus(); });
  }

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
