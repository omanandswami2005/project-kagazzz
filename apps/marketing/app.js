/* Kagaz landing page interactivity (G1-8). Vanilla JS, no framework — the only
   stateful bits are the S-words marquee and the language switcher. Honours
   prefers-reduced-motion; pauses the marquee on hover/focus. */
(function () {
  'use strict';

  var SUPPORTED = ['en', 'hi'];
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Language switch (landing.toggleLanguage) ─────────────────── */
  function applyLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'en';
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-' + lang + ']').forEach(function (el) {
      var val = el.getAttribute('data-' + lang);
      if (val != null) el.textContent = val;
      // Mark Hindi runs so screen readers switch voice.
      if (lang === 'hi') el.setAttribute('lang', 'hi');
      else if (el.getAttribute('lang') === 'hi') el.removeAttribute('lang');
    });
    document.querySelectorAll('.lang-switch button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState({}, '', url);
    } catch (e) {
      /* history unavailable — ignore */
    }
  }

  document.querySelectorAll('.lang-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      applyLang(b.getAttribute('data-lang'));
    });
  });

  var initial = new URLSearchParams(window.location.search).get('lang');
  if (!initial) initial = (navigator.language || 'en').slice(0, 2);
  applyLang(initial);

  /* ── Install CTA (landing.installApp) — pick the store by platform ── */
  var ANDROID = 'https://play.google.com/store/apps/details?id=in.kagaz.app';
  var IOS = ANDROID; // iOS "coming soon" — falls back to the Play listing for now.
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    document.querySelectorAll('[data-agent-action="landing.installApp"]').forEach(function (a) {
      a.setAttribute('href', IOS);
    });
  }

  /* ── S-words marquee (chip cycling) ───────────────────────────── */
  var WORDS = ['Scan', 'Store', 'Search', 'Sign', 'Secure', 'Share', 'Speak', 'Simplify'];
  var marquee = document.getElementById('s-words');
  var track = marquee && marquee.querySelector('.marquee__track');
  if (track) {
    var visible = window.matchMedia('(max-width: 640px)').matches ? 2 : 4;
    var start = 0;
    var timer = null;
    var paused = false;

    function render() {
      track.innerHTML = '';
      for (var i = 0; i < visible; i++) {
        var li = document.createElement('li');
        li.className = 'chip' + (i === 0 ? ' chip--active' : '');
        li.textContent = WORDS[(start + i) % WORDS.length];
        track.appendChild(li);
      }
    }
    function tick() {
      if (paused) return;
      start = (start + 1) % WORDS.length;
      render();
    }
    render();

    if (!reduceMotion) {
      timer = window.setInterval(tick, 1800);
      // Pause on hover (desktop) and keyboard focus (a11y).
      ['mouseenter', 'focusin'].forEach(function (ev) {
        marquee.addEventListener(ev, function () {
          paused = true;
          marquee.setAttribute('data-agent-state', 'paused');
        });
      });
      ['mouseleave', 'focusout'].forEach(function (ev) {
        marquee.addEventListener(ev, function () {
          paused = false;
          marquee.setAttribute('data-agent-state', 'idle');
        });
      });
    }
  }

  /* ── Smooth scroll (landing.scrollTo) is handled by CSS scroll-behavior ── */
})();
