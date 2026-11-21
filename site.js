// Covatom: shared by every page. No dependencies.
(function () {
  // Visitor statistics without cookies or personal data (GoatCounter). Empty = off.
  var GOATCOUNTER = 'salingjaga';
  if (GOATCOUNTER && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    var gc = document.createElement('script');
    gc.async = true;
    gc.src = 'https://gc.zgo.at/count.js';
    gc.setAttribute('data-goatcounter', 'https://' + GOATCOUNTER + '.goatcounter.com/count');
    document.head.appendChild(gc);
  }
  // Cloudflare Web Analytics, also cookie-free. Empty = off.
  var CF_BEACON = '68749164654948e0a03ffa4222f56f35';
  if (CF_BEACON && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    var cf = document.createElement('script');
    cf.defer = true;
    cf.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    cf.setAttribute('data-cf-beacon', '{"token": "' + CF_BEACON + '"}');
    document.head.appendChild(cf);
  }

  // Sections that moved to another page: old links such as /#instal still arrive.
  var en = document.documentElement.lang === 'en';
  var path = location.pathname.replace(/index\.html$/, '');
  var moved = {};
  if (path === '/' || path === '/en/') {
    moved = en
      ? { '#install': '/en/install/', '#security': '/en/how-it-works/#keamanan', '#range': '/en/how-it-works/#jangkauan' }
      : { '#instal': '/pasang/', '#keamanan': '/fitur/#keamanan', '#jangkauan': '/fitur/#jangkauan' };
  } else if (path === '/fitur/') {
    moved = { '#cerita': '/#cerita' };
  }
  if (moved[location.hash]) location.replace(moved[location.hash]);

  // Phone menu.
  var top = document.querySelector('.sj-top'), menu = document.querySelector('.sj-menu');
  if (top && menu) {
    menu.addEventListener('click', function () {
      menu.setAttribute('aria-expanded', String(top.classList.toggle('open')));
    });
    top.querySelectorAll('.sj-links a').forEach(function (a) {
      a.addEventListener('click', function () { top.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && top.classList.contains('open')) { top.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.focus(); }
    });
  }

  // Sections fade in as they scroll into view.
  var rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add('in'); });
  }

  // Waiting list: posts to the Apps Script in tools/waitlist/Code.gs.
  var wait = document.getElementById('daftar');
  if (wait && window.fetch) {
    var st = wait.querySelector('.status'), btn = wait.querySelector('button');
    wait.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = wait.dataset;
      if (!wait.nama.value.trim() || !wait.kontak.value.trim()) { st.textContent = d.need; return; }
      btn.disabled = true;
      st.textContent = d.sending;
      fetch(d.endpoint, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(new FormData(wait)) })
        .then(function () { wait.reset(); st.textContent = d.done; })
        .catch(function () { st.textContent = d.fail; })
        .then(function () { btn.disabled = false; });
    });
  }

  // Demo and contact forms: the site has no server, so they open the visitor's email app with the answers filled in.
  document.querySelectorAll('form[data-mailto]').forEach(function (form) {
    var status = form.querySelector('.status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lines = [], missing = false;
      form.querySelectorAll('[data-label]').forEach(function (f) {
        var v = f.value.trim();
        if (f.required && !v) missing = true;
        if (v) lines.push(f.dataset.label + ': ' + v);
      });
      if (missing) { status.textContent = form.dataset.need; return; }
      status.textContent = form.dataset.done;
      location.href = 'mailto:' + form.dataset.mailto + '?subject=' + encodeURIComponent(form.dataset.subject) +
        '&body=' + encodeURIComponent(lines.join('\n'));
    });
  });
})();
