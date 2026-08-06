/**
 * Loutris — Ambient Dust
 * Canvas lamplight dust for the backdrop.
 * Slow-rising gold/ice motes with a few large bokeh orbs. No constellation lines.
 */
(function () {
  'use strict';

  var canvas, ctx, w, h, dpr = 1;
  var particles = [];
  var COUNT = 46;          // small dust motes
  var BOKEH = 3;           // large blurred orbs

  var GOLD = '255,206,69';
  var ICE = '111,200,255';
  var SOFT = '224,232,255';

  function rand(a, b) { return a + Math.random() * (b - a); }

  function init() {
    canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    createParticles();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw();
      return;
    }
    animate();
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    particles = [];
    var i;
    for (i = 0; i < COUNT; i++) {
      var r = Math.random();
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(0.6, 1.7),
        vx: rand(-0.08, 0.08),
        vy: rand(-0.22, -0.05),
        sway: rand(0.3, 1),
        phase: rand(0, Math.PI * 2),
        twinkle: rand(0.25, 0.75),
        color: r < 0.5 ? GOLD : (r < 0.8 ? ICE : SOFT)
      });
    }
    for (i = 0; i < BOKEH; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(6, 11),
        vx: rand(-0.03, 0.03),
        vy: rand(-0.06, -0.02),
        sway: rand(0.15, 0.4),
        phase: rand(0, Math.PI * 2),
        twinkle: 0.5,
        color: i === 0 ? GOLD : (i === 1 ? ICE : SOFT),
        bokeh: true
      });
    }
  }

  function animate() {
    var t = Date.now() * 0.001;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx + Math.sin(t * 0.25 + p.phase) * p.sway * 0.06;
      p.y += p.vy + Math.cos(t * 0.2 + p.phase * 1.7) * 0.03;
      if (p.y < -14) { p.y = h + 14; p.x = Math.random() * w; }
      if (p.x < -14) p.x = w + 14;
      if (p.x > w + 14) p.x = -14;
    }
    draw(t);
    requestAnimationFrame(animate);
  }

  function draw(t) {
    t = t || 0;
    ctx.clearRect(0, 0, w, h);
    var i, p, alpha;
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      alpha = (p.twinkle * 0.6 + 0.2) * (0.75 + 0.25 * Math.sin(t * 0.6 + p.phase));
      if (p.bokeh) {
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        g.addColorStop(0, 'rgba(' + p.color + ',' + (alpha * 0.5) + ')');
        g.addColorStop(1, 'rgba(' + p.color + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(' + p.color + ',' + alpha + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
