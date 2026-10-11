
(function(){
  if(window.swMellowPhysics)return;
  /* Reduced-motion (incl. Windows "animation effects off") tones the layer
     down instead of killing it, so the page still answers to the cursor. */
  var CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* A touchscreen laptop still has a precise pointer and hover. Treat it as
     desktop so the mellow section/product response remains active. */
  var TOUCH = matchMedia('(pointer: coarse)').matches &&
              matchMedia('(hover: none)').matches;
  var K    = CALM ? 0.14 : 0.30;

  var cv = document.getElementById('sw-water');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  var W, H, dpr;
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
    cv.style.width = W+'px'; cv.style.height = H+'px';
  }
  resize();
  var rt; addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(resize,150); }, {passive:true});

  /* ============ ripples + droplets, only where you touch ============ */
  var rings = [], parts = [], wash = null, MAXR = 60, MAXP = 120;

  /* a pebble dropped in, not a pond-wide wave */
  function ring(x, y, power, wobble){
    if (rings.length > MAXR) rings.splice(0, rings.length - MAXR);
    rings.push({ x:x, y:y, r:1.2 + power*0.8, life:1,
                 grow:0.9 + power*0.35, w:wobble||0, seed:Math.random()*6.283 });
  }
  function droplets(x, y, n, power){
    if (parts.length > MAXP) parts.splice(0, parts.length - MAXP);
    for (var i = 0; i < n; i++){
      var ang = Math.random()*6.283, sp = 0.9 + Math.random()*(1.8 + power);
      parts.push({ x:x, y:y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp - (1.8 + power*0.55),
                   r:0.9 + Math.random()*2, life:1 });
    }
  }

  function drawWater(){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    var i, g, p, k, ang, rr;

    /* On touch devices the water lives entirely on this fixed canvas. It
       never filters, transforms or recomposites page content, so products
       and sections stay continuously visible during momentum scrolling. */
    if (wash && wash.life > 0){
      var wh = Math.max(0, wash.bottom - wash.top);
      if (wh > 0){
        ctx.save();
        ctx.beginPath(); ctx.rect(0, wash.top, W, wh); ctx.clip();
        var wg = ctx.createRadialGradient(wash.x, wash.y, 0, wash.x, wash.y, Math.max(W,H)*0.58);
        wg.addColorStop(0, 'rgba(255,255,255,' + (wash.life*0.070).toFixed(3) + ')');
        wg.addColorStop(0.38, 'rgba(142,190,198,' + (wash.life*0.028).toFixed(3) + ')');
        wg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = wg; ctx.fillRect(0, wash.top, W, wh);
        ctx.restore();
      }
      wash.life -= 0.032;
      if (wash.life <= 0) wash = null;
    }

    for (i = rings.length - 1; i >= 0; i--){
      g = rings[i];
      g.r += g.grow; g.grow *= 0.955; g.life -= 0.045;
      if (g.life <= 0){ rings.splice(i,1); continue; }
      /* wobbly ring so it reads as water, not a UI pulse */
      ctx.beginPath();
      for (k = 0; k <= 22; k++){
        ang = k/22*6.283;
        rr = g.r * (1 + Math.sin(ang*3 + g.seed) * 0.05 * g.w);
        var px = g.x + Math.cos(ang)*rr, py = g.y + Math.sin(ang)*rr*0.86;
        k ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
      }
      ctx.closePath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,' + (g.life*0.55).toFixed(3) + ')';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(18,46,56,' + (g.life*0.30).toFixed(3) + ')';
      ctx.stroke();
    }

    for (i = parts.length - 1; i >= 0; i--){
      p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.19; p.life -= 0.028;
      if (p.life <= 0){ parts.splice(i,1); continue; }
      ctx.globalAlpha = p.life*0.9;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(18,46,56,.5)'; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* ============ watery glyphs ============ */
  /* The melt bends the whole block. This bends the letterforms themselves:
     a turbulence displacement map plus a wet sheen. Both are paint-only, so
     nothing here touches transform, transform-origin or layout. */
  var WET = [0, 1, 2, 3, 5];       /* deliberately subtle displacement */
  var flowNodes = [], flow = 0;

  (function buildFilters(){
    if (TOUCH) return;
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.id = 'sw-defs'; svg.setAttribute('aria-hidden', 'true');
    var d = '';
    for (var i = 1; i < WET.length; i++){
      d += '<filter id="sw-wet' + i + '" x="-15%" y="-15%" width="130%" height="130%"'
         +        ' color-interpolation-filters="sRGB">'
         +   '<feTurbulence type="fractalNoise" baseFrequency="0.011 0.026"'
         +        ' numOctaves="2" seed="' + (3+i) + '" result="n"/>'
         +   '<feOffset in="n" dx="0" dy="0" result="nf"/>'
         +   '<feDisplacementMap in="SourceGraphic" in2="nf"'
         +        ' scale="' + (WET[i]*K).toFixed(1) + '"'
         +        ' xChannelSelector="R" yChannelSelector="G"/>'
         + '</filter>';
    }
    svg.innerHTML = '<defs>' + d + '</defs>';
    document.body.appendChild(svg);
    flowNodes = svg.getElementsByTagName('feOffset');
  })();

  /* the noise drifts downward, so the distortion runs like water rather than
     sitting there like static grain */
  function advanceFlow(){
    flow = (flow + 0.14) % 512;
    for (var i = 0; i < flowNodes.length; i++) flowNodes[i].setAttribute('dy', flow.toFixed(1));
  }

  /* A filter creates a containing block: put one on an ancestor of an
     absolutely-positioned collage image and the image jumps; put one over the
     fixed nav and the nav stops being fixed. So only leaf-ish text/images
     with no positioned descendants get wet. Decided once, then cached. */
  function wetSafe(el){
    if (el._swSafe !== undefined) return el._swSafe;
    var ok = true;
    if (el.closest && el.closest('nav, header, .nav, .navbar, [data-no-wet]')) ok = false;
    else {
      var kids = el.querySelectorAll('*');
      if (kids.length > 24) ok = false;
      else for (var i = 0; i < kids.length; i++){
        var ps = getComputedStyle(kids[i]).position;
        if (ps !== 'static'){ ok = false; break; }
      }
    }
    el._swSafe = ok;
    return ok;
  }

  function paintWet(el, s){
    if (TOUCH){
      el.style.filter = '';
      el.style.textShadow = '';
      s.wlv = 0;
      s.hadSh = 0;
      return;
    }
    if (!wetSafe(el)) return;
    var a = s.wet;
    var lv = a < 0.10 ? 0 : a < 0.30 ? 1 : a < 0.55 ? 2 : a < 0.80 ? 3 : 4;
    if (lv !== s.wlv){
      s.wlv = lv;
      el.style.filter = lv ? 'url(#sw-wet' + lv + ')' : '';
    }
    if (a > 0.04){
      /* paired highlight/shadow so the gloss reads on cream and on near-black */
      el.style.textShadow =
        '0 ' + (-1.2*a).toFixed(1) + 'px 0 rgba(255,255,255,' + (0.40*a*K).toFixed(2) + '),' +
        '0 ' + (2.6*a).toFixed(1) + 'px ' + (3.2*a).toFixed(1) + 'px rgba(16,26,30,' + (0.28*a*K).toFixed(2) + ')';
      s.hadSh = 1;
    } else if (s.hadSh){
      el.style.textShadow = ''; s.hadSh = 0;
    }
  }

  function clearWet(el, s){
    if (s.wlv) el.style.filter = '';
    if (s.hadSh) el.style.textShadow = '';
  }

  /* ============ melting words ============ */
  var MSEL = '.sw-word-reactive,h1,h2,h3,h4,h5,h6,p,li,blockquote,a,button,strong,em,'
           + '.disp,.tag,.kick,.studioline,.sub,figcaption,figure,dt,dd,label,img,.browser';
  var melting = new Set();

  function mstate(el){
    if (!el._sw){
      var base = el.style.transform || '';
      el._sw = { base: base, sk:0, ty:0, sy:1, sx:1,
                 tsk:0, tty:0, tsy:1, tsx:1, dx:0, dy:0, drag:false,
                 vsk:0, vty:0, vsy:0, vsx:0,
                 wet:0, twet:0, wlv:0, hadSh:0 };
      el.classList.add('sw-melt');
      if (!base) el.classList.add('sw-melt-top');
    }
    return el._sw;
  }

  /* A restrained underwater wave: small, slow and directionally stable. */
  function melt(el, power){
    if (!el) return;
    var s = mstate(el);
    if (s.drag) return;
    if (power > 1) power = 1;
    power *= K;
    var r = el.getBoundingClientRect();
    var lean = Math.sin(performance.now()*0.0011 + r.top*0.0022);
    s.tsk = lean * power * 3.2;
    s.tty = power * 5.5;
    s.tsy = 1 + power * 0.055;
    s.tsx = 1 - power * 0.012;
    s.twet = Math.min(0.38, power * 0.32);
    el.style.transition = 'none';
    melting.add(el);
  }

  /* elementFromPoint returns only the topmost node, so any full-bleed overlay
     (gradient wash, hero anchor target) swallows every hit underneath it.
     Walk the whole stack and take the first thing that actually matches. */
  /* Transforms are ignored on non-replaced inline boxes: an inline <a> would
     go wet but never sag. Climb to the nearest box that can actually
     transform rather than forcing a display change, which would reflow.
     Replaced elements (img, button, svg...) transform fine as they are. */
  var REPLACED = /^(IMG|VIDEO|CANVAS|SVG|INPUT|BUTTON|SELECT|TEXTAREA|IFRAME|OBJECT|PICTURE)$/;
  function transformable(el){
    if (el._swTf !== undefined) return el._swTf;
    var n = el, d;
    while (n && n !== document.body){
      if (REPLACED.test(n.tagName)) break;
      d = getComputedStyle(n).display;
      if (d !== 'inline' && d !== 'contents') break;
      n = n.parentElement;
    }
    if (n && n !== document.body && n.getBoundingClientRect){
      /* never let it climb out into a whole case-study band */
      var r = n.getBoundingClientRect();
      if (r.height > innerHeight * 0.6) n = null;
    }
    el._swTf = (n && n !== document.body) ? n : null;
    return el._swTf;
  }

  function pickAt(x, y){
    var i, c, stack;
    if (document.elementsFromPoint){
      stack = document.elementsFromPoint(x, y);
      for (i = 0; i < stack.length; i++){
        if (stack[i].closest && stack[i].closest('[data-no-wet]')) continue;
        c = stack[i].closest ? stack[i].closest(MSEL) : null;
        if (c) return transformable(c);
      }
      return null;
    }
    var n = document.elementFromPoint(x, y);
    if (n && n.closest && n.closest('[data-no-wet]')) return null;
    var c = n && n.closest ? n.closest(MSEL) : null;
    return c ? transformable(c) : null;
  }

  var waterSection = null, waterTimer = 0;
  function waterSectionAt(x, y, power){
    var stack = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
    var sec = null;
    for (var i = 0; i < stack.length; i++){
      sec = stack[i].closest ? stack[i].closest('section,footer') : null;
      if (sec) break;
    }
    if (!sec) return;
    if (TOUCH){
      var tr = sec.getBoundingClientRect();
      wash = {
        top:Math.max(0,tr.top), bottom:Math.min(H,tr.bottom),
        x:x, y:y, life:Math.min(1,0.52+(power||0)*0.35)
      };
      return;
    }
    if (waterSection && waterSection !== sec) waterSection.classList.remove('sw-water-section');
    waterSection = sec;
    var r = sec.getBoundingClientRect();
    if (r.width && r.height){
      sec.style.setProperty('--sw-x', Math.max(0, Math.min(100, (x-r.left)/r.width*100)).toFixed(1)+'%');
      sec.style.setProperty('--sw-y', Math.max(0, Math.min(100, (y-r.top)/r.height*100)).toFixed(1)+'%');
    }
    var alpha = Math.min(0.035, 0.014+(power||0)*0.020);
    sec.style.setProperty('--sw-a', alpha.toFixed(3));
    sec.classList.add('sw-water-section');
    clearTimeout(waterTimer);
    waterTimer = setTimeout(function(){
      if (waterSection) waterSection.classList.remove('sw-water-section');
    }, 720);
  }

  /* set window.swProbe = 1 in the console, move the mouse, and it reports
     what is under the cursor and what (if anything) it matched */
  function probe(x, y){
    if (!window.swProbe || !document.elementsFromPoint) return;
    var s = document.elementsFromPoint(x, y).slice(0, 6).map(function(e){
      return e.tagName.toLowerCase()
        + (e.className && e.className.baseVal === undefined
            ? '.' + String(e.className).trim().split(/\s+/).join('.') : '')
        + '[' + getComputedStyle(e).display + ']';
    });
    var hit = pickAt(x, y);
    console.log('[sw]', s.join('  >  '), '=>', hit ? hit.tagName.toLowerCase() : 'NO MATCH');
  }

  function meltAt(x, y, power){
    waterSectionAt(x, y, power);
    var el = pickAt(x, y);
    if (el) melt(el, power);
  }

  function paintEl(el){
    var s = el._sw; if (!s) return;
    el.style.transform = (s.base ? s.base + ' ' : '') +
      'translate(' + s.dx.toFixed(1) + 'px,' + (s.ty + s.dy).toFixed(1) + 'px) ' +
      'skewX(' + s.sk.toFixed(2) + 'deg) scale(' + s.sx.toFixed(3) + ',' + s.sy.toFixed(3) + ')';
  }

  function settleEls(){
    melting.forEach(function(el){
      var s = el._sw; if (!s){ melting.delete(el); return; }
      if (!s.drag){                         /* slow release = it lingers, molten */
        s.tsk *= 0.945; s.tty *= 0.945;
        s.tsy = 1 + (s.tsy - 1) * 0.945;
        s.tsx = 1 + (s.tsx - 1) * 0.945;
        s.twet *= 0.940;                    /* wetness dries a touch faster */
      }
      /* Ease toward the wave without spring overshoot, which can read as
         trembling on a trackpad or high-refresh desktop display. */
      s.vsk = s.vty = s.vsy = s.vsx = 0;
      s.sk += (s.tsk - s.sk) * 0.08;
      s.ty += (s.tty - s.ty) * 0.08;
      s.sy += (s.tsy - s.sy) * 0.07;
      s.sx += (s.tsx - s.sx) * 0.07;
      s.wet += (s.twet - s.wet) * 0.12;
      paintEl(el);
      paintWet(el, s);
      if (!s.drag && Math.abs(s.sk) < 0.06 && Math.abs(s.ty) < 0.2 &&
          Math.abs(s.sy-1) < 0.003 && Math.abs(s.sx-1) < 0.003 &&
          Math.abs(s.vsk) < 0.02 && Math.abs(s.vty) < 0.05 &&
          Math.abs(s.dx) < 0.4 && Math.abs(s.dy) < 0.4 && s.wet < 0.02){
        el.style.transform = s.base;
        clearWet(el, s);
        el.classList.remove('sw-melt', 'sw-melt-top');
        el._sw = null;
        melting.delete(el);
      }
    });
  }

  /* ============ input ============ */
  var lx = null, ly = null, lt = 0, held = false, hx = 0, hy = 0;
  var grab = null, gx0 = 0, gy0 = 0, press = null, acc = 0;

  function trail(x, y){
    var now = performance.now();
    if (lx !== null){
      var dx = x - lx, dy = y - ly, dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0.5){
        var sp = dist / Math.max(10, now - lt);
        acc += dist;
        while (acc > 72){                    /* a quieter ripple every ~72px */
          acc -= 72;
          ring(x, y, 0.42 + sp*0.7, 0.8);
        }
        if (sp > 1.4 && Math.random() < 0.07) droplets(x, y, 1, 0.12);
        meltAt(x, y, Math.min(0.42, 0.12 + sp*0.38));
      }
    }
    lx = x; ly = y; lt = now;
  }

  addEventListener('pointermove', function(e){
    if (window.swDirectDragging){
      lx = e.clientX; ly = e.clientY; lt = performance.now();
      return;
    }
    if (grab){
      var s = grab._sw;
      s.dx = e.clientX - gx0; s.dy = e.clientY - gy0;
      s.tsk = Math.max(-18, Math.min(18, s.dx * 0.07));
      s.sk += (s.tsk - s.sk) * 0.3;
      s.twet = Math.min(1, 0.45 + Math.abs(s.dx + s.dy) * 0.004);
      paintEl(grab);
      acc += 6;
      if (acc > 72){ acc = 0; ring(e.clientX, e.clientY, 0.6, 0.8); }
      lx = e.clientX; ly = e.clientY;
      return;
    }
    if (press && !press.grabbed && Math.hypot(e.clientX-press.x, e.clientY-press.y) > 10){
      clearTimeout(press.timer); press = null;
    }
    if (e.pointerType === 'touch' && !held){ lx = e.clientX; ly = e.clientY; lt = performance.now(); return; }
    probe(e.clientX, e.clientY);
    trail(e.clientX, e.clientY);
  }, {passive:true});

  addEventListener('pointerdown', function(e){
    held = true; hx = e.clientX; hy = e.clientY;
    lx = e.clientX; ly = e.clientY; lt = performance.now();
    ring(e.clientX, e.clientY, 1.65, 1.1);
    ring(e.clientX, e.clientY, 0.75, 0.8);
    droplets(e.clientX, e.clientY, 4, 0.65);
    waterSectionAt(e.clientX, e.clientY, 0.45);
    if (window.swDirectDragging) return;
    if (TOUCH){
      var touchEl = pickAt(e.clientX, e.clientY);
      if (touchEl) melt(touchEl, 0.20);
      return;
    }

    var el = pickAt(e.clientX, e.clientY);
    if (el){
      melt(el, 0.28);
      var p = { x:e.clientX, y:e.clientY, grabbed:false };
      p.timer = setTimeout(function(){
        p.grabbed = true;
        grab = el; gx0 = p.x; gy0 = p.y;
        mstate(el).drag = true;
        el.classList.add('sw-drag');
      }, 170);
      press = p;
    }
  }, {passive:true});

  function release(e){
    if (!held) return;
    held = false;
    var x = (e && e.clientX != null) ? e.clientX : hx;
    var y = (e && e.clientY != null) ? e.clientY : hy;
    ring(x, y, 1.05, 0.9);
    droplets(x, y, 2, 0.25);
    if (press){ clearTimeout(press.timer); press = null; }
    if (grab){
      var s = grab._sw;
      s.drag = false; s.tsk = 0; s.tty = 0; s.tsy = 1; s.tsx = 1;
      grab.classList.remove('sw-drag');
      var g = grab; grab = null;
      (function spring(){
        var st = g._sw; if (!st || st.drag) return;
        st.dx *= 0.84; st.dy *= 0.84;
        paintEl(g);
        if (Math.abs(st.dx) > 0.4 || Math.abs(st.dy) > 0.4) requestAnimationFrame(spring);
        else { st.dx = 0; st.dy = 0; }
      })();
    }
  }
  addEventListener('pointerup', release, {passive:true});
  addEventListener('pointercancel', release, {passive:true});

  /* a held pointer gives an occasional quiet response, not a constant pulse */
  setInterval(function(){
    if (held && !grab){
      meltAt(lx != null ? lx : hx, ly != null ? ly : hy, 0.32);
    }
  }, 520);

  /* scrolling: melt + ripple ONLY under the finger / cursor */
  var lastY = window.pageYOffset;
  addEventListener('scroll', function(){
    var y = window.pageYOffset, d = y - lastY; lastY = y;
    var mag = Math.min(1, Math.abs(d) * 0.022);
    if (mag < 0.06) return;
    /* wheel/trackpad scrolling before the mouse has ever moved: use the
       middle of the viewport so the page still reacts from a cold load */
    var px = lx !== null ? lx : W/2, py = ly !== null ? ly : H/2;
    meltAt(px, py, Math.min(0.38, 0.14 + mag*0.24));
    if (Math.random() < 0.2) ring(px, py, 0.48 + mag*0.7, 0.8);
  }, {passive:true});

  /* ============ frame loop: costs nothing when nothing is happening ============ */
  (function frame(){
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (!rings.length && !parts.length && !melting.size && !wash) return;
    drawWater();
    settleEls();
    if (melting.size) advanceFlow();
  })();
})();
