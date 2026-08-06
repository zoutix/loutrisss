/* =====================================================================
   LOUTRIS — js/app.js
   Bootstrap: init systems, gate auth, wire all home buttons/nav to
   routes, refresh dynamic home data from Store, periodic timers.
   ===================================================================== */
(function (global) {
  "use strict";

  var App = {};
  var homeTimers = [];

  function init() {
    // load persisted settings into audio
    var s = Store.load();
    Audio.applySettings(s.settings);
    Audio.init();
    Net.startPresence();
    // listen for cross-tab invites
    Net.onInvite(function (msg) {
      if (s.authed) UI.toast(msg.fromName + " invited you to a match", "gold");
    });
    // refresh only the nav badges when state changes (lightweight, no DOM rebuild)
    Store.subscribe(function () { refreshBadges(); });

    if (!s.authed) { AuthScreen.show(); wireHomeOnce(); }
    else { onAuthed(); }
  }

  App.onAuthed = function () {
    onAuthed();
  };

  App.showTeamReveal = function (mode, data) {
    showTeamReveal(mode, data);
  };

  // ---- center-screen team reveal (first entry + season end) ----
  function showTeamReveal(mode, data) {
    var s = Store.get();
    var team = mode === "join" ? (s.profile.team || "blue") : (data.nextTeam || "blue");
    var isBlue = team === "blue";
    var layer = document.getElementById("modal-layer");
    if (!layer) return;
    var veil = UI.el("div", { class: "team-reveal-veil" });
    var kicker = mode === "join" ? "WELCOME TO LOUTRIS" : "SEASON " + data.season + " HAS ENDED";
    var sub, sub2;
    if (mode === "join") {
      sub = "Your team is yours forever — win seasons together to earn titles.";
    } else if (data.youWon) {
      sub = "YOU WON SEASON " + data.season + " WITH THE " + (data.myTeam === "blue" ? "BLUE" : "RED") + " TEAM · BADGE EARNED";
    } else if (data.winner) {
      sub = (data.winner === "blue" ? "BLUE" : "RED") + " TEAM WON SEASON " + data.season;
    } else {
      sub = "SEASON " + data.season + " ENDED IN A TIE";
    }
    if (mode === "season") sub2 = "YOUR TEAM FOR SEASON " + (data.season + 1);
    var teamLbl = isBlue ? "BLUE TEAM" : "RED TEAM";
    veil.appendChild(UI.el("div", { class: "team-reveal" }, [
      UI.el("div", { class: "tr-crest " + team }),
      UI.el("div", { class: "tr-kicker", text: kicker }),
      UI.el("div", { class: "tr-team " + team, text: teamLbl }),
      sub2 ? UI.el("div", { class: "tr-sub tr-sub2", text: sub2 }) : null,
      UI.el("div", { class: "tr-sub" + (sub2 ? " tr-sub3" : ""), text: sub }),
      UI.el("div", { class: "tr-btn-wrap" }, [
        UI.button("ENTER", { primary: true, onclick: function () { veil.remove(); Audio.play("click"); } })
      ])
    ]));
    veil.addEventListener("click", function (e) { if (e.target === veil) veil.remove(); });
    layer.appendChild(veil);
    if (mode === "join") { Audio.play("win"); }
    else if (data.youWon) { Audio.play("win"); UI.confetti(40); }
    else { Audio.play("reward"); }
  }

  function onAuthed() {
    refreshHome();
    wireHomeOnce();
    startHomeTimers();
    Audio.play("enter");
    UI.toast("Welcome back, " + Store.get().profile.name, "success");
  }

  // ---- refresh dynamic parts of the existing home shell ----
  function refreshHome() {
    var s = Store.get();
    if (MetaScreen.ensureQuests) MetaScreen.ensureQuests();
    s = Store.get();
    // profile
    setText("#profile-name", s.profile.name);
    setText("#profile-avatar", s.profile.avatar);
    // ELO pill
    setText("#elo-value", String(s.ranked.elo));
    setText("#elo-division", "");
    setText("#nav-elo-val", String(s.ranked.elo));
    // profile level + XP
    setText("#profile-level", String(s.profile.level));
    var need = Store.levelNeed(s.profile.level);
    setStyle("#profile-xp-bar > i", "width", Math.min(100, (s.profile.xp / need) * 100) + "%");
    setText("#profile-xp-text", s.profile.xp.toLocaleString() + " / " + need.toLocaleString());
    // season pass mini
    var track = Data.seasonTrack();
    setText("#sp-tier", String(s.season.tier));
    setText("#sp-tiername", tierName(s.season.tier));
    setText("#sp-xp", s.season.xp + " XP");
    var nextXp = track[s.season.tier - 1] ? track[s.season.tier - 1].xp : s.season.xp + 480;
    setStyle("#sp-bar > i", "width", Math.min(100, (s.season.xp / nextXp) * 100) + "%");
    // missions mini (left panel) — render from quests
    renderHomeMissions(s);
    // notification dot
    var nb = UI.$("#btn-notifs");
    if (nb) nb.classList.toggle("has-notif", (s.notifications || []).length > 0);
    // chests mini
    renderHomeChests(s);
    // leaderboard mini
    renderHomeLeaderboard(s);
    // rank card (no tier names anymore)
    var nextElo = Data.nextRankElo(s.ranked.elo);
    setText("#rank-elo", s.ranked.elo + " ELO");
    setStyle("#rank-bar > i", "width", Math.min(100, ((s.ranked.elo - Data.rankFromElo(s.ranked.elo).min) / Math.max(1, nextElo - Data.rankFromElo(s.ranked.elo).min)) * 100) + "%");
    setText("#rank-current", s.ranked.elo + " ELO");
    setText("#rank-next", nextElo + " ELO");
    // stats grid
    var wr = s.stats.matchesPlayed ? ((s.stats.wins / s.stats.matchesPlayed) * 100).toFixed(1) : "0.0";
    var avg = s.stats.matchesPlayed ? (s.stats.totalGuesses / s.stats.matchesPlayed).toFixed(1) : "0.0";
    setText("#st-winrate", wr + "%");
    setText("#st-streak", String(s.stats.currentStreak));
    setText("#st-best", String(s.stats.bestStreak));
    setText("#st-matches", String(s.stats.matchesPlayed));
    setText("#st-avg", avg);
    setText("#st-perfect", String(s.stats.perfectSolves));
    // stats lock (unlocks at 10 matches played)
    var mp = s.stats.matchesPlayed || 0;
    var locked = mp < 10;
    var rpCard = document.getElementById("rp-card");
    var lockEl = document.getElementById("stats-lock");
    if (rpCard) rpCard.classList.toggle("locked", locked);
    if (lockEl) lockEl.classList.toggle("hidden", !locked);
    if (locked) {
      setStyle("#lock-bar", "width", Math.min(100, (mp / 10) * 100) + "%");
      setText("#lock-count", mp + " / 10");
    }
    // daily streak banner
    renderDailyStreak(s);
    var seasonOutcome = Store.resolveSeason(); // resolve team war season if it ended
    s = Store.get();
    // blue vs red team war card
    renderTeamWar(s);
    if (seasonOutcome) showTeamReveal("season", seasonOutcome);
    // online count
    setText("#online-count", Net.onlineCount() + " online · Queue ~" + (10 + Math.floor(Math.random() * 8)) + "s");
    // quest count badge
    var qc = countClaimableQuests(s);
    setText("#nav-quests .lbl-count", qc > 0 ? String(qc) : "");
    // friend request badge
    refreshFriendBadge();
  }

  // ---- lightweight badge updaters (safe to call on every state change) ----
  function refreshBadges() {
    var s = Store.get();
    var qc = countClaimableQuests(s);
    setText("#nav-quests .lbl-count", qc > 0 ? String(qc) : "");
    refreshFriendBadge();
  }
  function refreshFriendBadge() {
    var s = Store.get();
    var n = (s.friendIncoming || []).length;
    setText("#nav-friends .lbl-count", n > 0 ? String(n) : "");
  }

  function tierName(t) { if (t >= 45) return "CROWN LEGEND"; if (t >= 30) return "CROWN GUARDIAN"; if (t >= 15) return "CROWN KNIGHT"; return "CROWN SQUIRE"; }

  function countClaimableQuests(s) {
    var n = 0; ["daily", "weekly", "monthly"].forEach(function (b) { var q = s.quests[b] || {}; Object.keys(q).forEach(function (id) { if (q[id].done && !s.quests.claimed[id]) n++; }); });
    return n;
  }

  function renderHomeMissions(s) {
    var box = UI.$("#home-missions"); if (!box) return;
    UI.clear(box);
    var q = s.quests.daily || {}; var keys = Object.keys(q).slice(0, 4);
    if (!keys.length) { box.appendChild(UI.el("div", { class: "mute", text: "No daily missions." })); return; }
    var done = 0; keys.forEach(function (id) { if (q[id].done) done++; });
    setText("#missions-count", done + " / " + keys.length);
    keys.forEach(function (id) {
      var d = q[id]; var pct = Math.min(100, ((d.progress || 0) / d.goal) * 100); var done = d.done;
      box.appendChild(UI.el("div", { class: "mission" }, [
        done ? UI.el("div", { class: "m-check done", html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4 10-10"/></svg>' }) : UI.el("div", { class: "m-check" }),
        UI.el("div", { class: "m-body" }, [UI.el("div", { class: "t", text: d.name }), UI.el("div", { class: "b" }, [UI.el("i", { style: { width: pct + "%" } })])]),
        UI.el("div", { class: "m-xp", text: "+" + d.xp })
      ]));
    });
  }
  function renderHomeChests(s) {
    var box = UI.$("#home-chests"); if (!box) return;
    UI.clear(box);
    s.chests.slice(0, 3).forEach(function (ch) {
      var ready = ch.readyAt <= Date.now();
      var node = UI.el("div", { class: "chest" + (ready ? " ready" : ""), onclick: function () { if (ready) { MetaScreen.chests(); } else { UI.toast("Chest still unlocking", "info", "⏳"); } } }, [
        UI.el("div", { class: "c-ico", html: chestMiniSvg(ch.rarity) }),
        UI.el("div", { class: "c-lbl", text: ch.rarity.toUpperCase() }),
        UI.el("div", { class: "timer", text: ready ? "READY" : fmtCountdownShort(ch.readyAt - Date.now()), id: "chest-timer-" + ch.id })
      ]);
      box.appendChild(node);
    });
  }
  function chestMiniSvg(rarity) {
     var colors = { golden: ["#C3DDFF", "#173A83", "#4E8FFF"], azure: ["#DCEAFF", "#244B93", "#6BA4FF"], royal: ["#B9C9FF", "#334D9C", "#799AFF"] };
    var c = colors[rarity] || colors.azure;
    return '<svg viewBox="0 0 48 48" fill="none"><defs><linearGradient id="hm' + rarity + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient><linearGradient id="hml' + rarity + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient></defs><rect x="6" y="16" width="36" height="26" rx="4" fill="url(#hm' + rarity + ')" stroke="' + c[2] + '" stroke-width="1.5"/><path d="M6 24h36M24 16v26" stroke="' + c[1] + '" stroke-width="1.5"/><path d="M14 16c0-10 8-14 10-14s10 4 10 14" fill="url(#hml' + rarity + ')" stroke="' + c[2] + '" stroke-width="1.5"/><circle cx="24" cy="29" r="4" fill="#FFF1C9" stroke="#C07A10" stroke-width="1"/><rect x="22" y="29" width="4" height="11" fill="#5A45D8"/></svg>';
  }
  function fmtCountdownShort(ms) { if (ms <= 0) return "READY"; var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000); return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s; }

  function renderHomeLeaderboard(s) {
    var box = UI.$("#home-leaderboard"); if (!box) return;
    UI.clear(box);
    var allRows = Data.globalLeaderboard(s.profile.name, s.ranked.elo, s.registry);
    // Keep this dense home preview useful: leaders establish aspiration and
    // the player is always visible even while they are outside the top three.
    var rows = allRows.slice(0, 3);
    var me = allRows.filter(function (row) { return row.me; })[0];
    if (me && rows.indexOf(me) === -1) rows.push(me);
    if (!rows.length) {
      box.appendChild(UI.el("div", { class: "mute", style: { "padding": "10px 4px", "font-size": "11px" }, text: "No players yet. Add a friend by username to populate the ladder." }));
      return;
    }
    rows.forEach(function (r) {
      var cls = "lb-row"; if (r.pos <= 3) cls += " top" + r.pos; if (r.me) cls += " me";
      var posContent = r.pos <= 3 ? UI.ICON.crown : String(r.pos);
      box.appendChild(UI.el("div", { class: cls }, [
        UI.el("div", { class: "lb-pos", html: posContent }),
        UI.el("div", { class: "lb-av", text: r.avatar }),
        UI.el("div", { class: "lb-name", html: r.name + (r.me ? '<span class="you">YOU</span>' : "") }),
        UI.el("div", { class: "lb-elo", text: String(r.elo) })
      ]));
    });
  }

  // ---- daily word streak ----
  function renderDailyStreak(s) {
    var streak = s.stats.dailyStreak || 0;
    var best = s.stats.bestDailyStreak || 0;
    var todayKey = new Date().toDateString();
    var solvedToday = s.stats.lastDailyStreakDay === todayKey;
    var lockedToday = !solvedToday && s.stats.dailyLockedDay === todayKey;
    var banner = document.getElementById("lp-daily-streak");
    if (!banner) return;
    setText("#ds-num", String(streak));
    setText("#ds-best", String(best));
    banner.classList.toggle("solved", solvedToday);
    banner.classList.toggle("locked", lockedToday);
    banner.classList.toggle("zero", streak === 0 && !solvedToday && !lockedToday);
    // day tiles — the week's stamps
    var daysBox = document.getElementById("ds-days");
    if (daysBox) {
      var labels = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
      if (!daysBox.children.length) {
        labels.forEach(function (l) {
          var tile = document.createElement("div");
          tile.className = "ds-day";
          tile.textContent = l;
          daysBox.appendChild(tile);
        });
      }
      var todayIdx = (new Date().getDay() + 6) % 7; // 0 = Monday
      [].forEach.call(daysBox.children, function (tile, i) {
        var daysAgo = (todayIdx - i + 7) % 7;
        tile.classList.toggle("on", solvedToday ? daysAgo <= streak - 1 : (daysAgo >= 1 && daysAgo <= streak));
        tile.classList.toggle("today", daysAgo === 0);
      });
    }
    // meta label + CTA
    setText("#ds-meta-lbl", lockedToday ? "LOCKED" : "NEXT WORD");
    var cta = document.getElementById("ds-cta");
    if (cta) {
      if (solvedToday) {
        cta.textContent = "SOLVED · COMES BACK TOMORROW";
        cta.setAttribute("disabled", "true");
      } else if (lockedToday) {
        cta.textContent = "LOCKED · RETURNS TOMORROW";
        cta.setAttribute("disabled", "true");
      } else {
        cta.textContent = "PLAY TODAY";
        cta.removeAttribute("disabled");
      }
    }
  }
  function renderTeamWar(s) {
    var info = Store.teamElo(s);
    var season = s.ranked.season || 1;
    setText("#bvr-blue-elo", info.counts.blue > 0 ? info.blue.toLocaleString() : "—");
    setText("#bvr-red-elo", info.counts.red > 0 ? info.red.toLocaleString() : "—");
    var tot = info.blue + info.red;
    var bShare = tot > 0 ? Math.round((info.blue / tot) * 100) : 50;
    var fill = document.getElementById("bvr-bar-blue");
    if (fill) fill.style.width = bShare + "%";
    setText("#bvr-share-blue", info.counts.blue > 0 ? bShare + "%" : "—");
    setText("#bvr-share-red", info.counts.red > 0 ? (100 - bShare) + "%" : "—");
    setText("#bvr-season", "SEASON " + season);
    var days = Store.seasonEndsIn(season);
    var cd = document.getElementById("bvr-countdown");
    if (cd) cd.textContent = days > 0 ? "ENDS IN " + days + (days === 1 ? " DAY" : " DAYS") : "RESOLVING…";
    var my = document.getElementById("bvr-my");
    if (my) {
      if (!s.profile.team) {
        my.textContent = "AWAITING TEAM…";
        my.className = "bvr-my";
      } else {
        var lbl = s.profile.team === "blue" ? "YOU ARE BLUE TEAM" : "YOU ARE RED TEAM";
        my.textContent = lbl;
        my.className = "bvr-my " + s.profile.team;
      }
    }
  }
  function openDailyWord() {
    var s = Store.get();
    var todayKey = new Date().toDateString();
    if (s.stats.lastDailyStreakDay === todayKey) { UI.toast("You've already played today's word. Come back tomorrow!", "info"); Audio.play("error"); return; }
    if (s.stats.dailyLockedDay === todayKey) { UI.toast("Today's word is locked — it returns tomorrow.", "error"); Audio.play("error"); return; }
    MatchScreen.open({ mode: "classic", subMode: "daily", length: 5, maxGuesses: 6, hints: 1, title: "DAILY WORD", victAnim: s.profile.victAnim });
  }
  function tickDailyStreak() {
    var banner = document.getElementById("lp-daily-streak");
    if (!banner) return;
    var ms = Data.msUntilNextDaily();
    var t = document.getElementById("ds-timer");
    var meta = banner.querySelector(".ds-meta");
    if (t) {
      var totalSec = Math.max(0, Math.floor(ms / 1000));
      var hh = Math.floor(totalSec / 3600);
      var mm = Math.floor((totalSec % 3600) / 60);
      var ss = totalSec % 60;
      t.textContent = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
    }
    if (meta) meta.classList.toggle("ready", ms <= 0);
  }

  // ---- periodic timers ----
  function startHomeTimers() {
    stopHomeTimers();
    homeTimers.push(setInterval(function () {
      // chest countdowns
      var s = Store.get();
      s.chests.forEach(function (ch) { var t = UI.$("#chest-timer-" + ch.id); if (t) { var left = ch.readyAt - Date.now(); t.textContent = left <= 0 ? "READY" : fmtCountdownShort(left); if (left <= 0) t.parentElement.classList.add("ready"); } });
      // daily streak countdown
      tickDailyStreak();
      // online count
      setText("#online-count", Net.onlineCount() + " online · Queue ~" + (10 + Math.floor(Math.random() * 8)) + "s");
    }, 1000));
    // daily quest refresh check
    homeTimers.push(setInterval(function () { var s = Store.get(); var today = new Date().toDateString(); if (s.quests.refreshedDaily !== today) { MetaScreen.quests && refreshHome(); } }, 30000));
  }
  function stopHomeTimers() { homeTimers.forEach(clearInterval); homeTimers = []; }

  // ---- wire home buttons (idempotent) ----
  var wired = false;
  function wireHomeOnce() {
    if (wired) return; wired = true;
    // currency + buttons
    on("#btn-coins", "click", function () { MetaScreen.shop(); });
    on("#btn-gems", "click", function () { MetaScreen.shop(); });
    on("#btn-prem", "click", function () { MetaScreen.shop(); });
    on("#btn-notifs", "click", toggleNotifications);
    on("#btn-settings", "click", function () { MetaScreen.settings(); });
    on("#brand-logo", "click", function () { UI.popAll(); refreshHome(); });

    // sidebar nav
    on("#nav-home", "click", function () { UI.popAll(); refreshHome(); activateNav("nav-home"); });
    window.addEventListener("loutris:home", function () { activateNav("nav-home"); });
    on("#nav-leaderboard", "click", function () { MetaScreen.leaderboard(); activateNav("nav-leaderboard"); });
    on("#nav-quests", "click", function () { MetaScreen.quests(); activateNav("nav-quests"); });
    on("#nav-shop", "click", function () { MetaScreen.shop(); activateNav("nav-shop"); });
    on("#nav-season", "click", function () { MetaScreen.seasonPass(); activateNav("nav-season"); });
    on("#nav-statistics", "click", function () {
      if ((Store.get().stats.matchesPlayed || 0) < 10) { UI.toast("Play 10 games to unlock your records", "info"); Audio.play("error"); return; }
      MetaScreen.statistics(); activateNav("nav-statistics");
    });
    on("#nav-friends", "click", function () { MetaScreen.friends(); activateNav("nav-friends"); });
    on("#profile-card", "click", function () { MetaScreen.profile(); });

    // left panel links
    on("#lp-season", "click", function () { MetaScreen.seasonPass(); });
    on("#lp-missions", "click", function () { MetaScreen.quests(); });
    on("#mode-daily", "click", function () { openDailyWord(); });
    on("#lp-events", "click", function () { MetaScreen.events(); });

    // center mode cards
    on("#mode-classic", "click", function () { PlayScreen.classicOptions(); });
    on("#mode-multi", "click", function () { PlayScreen.showMatchmaking({ mode: "multiplayer", ranked: false, length: 5, maxGuesses: 6, title: "CASUAL DUEL", raceMode: true, victAnim: Store.get().profile.victAnim }); });
    on("#mode-teams", "click", function () { PlayScreen.teamsLobby(); });

    // quick play + sub actions
    on("#btn-quick-play", "click", function () { PlayScreen.showMatchmaking({ mode: "multiplayer", ranked: true, length: 5, maxGuesses: 6, raceMode: true, title: "QUICK PLAY", victAnim: Store.get().profile.victAnim }); });
    on("#btn-practice", "click", function () { PlayScreen.classicOptions(); });
    on("#btn-daily", "click", function () { openDailyWord(); });
    on("#ds-cta", "click", function () { openDailyWord(); });
    on("#btn-training", "click", function () { PlayScreen.trainingHub(); });
    on("#btn-custom", "click", function () { PlayScreen.customLobby(); });

    // right panel links
    on("#rp-leaderboard", "click", function () { MetaScreen.leaderboard(); });
    on("#rp-leaderboard2", "click", function () { MetaScreen.leaderboard(); });
    on("#rp-stats", "click", function () {
      if ((Store.get().stats.matchesPlayed || 0) < 10) { UI.toast("Play 10 games to unlock your record", "info"); Audio.play("error"); return; }
      MetaScreen.statistics();
    });
    on("#stats-lock", "click", function () {
      UI.toast("Play 10 games to unlock your record", "info"); Audio.play("error");
    });
    on("#rp-lb-global", "click", function () { MetaScreen.leaderboard("Global"); });
    on("#rp-lb-friends", "click", function () { MetaScreen.leaderboard("Friends"); });
    on("#rp-lb-season", "click", function () { MetaScreen.leaderboard("Season"); });

    // global hover sounds
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && (e.target.closest(".nav-item, .btn, .key, .chip, .sub-btn, .mode, .icon-btn, .coin-pill, .tab, .lp-link, .glink"))) {
        Audio.play("hover");
      }
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".nav-item, .btn, .sub-btn, .mode, .quick")) {
        Audio.unlock(); Audio.play("click");
      }
    }, true);
  }

  function activateNav(id) {
    $$(".nav-item").forEach(function (n) { n.classList.remove("active"); });
    var n = UI.$("#" + id); if (n) n.classList.add("active");
  }

  function toggleNotifications() {
    var s = Store.get();
    var existing = UI.$("#notif-panel");
    if (existing) { existing.remove(); return; }
    var panel = UI.el("div", { class: "notif-panel", id: "notif-panel" });
    panel.appendChild(UI.el("div", { class: "ghead" }, [UI.el("div", { class: "gtitle", html: "NOTIF<span class='accent'>ICATIONS</span>" })]));
    if (!s.notifications.length) panel.appendChild(UI.el("div", { class: "mute", text: "No notifications." }));
    s.notifications.slice(0, 8).forEach(function (n) {
      panel.appendChild(UI.el("div", { class: "lrow" }, [UI.el("div", { class: "l-ico " + (n.kind === "gold" ? "g" : ""), html: UI.ICON.crown }), UI.el("div", { class: "l-main" }, [UI.el("div", { class: "l-t", text: n.text }), UI.el("div", { class: "l-s", text: fmtTimeAgo(n.when) })]), UI.el("div", { class: "glink", text: "×", onclick: function () { Store.clearNotification(n.id); panel.remove(); toggleNotifications(); } })]));
    });
    UI.$("#auth-layer").parentNode.appendChild(panel);
    // close on outside click
    setTimeout(function () {
      var h = function (e) { if (!e.target.closest("#notif-panel") && !e.target.closest("#btn-notifs")) { panel.remove(); document.removeEventListener("click", h); } };
      document.addEventListener("click", h);
    }, 0);
    Audio.play("enter");
  }
  function fmtTimeAgo(ts) { var d = (Date.now() - ts) / 1000; if (d < 60) return "just now"; if (d < 3600) return Math.floor(d / 60) + "m ago"; return Math.floor(d / 3600) + "h ago"; }

  // ---- tiny DOM helpers ----
  function $(id) { return document.querySelector(id); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function setText(sel, txt) { var n = $(sel); if (n) n.textContent = txt; }
  function setHTML(sel, html) { var n = $(sel); if (n) n.innerHTML = html; }
  function setStyle(sel, prop, val) { var n = $(sel); if (n) n.style[prop] = val; }
  function on(sel, ev, fn) { var n = $(sel); if (n) n.addEventListener(ev, fn); }

  App.refreshHome = refreshHome;
  App.startHomeTimers = startHomeTimers;
  App.stopHomeTimers = stopHomeTimers;

  global.App = App;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
