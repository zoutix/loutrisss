/* =====================================================================
   LOUTRIS — js/store.js
   Persistent player state. localStorage with in-memory fallback (works
   even on file:// where localStorage may be blocked). Versioned schema.
   ===================================================================== */
(function (global) {
  "use strict";

  var KEY = "loutris_save_v1";
  var memStore = null; // fallback if localStorage unavailable
  var lsOk = (function () {
    try { window.localStorage.setItem("__lt_test", "1"); window.localStorage.removeItem("__lt_test"); return true; }
    catch (e) { return false; }
  })();

  function defaultState() {
    return {
      version: 1,
      authed: false,
      authMethod: null, // guest | google | apple
      profile: {
        name: "PLAYER",
        avatar: "LX",
        avatarColor: 0,
        title: "Rookie",
        level: 1, xp: 0, totalXp: 0,
        frame: "frame_default", skin: "theme_default", tileSkin: "tile_default", kbdSkin: "kbd_default", victAnim: "va_confetti",
        team: null, // "blue" | "red" | null — permanent, assigned once
        teamBadges: [] // { season, team } season-winner badges
      },
      currency: { coins: 24580, gems: 1420, prem: 980 },
      ranked: { elo: 300, peakElo: 300, rankedPlayed: 0, rankedWins: 0, season: 1 },
      stats: {
        wins: 0, losses: 0, perfectSolves: 0, currentStreak: 0, bestStreak: 0,
        multiPlayed: 0, teamWins: 0, dailySolved: 0, rankedPlayed: 0,
        totalGuesses: 0, matchesPlayed: 0, favoriteWords: {}, lastDailyDate: null,
        dailyStreak: 0, bestDailyStreak: 0, lastDailyStreakDay: null, dailyLockedDay: null,
        redFires: 0, blueFires: 0, blackFires: 0
      },
      achievements: {}, // id -> unlock timestamp
      inventory: { owned: {}, equipped: {} }, // owned[itemId]=true
      season: { premium: false, tier: 1, xp: 0, claimedFree: {}, claimedPrem: {} },
      quests: { daily: {}, weekly: {}, monthly: {}, refreshedDaily: null, refreshedWeekly: null, refreshedMonthly: null, claimed: {} },
      chests: [
        { id: "c1", rarity: "golden", readyAt: 0, opened: false },
        { id: "c2", rarity: "azure", readyAt: Date.now() + 1000 * 60 * 60 * 2, opened: false },
        { id: "c3", rarity: "royal", readyAt: Date.now() + 1000 * 60 * 60 * 8, opened: false }
      ],
      chestSlots: 3,
      friends: [],
      friendOutgoing: [], // {id, name, when}
      friendIncoming: [], // {id, name, from, when}
      registry: [], // {name, elo, avatar, status, lastSeen} - every real player this client knows
      party: [],
      club: { name: "WORD WARRIORS", tag: "WW", members: 18, motd: "Find the word. Own the crown.", inClub: true },
      teamWar: {
        // simulated global roster used to compute team ELO (this client knows
        // only a handful of real players; the roster stands in for the world)
        roster: { blue: [], red: [] }, // [{name, elo}]
        resolved: {} // { season: winnerTeam } season winners ever resolved
      },
      settings: {
        lang: "en", music: 0, sfx: 0.9, master: 0.8, muted: false,
        notif: true, reduceMotion: false, colorblind: false, highContrast: false
      },
      history: [], // {mode, word, result, guesses, when, eloDelta}
      notifications: [],
      lastSeen: Date.now()
    };
  }

  var state = null;
  var listeners = [];

  function load() {
    if (state) return state;
    var raw = null;
    if (lsOk) { try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; } }
    if (!raw && memStore) raw = memStore;
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        state = mergeDefaults(parsed, defaultState());
      } catch (e) { state = defaultState(); }
    } else {
      state = defaultState();
    }
    if (state.settings.music !== 0) { state.settings.music = 0; save(); }
    // migration: ensure every existing friend/outgoing/incoming/self is in the registry
    state.registry = state.registry || [];
    var dirty = false;
    if (state.profile && state.profile.name) {
      var hasSelf = false;
      for (var i = 0; i < state.registry.length; i++) if (state.registry[i].name === (state.profile.name || "").toUpperCase()) { hasSelf = true; break; }
      if (!hasSelf) { state.registry.push({ name: (state.profile.name || "PLAYER").toUpperCase(), elo: state.ranked ? state.ranked.elo : 300, avatar: state.profile.avatar || "LX", status: "online", lastSeen: Date.now() }); dirty = true; }
    }
    function ensureInRegistry(name, elo, avatar, status) {
      var n = (name || "").toUpperCase(); if (!n) return;
      for (var j = 0; j < state.registry.length; j++) if (state.registry[j].name === n) return;
      state.registry.push({ name: n, elo: elo !== undefined ? elo : 300, avatar: avatar || n.slice(0, 2), status: status || "online", lastSeen: Date.now() });
      dirty = true;
    }
    (state.friends || []).forEach(function (f) { ensureInRegistry(f.name, f.elo, f.avatar, f.status); });
    (state.friendOutgoing || []).forEach(function (f) { ensureInRegistry(f.name, undefined, f.name.slice(0, 2), "online"); });
    (state.friendIncoming || []).forEach(function (f) { ensureInRegistry(f.name, undefined, f.name.slice(0, 2), "online"); });
    // team war: assign a permanent team + resolve ended seasons (once)
    if (state.profile && !state.profile.team) {
      state.teamWar = state.teamWar || { roster: { blue: [], red: [] }, resolved: {} };
      var season = state.ranked.season || 1;
      var tcounts = { blue: 0, red: 0 };
      var selfName = (state.profile.name || "").toUpperCase();
      (state.registry || []).forEach(function (r) {
        if ((r.name || "").toUpperCase() === selfName) return;
        tcounts[_teamFor(r.name, season)]++;
      });
      if (tcounts.blue < tcounts.red) state.profile.team = "blue";
      else if (tcounts.red < tcounts.blue) state.profile.team = "red";
      else state.profile.team = (Math.random() < 0.5) ? "blue" : "red";
      dirty = true;
    }
    if (state.ranked && (state.ranked.season || 1) > 1 && state.teamWar && state.teamWar.resolved && state.teamWar.resolved[state.ranked.season - 1] === undefined) {
      // previous seasons that ended before this feature shipped
    }
    if (dirty) save();
    return state;
  }
  function save() {
    state.lastSeen = Date.now();
    var s = JSON.stringify(state);
    if (lsOk) { try { window.localStorage.setItem(KEY, s); return; } catch (e) {} }
    memStore = s;
  }
  function mergeDefaults(s, d) {
    for (var k in d) {
      if (!(k in s)) s[k] = d[k];
      else if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k]) && typeof s[k] === "object" && s[k] !== null) {
        s[k] = mergeDefaults(s[k], d[k]);
      }
    }
    return s;
  }
  function reset() { state = defaultState(); save(); notify(); }

  function get() { return load(); }
  function patch(fn) { var s = get(); fn(s); save(); notify(); }
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; }
  function notify() { for (var i = 0; i < listeners.length; i++) try { listeners[i](state); } catch (e) {} }

  // ---- domain helpers ----
  function addCurrency(cur, amount) {
    patch(function (s) { s.currency[cur] = (s.currency[cur] || 0) + amount; });
  }
  function spendCurrency(cur, amount) {
    var s = get();
    if ((s.currency[cur] || 0) < amount) return false;
    patch(function (st) { st.currency[cur] -= amount; });
    return true;
  }
  function addXp(amount) {
    patch(function (s) {
      s.profile.xp += amount;
      s.profile.totalXp = (s.profile.totalXp || 0) + amount;
      s.season.xp += amount;
      // season tier progression
      var track = Data.seasonTrack();
      while (s.season.tier < Data.SEASON_MAX_TIER && s.season.xp >= track[s.season.tier - 1].xp + (s.season.tier > 1 ? track[s.season.tier - 2].xp : 0)) {
        s.season.tier++;
      }
      // player level
      var need = levelNeed(s.profile.level);
      while (s.profile.xp >= need) { s.profile.xp -= need; s.profile.level++; need = levelNeed(s.profile.level); if (global.Audio) Audio.play("levelUp"); }
    });
  }
  function levelNeed(lvl) { return 500 + lvl * 150; }

  function recordMatch(result) {
    // result: {mode, word, won, guesses, eloDelta, perfect, type}
    patch(function (s) {
      s.stats.matchesPlayed++;
      s.stats.totalGuesses += result.guesses;
      if (result.won) {
        s.stats.wins++;
        s.stats.currentStreak++;
        if (s.stats.currentStreak > s.stats.bestStreak) s.stats.bestStreak = s.stats.currentStreak;
        if (result.perfect) s.stats.perfectSolves++;
        if (result.mode === "teams") s.stats.teamWins++;
        if (result.type === "ranked") { s.ranked.rankedWins++; }
        if (result.mode === "daily") {
          s.stats.dailySolved++;
          s.stats.lastDailyDate = new Date().toDateString();
          var todayKey = new Date().toDateString();
          if (s.stats.lastDailyStreakDay !== todayKey) {
            var yest = new Date(); yest.setDate(yest.getDate() - 1);
            s.stats.dailyStreak = (s.stats.lastDailyStreakDay === yest.toDateString()) ? s.stats.dailyStreak + 1 : 1;
            s.stats.lastDailyStreakDay = todayKey;
            if (s.stats.dailyStreak > s.stats.bestDailyStreak) s.stats.bestDailyStreak = s.stats.dailyStreak;
            // fire tier conversion: each day = 1 red; 7 red → 1 blue (replaces the 7); 30 total days → 1 black (replaces all 30)
            s.stats.redFires++;
            if (s.stats.redFires >= 7) {
              s.stats.redFires -= 7;
              s.stats.blueFires++;
            }
            if (s.stats.blueFires * 7 + s.stats.redFires >= 30) {
              s.stats.blueFires = 0;
              s.stats.redFires = 0;
              s.stats.blackFires++;
            }
          }
        }
      } else {
        s.stats.losses++;
        s.stats.currentStreak = 0;
        if (result.mode === "daily") {
          s.stats.lastDailyDate = new Date().toDateString();
          s.stats.dailyStreak = 0;
          s.stats.lastDailyStreakDay = new Date().toDateString();
        }
      }
      if (result.mode === "multiplayer") s.stats.multiPlayed++;
      if (result.type === "ranked") { s.ranked.rankedPlayed++; }
      // favorite words
      if (result.won && result.word) {
        var w = result.word.toLowerCase();
        s.stats.favoriteWords[w] = (s.stats.favoriteWords[w] || 0) + 1;
      }
      // history (cap 60)
      s.history.unshift({ mode: result.mode, word: result.word, result: result.won ? "W" : "L", guesses: result.guesses, when: Date.now(), eloDelta: result.eloDelta || 0, type: result.type || "" });
      if (s.history.length > 60) s.history.length = 60;
    });
    checkAchievements();
    progressQuests(result);
  }
  function checkAchievements() {
    patch(function (s) {
      var st = Object.assign({}, s.stats, { coins: s.currency.coins, level: s.profile.level });
      Data.ACHIEVEMENTS.forEach(function (a) {
        if (!s.achievements[a.id]) { try { if (a.cond(st)) { s.achievements[a.id] = Date.now(); global.UI && UI.toast("Achievement unlocked: " + a.name, "gold"); Audio.play("reward"); } } catch (e) {} }
      });
    });
  }
  function progressQuests(result) {
    patch(function (s) {
      ["daily", "weekly", "monthly"].forEach(function (bucket) {
        var q = s.quests[bucket]; if (!q) return;
        Object.keys(q).forEach(function (id) {
          var def = q[id]; if (def.done) return;
          var inc = 0;
          if (def.type === "wins" && result.won) inc = 1;
          else if (def.type === "plays") inc = 1;
          else if (def.type === "ranked_wins" && result.won && result.type === "ranked") inc = 1;
          else if (def.type === "multi_plays" && result.mode === "multiplayer") inc = 1;
          else if (def.type === "streak" && result.won) def.progress = Math.max(def.progress || 0, s.stats.currentStreak);
          else if (def.type === "daily_word" && result.mode === "daily" && result.won) inc = 1;
          else if (def.type === "levels") { /* handled in addXp via diff */ }
          else if (def.type === "solve_within" && result.won && result.guesses <= def.maxGuesses) inc = 1;
          if (inc) { def.progress = (def.progress || 0) + inc; }
          if ((def.progress || 0) >= def.goal && !def.done) { def.done = true; def.claimable = true; }
        });
      });
    });
  }

  function pushNotification(text, kind) {
    patch(function (s) { s.notifications.unshift({ id: Math.random().toString(36).slice(2), text: text, kind: kind || "info", when: Date.now() }); if (s.notifications.length > 30) s.notifications.length = 30; });
  }
  function clearNotification(id) { patch(function (s) { s.notifications = s.notifications.filter(function (n) { return n.id !== id; }); }); }

  // ---- friend requests ----
  function _normName(n) { return (n || "").toString().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 14); }
  function _hasName(s, name) {
    return s.friends.some(function (f) { return f.name === name; })
      || s.friendOutgoing.some(function (f) { return f.name === name; })
      || s.friendIncoming.some(function (f) { return f.name === name; });
  }
  function sendFriendRequest(rawName) {
    var name = _normName(rawName);
    if (!name) return { ok: false, reason: "Enter a username." };
    var s = get();
    if (name === (s.profile.name || "").toUpperCase()) return { ok: false, reason: "You can't add yourself." };
    if (_hasName(s, name)) return { ok: false, reason: name + " is already in your list or pending." };
    if (!_findInRegistry(s, name)) return { ok: false, reason: name + " doesn't exist." };
    var id = Math.random().toString(36).slice(2);
    patch(function (st) { st.friendOutgoing.push({ id: id, name: name, when: Date.now() }); });
    return { ok: true, name: name, id: id };
  }
  function cancelOutgoing(id) { patch(function (s) { s.friendOutgoing = s.friendOutgoing.filter(function (f) { return f.id !== id; }); }); }
  function receiveFriendRequest(fromId, fromName, name) {
    var s = get();
    var id = Math.random().toString(36).slice(2);
    if (_hasName(s, name)) return;
    patch(function (st) { st.friendIncoming.push({ id: id, name: name, from: fromId, fromName: fromName, when: Date.now() }); });
  }
  function acceptFriendRequest(id) {
    patch(function (s) {
      var idx = -1; for (var i = 0; i < s.friendIncoming.length; i++) if (s.friendIncoming[i].id === id) { idx = i; break; }
      if (idx === -1) return;
      var req = s.friendIncoming[idx];
      s.friendIncoming.splice(idx, 1);
      if (!s.friends.some(function (f) { return f.name === req.name; })) {
        var reg = _findInRegistry(s, req.name);
        var elo = reg ? reg.elo : 300;
        var avatar = reg ? reg.avatar : req.name.slice(0, 2);
        s.friends.push({ name: req.name, status: reg ? reg.status : "offline", elo: elo, avatar: avatar });
      }
      return req;
    });
  }
  function rejectFriendRequest(id) {
    patch(function (s) {
      var idx = -1; for (var i = 0; i < s.friendIncoming.length; i++) if (s.friendIncoming[i].id === id) { idx = i; break; }
      if (idx === -1) return;
      s.friendIncoming.splice(idx, 1);
    });
  }

  // ---- player registry (real players only) ----
  function _findInRegistry(s, name) {
    var n = (name || "").toUpperCase();
    for (var i = 0; i < (s.registry || []).length; i++) if (s.registry[i].name === n) return s.registry[i];
    return null;
  }
  function _addToRegistry(s, entry) {
    s.registry = s.registry || [];
    var existing = _findInRegistry(s, entry.name);
    if (existing) {
      if (entry.elo !== undefined) existing.elo = entry.elo;
      if (entry.avatar !== undefined) existing.avatar = entry.avatar;
      if (entry.status !== undefined) existing.status = entry.status;
      existing.lastSeen = Date.now();
    } else {
      s.registry.push({
        name: (entry.name || "").toUpperCase(),
        elo: entry.elo !== undefined ? entry.elo : 300,
        avatar: entry.avatar || (entry.name || "?").slice(0, 2).toUpperCase(),
        status: entry.status || "online",
        lastSeen: Date.now()
      });
    }
  }
  function registerPlayer(entry) {
    patch(function (s) { _addToRegistry(s, entry); });
  }
  function isNameTaken(name) {
    var n = _normName(name);
    if (!n) return false;
    var s = get();
    if ((s.profile.name || "").toUpperCase() === n) return false; // own name is always allowed
    if (_findInRegistry(s, n)) return true;
    return false;
  }
  function getRegistry() {
    var s = get();
    return (s.registry || []).slice();
  }

  // ---- Blue vs Red team war ----
  // Teams are real: every registered player's ELO is summed per team. Team
  // memberships are drawn deterministically from a season seed (parity of a
  // name hash + season), so everyone re-draws sides every season and the
  // totals stay stable across reloads without faking any numbers.
  var TEAM_EPOCH = Date.UTC(2026, 7, 1); // season 1 starts Aug 1 2026
  var SEASON_LEN_MS = 30 * 24 * 3600 * 1000;
  function _nameHash(name) {
    var h = 0;
    name = String(name || "");
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h;
  }
  function _teamFor(name, season) {
    return ((_nameHash(name) + season * 7919) % 2 === 0) ? "blue" : "red";
  }
  function teamElo(s) {
    var season = s.ranked.season || 1;
    s.teamWar = s.teamWar || { roster: { blue: [], red: [] }, resolved: {} };
    var sums = { blue: 0, red: 0 };
    var counts = { blue: 0, red: 0 };
    var selfName = (s.profile.name || "").toUpperCase();
    var countedSelf = false;
    (s.registry || []).forEach(function (r) {
      var isSelf = (r.name || "").toUpperCase() === selfName;
      var team;
      if (isSelf) { team = s.profile.team || _teamFor(r.name, season); countedSelf = true; }
      else team = _teamFor(r.name, season);
      sums[team] += isSelf ? (s.ranked.elo || 300) : (r.elo || 300);
      counts[team]++;
    });
    if (!countedSelf) {
      var t = s.profile.team || "blue";
      sums[t] += s.ranked.elo || 300;
      counts[t]++;
    }
    return { blue: sums.blue, red: sums.red, counts: counts };
  }
  function assignTeam() {
    patch(function (s) {
      if (s.profile.team) return;
      var season = s.ranked.season || 1;
      var counts = { blue: 0, red: 0 };
      var selfName = (s.profile.name || "").toUpperCase();
      (s.registry || []).forEach(function (r) {
        if ((r.name || "").toUpperCase() === selfName) return;
        counts[_teamFor(r.name, season)]++;
      });
      if (counts.blue < counts.red) s.profile.team = "blue";
      else if (counts.red < counts.blue) s.profile.team = "red";
      else s.profile.team = (Math.random() < 0.5) ? "blue" : "red";
    });
  }
  function seasonEndsIn(season) {
    var end = TEAM_EPOCH + season * SEASON_LEN_MS;
    return Math.max(0, Math.ceil((end - Date.now()) / (24 * 3600 * 1000)));
  }
  function resolveSeason() {
    var outcome = null;
    patch(function (s) {
      var season = s.ranked.season || 1;
      s.teamWar = s.teamWar || { roster: { blue: [], red: [] }, resolved: {} };
      if (s.teamWar.resolved[season]) return;
      if (seasonEndsIn(season) > 0) return; // season still running
      var info = teamElo(s);
      var winner = info.blue === info.red ? null : (info.blue > info.red ? "blue" : "red");
      s.teamWar.resolved[season] = winner;
      var myTeam = s.profile.team || (Math.random() < 0.5 ? "blue" : "red");
      s.profile.team = myTeam;
      // history of every season's team
      s.profile.teamSeasons = s.profile.teamSeasons || [];
      s.profile.teamSeasons.push({ season: season, team: myTeam });
      if (winner && myTeam === winner) {
        s.profile.teamBadges = s.profile.teamBadges || [];
        s.profile.teamBadges.push({ season: season, team: winner });
      }
      // every new season re-draws teams — switch sides
      s.profile.team = myTeam === "blue" ? "red" : "blue";
      s.ranked.season = season + 1;
      outcome = { season: season, winner: winner, myTeam: myTeam, youWon: !!winner && myTeam === winner, nextTeam: s.profile.team };
    });
    return outcome;
  }
  function teamBadges(s) { return (s.profile.teamBadges || []).slice(); }

  global.Store = {
    load: load, save: save, get: get, patch: patch, reset: reset, subscribe: subscribe,
    addCurrency: addCurrency, spendCurrency: spendCurrency, addXp: addXp, levelNeed: levelNeed,
    recordMatch: recordMatch, checkAchievements: checkAchievements,
    pushNotification: pushNotification, clearNotification: clearNotification,
    sendFriendRequest: sendFriendRequest,
    cancelOutgoing: cancelOutgoing, receiveFriendRequest: receiveFriendRequest,
    acceptFriendRequest: acceptFriendRequest, rejectFriendRequest: rejectFriendRequest,
    registerPlayer: registerPlayer, isNameTaken: isNameTaken, getRegistry: getRegistry,
    teamElo: teamElo, assignTeam: assignTeam, seasonEndsIn: seasonEndsIn, resolveSeason: resolveSeason, teamBadges: teamBadges,
    isPersisted: function () { return lsOk; }
  };
})(window);
