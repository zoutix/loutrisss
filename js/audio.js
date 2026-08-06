/* =====================================================================
   LOUTRIS — js/audio.js
   Web Audio synthesized SFX only. No music.
   ===================================================================== */
(function (global) {
  "use strict";

  var AC = null, master = null, sfxGain = null;
  var settings = { master: 0.8, sfx: 0.9, muted: false };

  function ctx() {
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext); }
      catch (e) { return null; }
      master = AC.createGain(); master.gain.value = settings.muted ? 0 : settings.master; master.connect(AC.destination);
      sfxGain = AC.createGain(); sfxGain.gain.value = settings.sfx; sfxGain.connect(master);
    }
    return AC;
  }
  function resume() { var c = ctx(); if (c && c.state === "suspended") c.resume(); }

  function tone(freq, dur, type, vol, dest, glideTo) {
    var c = ctx(); if (!c) return;
    var t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq, dest) {
    var c = ctx(); if (!c) return;
    var t = c.currentTime;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filterFreq || 1200; f.Q.value = 0.8;
    var g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest || sfxGain);
    src.start(t);
  }

  var SFX = {
    click: function () { tone(420, 0.06, "triangle", 0.18); tone(680, 0.05, "sine", 0.08); },
    hover: function () { tone(520, 0.04, "sine", 0.05); },
    type: function () { tone(180 + Math.random() * 60, 0.05, "square", 0.08); },
    back: function () { tone(300, 0.06, "sine", 0.08); tone(180, 0.08, "sine", 0.06); },
    enter: function () { tone(880, 0.08, "triangle", 0.1); },
    error: function () { tone(160, 0.18, "sawtooth", 0.16, null, 90); },
    flip: function () { tone(560, 0.07, "triangle", 0.1); },
    correct: function () { tone(660, 0.1, "triangle", 0.18); tone(990, 0.12, "sine", 0.12); },
    present: function () { tone(520, 0.1, "triangle", 0.16); tone(700, 0.1, "sine", 0.08); },
    absent: function () { tone(220, 0.09, "sine", 0.1); },
    hint: function () { tone(900, 0.16, "sine", 0.12, null, 1400); },
    win: function () {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (f, i) { setTimeout(function () { tone(f, 0.22, "triangle", 0.2); tone(f * 2, 0.2, "sine", 0.08); }, i * 110); });
    },
    lose: function () {
      var notes = [392, 330, 262, 196];
      notes.forEach(function (f, i) { setTimeout(function () { tone(f, 0.28, "sawtooth", 0.16, null, f * 0.8); }, i * 150); });
    },
    countdown: function () { tone(700, 0.12, "square", 0.16); },
    go: function () { tone(1200, 0.3, "triangle", 0.2, null, 1600); },
    matchFound: function () {
      tone(440, 0.12, "triangle", 0.18); setTimeout(function () { tone(660, 0.12, "triangle", 0.18); }, 120);
      setTimeout(function () { tone(880, 0.2, "triangle", 0.2); }, 240);
    },
    reward: function () {
      var notes = [659, 784, 988, 1319];
      notes.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, "sine", 0.16); }, i * 80); });
    },
    levelUp: function () {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (f, i) { setTimeout(function () { tone(f, 0.18, "triangle", 0.18); }, i * 90); });
    },
    chestOpen: function () {
      noise(0.3, 0.12, 800); setTimeout(function () { noise(0.2, 0.1, 1500); }, 120);
      setTimeout(function () { tone(880, 0.2, "sine", 0.14); }, 280);
    },
    coin: function () { tone(1320, 0.07, "square", 0.1); setTimeout(function () { tone(1760, 0.1, "sine", 0.08); }, 50); },
    join: function () { tone(440, 0.1, "sine", 0.12); setTimeout(function () { tone(660, 0.12, "sine", 0.1); }, 80); }
  };

  function play(name) {
    if (settings.muted) return;
    resume();
    var fn = SFX[name]; if (fn) fn();
  }
  function applySettings(s) {
    settings = Object.assign({}, settings, s || {});
    delete settings.music;
    var c = ctx(); if (!c) return;
    master.gain.value = settings.muted ? 0 : settings.master;
    sfxGain.gain.value = settings.sfx;
  }
  function init() { resume(); }
  function unlock() { resume(); }

  global.Audio = {
    init: init, unlock: unlock, play: play, applySettings: applySettings, resume: resume
  };
})(window);
