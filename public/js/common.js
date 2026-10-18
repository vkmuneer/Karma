// Shared helpers for the public site, member area and admin panel.
(function () {
  async function api(url, options = {}) {
    const opts = { method: 'GET', credentials: 'same-origin', ...options, headers: { 'X-Requested-With': 'fetch', ...(options.headers || {}) } };
    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Shrinks phone photos before upload so pages stay fast on mobile data.
  function resizeImage(file, maxSide = 1600, quality = 0.82) {
    return new Promise((resolve) => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(file);
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 600 * 1024) return resolve(file);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function uploadImage(file, maxSide) {
    const small = await resizeImage(file, maxSide);
    const fd = new FormData();
    fd.append('file', small);
    const data = await api('/api/upload', { method: 'POST', body: fd });
    return data.url;
  }

  // ---------- push notifications ----------
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    try { return await navigator.serviceWorker.register('/sw.js'); } catch (e) { return null; }
  }

  async function currentSubscription() {
    if (!pushSupported) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function subscribePush() {
    const reg = await registerSW();
    if (!reg) throw new Error('This browser does not support notifications');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notifications were blocked. Allow them in your browser settings.');
    const { key } = await api('/api/push/key');
    const ready = await navigator.serviceWorker.ready;
    let sub = await ready.pushManager.getSubscription();
    if (!sub) sub = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
    return sub;
  }

  window.Karma = { api, resizeImage, uploadImage, pushSupported, registerSW, currentSubscription, subscribePush };
})();
