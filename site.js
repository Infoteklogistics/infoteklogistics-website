/* Infoteklogistics website v4 — menu, form modes, validation and sending */
(function(){
  'use strict';

  /* ---------- Settings ---------- */
  // Forms only send from these hosts. Everywhere else (previews, local files) they run in preview mode.
  var LIVE_HOSTS = ['infoteklogistics.com','www.infoteklogistics.com'];
  var isLive = LIVE_HOSTS.indexOf(location.hostname) > -1 || /\.netlify\.app$/.test(location.hostname);
  // Optional second copy of every submission into the Google Sheet (Apps Script web app URL ending in /exec).
  // Leave empty to rely on Netlify Forms only. This copy is fire-and-forget: success is judged by Netlify.
  var SHEET_URL = 'https://script.google.com/a/macros/infoteklogistics.com/s/AKfycbxXUHOYhVDK5PzS1c26HfwnzwtBtiSJeLd1FgT-WI_r9lGlFCbTbnU13WLlVtyjB8_Lkw/exec';
  var PHONE = '(212) 404-7164';

  if(!isLive) document.documentElement.classList.add('is-preview');

  /* ---------- Mobile menu ---------- */
  var btn = document.querySelector('.menubtn'), menu = document.getElementById('mmenu');
  if(btn && menu){
    var icoOpen = btn.innerHTML, icoClose = btn.getAttribute('data-close');
    var setMenu = function(open){
      menu.hidden = !open; btn.setAttribute('aria-expanded', String(open));
      btn.innerHTML = open ? icoClose : icoOpen; btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    btn.addEventListener('click', function(){ setMenu(menu.hidden); });
    menu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ setMenu(false); }); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !menu.hidden){ setMenu(false); btn.focus(); } });
    var y0 = 0;
    window.addEventListener('scroll', function(){
      if(menu.hidden){ y0 = scrollY; return; }
      if(Math.abs(scrollY - y0) > 80) setMenu(false);
    }, {passive:true});
  }

  /* ---------- Sticky phone bar: step aside when a form or the footer is on screen ---------- */
  var bar = document.querySelector('.mbar');
  if(bar && 'IntersectionObserver' in window){
    var seen = new Set();
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      bar.classList.toggle('away', seen.size > 0);
    }, {rootMargin:'0px 0px -10% 0px'});
    document.querySelectorAll('form, footer').forEach(function(el){ io.observe(el); });
  }

  /* ---------- Contact form: request type ---------- */
  var cf = document.getElementById('contactForm');
  function setMode(m){
    if(!cf) return;
    var r = cf.querySelector('input[name="request_type"][value="'+m+'"]');
    if(!r) return;
    r.checked = true;
    cf.querySelectorAll('.group').forEach(function(g){ g.hidden = g.getAttribute('data-group') !== m; });
  }
  if(cf){
    cf.querySelectorAll('input[name="request_type"]').forEach(function(r){ r.addEventListener('change', function(){ setMode(r.value); }); });
    var q = new URLSearchParams(location.search).get('type');
    setMode(q || cf.getAttribute('data-default') || 'job');
  }
  document.querySelectorAll('[data-mode]').forEach(function(a){
    a.addEventListener('click', function(){ setMode(a.getAttribute('data-mode')); });
  });

  /* ---------- Validation ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function digits(v){ return (v || '').replace(/\D/g,''); }
  function check(el){
    if(el.closest('[hidden]')) return '';
    var v = (el.value || '').trim(), label = el.getAttribute('data-label') || 'This field';
    if(el.required && !v) return label + ' is required.';
    if(!v) return '';
    if(el.type === 'email' && !EMAIL.test(v)) return 'Enter an email like name@company.com.';
    if(el.type === 'tel'){
      var d = digits(v); if(d.length === 11 && d[0] === '1') d = d.slice(1);
      if(d.length !== 10) return 'Enter a 10-digit phone number, like 212-404-7164.';
    }
    if(el.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v) && !/^\S+\.\S+/.test(v)) return 'Enter a link, like linkedin.com/in/yourname.';
    return '';
  }
  function show(el, msg){
    var box = document.getElementById(el.id + '-err');
    if(msg){ el.setAttribute('aria-invalid','true'); if(box){ box.querySelector('span').textContent = msg; box.classList.add('on'); } }
    else { el.removeAttribute('aria-invalid'); if(box) box.classList.remove('on'); }
  }

  /* ---------- Thank-you messages ---------- */
  var THANKS = {
    job: 'Thanks. We’ll reply within one business day with next steps for your quote. Urgent? Call ' + PHONE + '.',
    staff: 'Thanks. We’ll call you within one business day to confirm the role, schedule and start date.',
    partner: 'Thanks. We’ll reach out within two business days to set up a 20-minute intro call.',
    technician: 'You’re in. We’ll call or text within two business days to set up a 10-minute call. We never charge technicians a fee.'
  };

  function formType(f){
    if(f.id === 'techForm') return 'technician';
    var m = f.querySelector('input[name="request_type"]:checked'); return m ? m.value : 'job';
  }
  function payload(f){
    var out = new URLSearchParams(), multi = {};
    [].forEach.call(f.elements, function(el){
      if(!el.name || el.disabled || el.closest('[hidden]')) return;
      if((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      if(el.type === 'checkbox'){ (multi[el.name] = multi[el.name] || []).push(el.value); return; }
      out.append(el.name, el.value.trim());
    });
    Object.keys(multi).forEach(function(k){ out.append(k, multi[k].join(', ')); });
    out.append('page', location.pathname);
    return out;
  }
  function say(f, kind, msg){
    var s = f.querySelector('.status');
    s.className = 'status on ' + kind; s.textContent = msg;
    if(kind !== 'wait'){ s.setAttribute('tabindex','-1'); s.focus({preventScroll:false}); }
  }

  document.querySelectorAll('form[data-send]').forEach(function(f){
    f.addEventListener('input', function(e){ if(e.target.getAttribute('aria-invalid')) show(e.target, check(e.target)); });
    f.addEventListener('focusout', function(e){ if(e.target.matches('input,select,textarea') && e.target.value) show(e.target, check(e.target)); });
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var first = null;
      f.querySelectorAll('input,select,textarea').forEach(function(el){
        if(!el.id || el.closest('.hp')) return;
        var msg = check(el); show(el, msg); if(msg && !first) first = el;
      });
      if(first){ first.focus(); say(f,'bad','Please fix the highlighted field' + (f.querySelectorAll('[aria-invalid="true"]').length > 1 ? 's' : '') + ' and send again.'); return; }

      var type = formType(f);
      var trap = f.querySelector('input[name="company_website"]');
      if(trap && trap.value){ say(f,'ok',THANKS[type]); f.reset(); return; }

      if(!isLive){
        say(f,'ok','Preview copy: everything checks out, but nothing was sent from this page. To reach us now, call ' + PHONE + '.');
        return;
      }
      var b = f.querySelector('button[type="submit"]'); b.disabled = true;
      say(f,'wait','Sending…');
      var data = payload(f);
      fetch('/', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:data.toString()})
        .then(function(res){
          if(!res.ok) throw new Error('HTTP ' + res.status);
          if(SHEET_URL){ var copy = new URLSearchParams(data); copy.append('form', type); fetch(SHEET_URL,{method:'POST',mode:'no-cors',body:copy}).catch(function(){}); }
          f.reset(); if(f === cf) setMode(type);
          say(f,'ok',THANKS[type]);
          if(bar) bar.classList.add('away');
        })
        .catch(function(){
          say(f,'bad','Something went wrong and your details were not sent. Please try again, or call us at ' + PHONE + '.');
        })
        .then(function(){ b.disabled = false; });
    });
  });
})();
