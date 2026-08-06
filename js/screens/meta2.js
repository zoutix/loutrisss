/* =====================================================================
   LOUTRIS — js/screens/meta2.js (part 2)
   Leaderboard, Friends, Club, Events, Settings, Rewards, Statistics,
   Collection. Uses shared helpers from window._metaH (meta.js).
   ===================================================================== */
(function (global) {
  "use strict";
  var H = global._metaH;
  var M = global.MetaScreen || (global.MetaScreen = {});

  // ============ LEADERBOARD ============
  function leaderboard(initialTab) {
    var s = Store.get();
    var scr = UI.screen({ title: "RANKED LADDER", sub: "Climb the ranks. Own the crown." });
    var tabRow = UI.el("div", { class: "lb-tabs" });
    var body = UI.el("div", { class: "lb-body" });
    ["Global", "Friends", "Season", "Regional"].forEach(function (t) {
      var tab = UI.el("div", { class: "lb-tab" + (t === (initialTab || "Global") ? " on" : ""), text: t, onclick: function () { $$(".lb-tab", tabRow).forEach(function (x) { x.classList.remove("on"); }); tab.classList.add("on"); renderTab(t); } });
      tabRow.appendChild(tab);
    });
    scr._body.appendChild(tabRow); scr._body.appendChild(body);
    function renderTab(t) {
      UI.clear(body);
      var st = Store.get();
      // Filter rows based on the active tab. All views come from the local
      // registry (real players only — no bots).
      var allRows = Data.globalLeaderboard(st.profile.name, st.ranked.elo, st.registry);
      var rows = allRows;
      if (t === "Friends") {
        var friendNames = {};
        (st.friends || []).forEach(function (f) { friendNames[(f.name || "").toUpperCase()] = true; });
        rows = allRows.filter(function (r) { return r.me || friendNames[(r.name || "").toUpperCase()]; });
      }
      if (!rows.length) {
        body.appendChild(UI.el("div", { class: "center-stage", style: { "padding": "60px 20px" } }, [
          UI.el("div", { class: "e-ico", html: UI.ICON.crown }),
          UI.el("div", { class: "lt", text: t === "Friends" ? "NO FRIENDS YET" : "NO PLAYERS YET" }),
          UI.el("div", { class: "ls", text: t === "Friends" ? "Open the Friends tab to add someone by username." : "Add a friend by username to start filling the ladder." })
        ]));
        return;
      }
      var me = rows.filter(function (row) { return row.me; })[0] || rows[0];

      // ---- Your standing hero ----
      var hero = UI.el("div", { class: "lb-hero" }, [
        UI.el("div", { class: "lb-hero-glow" }),
        UI.el("div", { class: "lb-hero-main", style: { "flex": "1" } }, [
          UI.el("div", { class: "lb-hero-pos" }, [UI.el("span", { class: "lb-hero-pos-n", text: "#" + me.pos }), UI.el("span", { class: "lb-hero-pos-l", text: t.toUpperCase() + " RANK" })]),
          UI.el("div", { class: "lb-hero-elo" }, [UI.el("span", { class: "lb-hero-elo-n", text: String(me.elo) }), UI.el("span", { class: "lb-hero-elo-l", text: "ELO" })])
        ])
      ]);
      body.appendChild(hero);

      // ---- Full list ----
      var list = UI.el("div", { class: "lb-list" });
      rows.forEach(function (r) {
        var cls = "lb-item" + (r.pos <= 3 ? " top" + r.pos : "") + (r.me ? " me" : "");
        list.appendChild(UI.el("div", { class: cls }, [
          UI.el("div", { class: "lb-item-pos", html: r.pos === 1 ? UI.ICON.crown : "#" + r.pos }),
          UI.el("div", { class: "lb-item-av" }, [UI.el("div", { class: "in", text: r.avatar })]),
          UI.el("div", { class: "lb-item-main" }, [
            UI.el("div", { class: "lb-item-name", html: H.escapeHtml(r.name) + (r.me ? ' <span class="you">YOU</span>' : "") })
          ]),
          UI.el("div", { class: "lb-item-elo" }, [UI.el("span", { class: "lb-item-elo-n", text: String(r.elo) }), UI.el("span", { class: "lb-item-elo-l", text: "ELO" })])
        ]));
      });
      body.appendChild(list);
    }
    renderTab(initialTab || "Global"); UI.push(scr);
  }

  // ============ FRIENDS ============
  function friends() {
    var s = Store.get();
    var pendingOut = (s.friendOutgoing || []).length;
    var incomingN = (s.friendIncoming || []).length;
    var onlineN = s.friends.filter(function (f) { return f.status === "online"; }).length;
    var sub = s.friends.length + " friends · " + onlineN + " online";
    var scr = UI.screen({ title: "FRIENDS", sub: sub });
    var inp = UI.el("input", { class: "input", placeholder: "Enter exact username...", id: "friend-input", style: { flex: "1" } });
    var top = UI.el("div", { class: "flex gap12", style: { "margin-bottom": "16px" } }, [
      inp,
      UI.button("ADD", { primary: true, onclick: function () {
        var raw = inp.value; inp.value = "";
        var res = Store.sendFriendRequest(raw);
        if (!res.ok) { UI.toast(res.reason, "error"); Audio.play("error"); return; }
        Audio.play("click"); UI.toast("Request sent to " + res.name, "gold");
        if (global.Net) Net.sendFriendRequestCrossTab(res.name, s.profile.name);
        UI.pop(); setTimeout(friends, 280);
      } })
    ]);
    scr._body.appendChild(top);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") top.querySelector("button").click(); });

    if (incomingN) {
      scr._body.appendChild(UI.el("div", { class: "gtitle", text: "INCOMING REQUESTS (" + incomingN + ")" }));
      (s.friendIncoming || []).forEach(function (req) {
        var row = UI.el("div", { class: "friend-row" }, [
          H.avatarNode({ avatar: (req.fromName || req.name || "?").slice(0, 2) }, 44),
          UI.el("div", { class: "fr-main" }, [UI.el("div", { class: "fr-name", text: req.fromName || req.name }), UI.el("div", { class: "fr-status", text: "wants to be your friend" })]),
          UI.button("ACCEPT", { sm: true, primary: true, onclick: function () {
            Store.acceptFriendRequest(req.id);
            if (global.Net && req.from) Net.sendFriendAccept(req.from, req.name);
            Audio.play("join"); UI.toast("You are now friends with " + req.name, "success");
            UI.pop(); setTimeout(friends, 280);
          } }),
          UI.button("DECLINE", { sm: true, danger: true, onclick: function () {
            Store.rejectFriendRequest(req.id);
            if (global.Net && req.from) Net.sendFriendReject(req.from, req.name);
            Audio.play("click");
            UI.pop(); setTimeout(friends, 280);
          } })
        ]);
        scr._body.appendChild(row);
      });
    }

    if (pendingOut) {
      scr._body.appendChild(UI.el("div", { class: "gtitle", text: "SENT REQUESTS (" + pendingOut + ")" }));
      s.friendOutgoing.forEach(function (req) {
        var row = UI.el("div", { class: "friend-row" }, [
          H.avatarNode({ avatar: req.name.slice(0, 2) }, 44),
          UI.el("div", { class: "fr-main" }, [UI.el("div", { class: "fr-name", text: req.name }), UI.el("div", { class: "fr-status", text: "waiting for acceptance..." })]),
          UI.button("CANCEL", { sm: true, danger: true, onclick: function () {
            Store.cancelOutgoing(req.id); Audio.play("click"); UI.pop(); setTimeout(friends, 280);
          } })
        ]);
        scr._body.appendChild(row);
      });
    }

    scr._body.appendChild(UI.el("div", { class: "gtitle", style: { "margin-top": "14px" }, text: "MY FRIENDS" }));
    if (!s.friends.length) {
      scr._body.appendChild(UI.el("div", { class: "empty", html: '<span class="e-ico">' + UI.ICON.users + '</span>No friends yet. Add someone above to get started.' }));
    }
    s.friends.forEach(function (f) {
      var row = UI.el("div", { class: "friend-row" }, [
        H.avatarNode({ avatar: f.avatar }, 44),
        UI.el("div", { class: "fr-main" }, [UI.el("div", { class: "fr-name", text: f.name }), UI.el("div", { class: "fr-status", text: f.status + " · " + f.elo + " ELO" })]),
        UI.button("INVITE", { sm: true, onclick: function () { UI.toast("Party invite sent to " + f.name, "success"); Audio.play("join"); } }),
        UI.button("REMOVE", { sm: true, danger: true, onclick: function () { Store.patch(function (st) { st.friends = st.friends.filter(function (x) { return x.name !== f.name; }); }); UI.pop(); setTimeout(friends, 280); } })
      ]);
      if (f.status === "online") row.querySelector(".pf-av").classList.add("online");
      scr._body.appendChild(row);
    });
    UI.push(scr);
  }

  // ============ CLUB ============
  function club() {
    var s = Store.get();
    var scr = UI.screen({ title: "CLUB", sub: s.club.inClub ? s.club.name + " [" + s.club.tag + "]" : "Not in a club" });
    if (s.club.inClub) {
      scr._body.appendChild(UI.el("div", { class: "gcard club-hero" }, [
        UI.el("div", { class: "club-crest" }, [UI.el("div", { class: "in", text: s.club.tag })]),
        UI.el("div", { style: { flex: "1" } }, [UI.el("div", { class: "pf-name", text: s.club.name }), UI.el("div", { class: "pf-title", text: s.club.members + " members" }), UI.el("div", { class: "mute", style: { "margin-top": "8px" }, text: '"' + s.club.motd + '"' })])
      ]));
      var msgs = UI.el("div", { class: "chat-msgs", style: { height: "240px" } });
      var chatLog = [{ who: "ACE", text: "Who's up for ranked?" }, { who: "LUNA", text: "I'm grinding dailies first." }];
      function renderClub() { UI.clear(msgs); chatLog.forEach(function (m) { msgs.appendChild(UI.el("div", { class: "chat-msg" }, [UI.el("span", { class: "who", text: m.who + ":" }), UI.el("span", { text: " " + m.text })])); }); msgs.scrollTop = msgs.scrollHeight; }
      renderClub();
      scr._body.appendChild(UI.gcard("CLUB CHAT", null, [msgs]));
      var inp = UI.el("input", { class: "input", placeholder: "Message your club..." });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && inp.value.trim()) { chatLog.push({ who: s.profile.name, text: inp.value.trim() }); inp.value = ""; renderClub(); Audio.play("click"); } });
      scr._body.appendChild(UI.el("div", { class: "chat-input" }, [inp]));
    } else {
      scr._body.appendChild(UI.el("div", { class: "center-stage" }, [UI.el("div", { class: "e-ico", html: UI.ICON.shield }), UI.el("div", { class: "lt", text: "JOIN A CLUB" }), UI.el("div", { class: "ls", text: "Clubs unlock chat, club quests & rewards." }), UI.button("CREATE CLUB", { primary: true, onclick: function () { Store.patch(function (st) { st.club.inClub = true; st.club.name = "NEW GUARD"; st.club.tag = "NG"; }); UI.pop(); setTimeout(club, 280); } })]));
    }
    UI.push(scr);
  }

  // ============ EVENTS ============
  function events() {
    var scr = UI.screen({ title: "EVENTS", sub: "Weekly · Seasonal · Limited-time" });
    var grid = UI.el("div", { class: "grid cols-2" });
    Data.EVENTS.forEach(function (e) {
      grid.appendChild(UI.el("div", { class: "event-card" + (e.live ? " live" : "") }, [
        UI.el("div", { class: "event-banner", style: { background: e.banner }, html: e.name + (e.live ? '<span class="live-tag">LIVE</span>' : "") }),
        UI.el("div", { class: "l-s", text: e.desc }),
        UI.el("div", { class: "flex jcb aic" }, [
          UI.el("div", { class: "mute", text: e.live ? "Active now" : "Starts in " + e.startsInDays + "d" }),
          UI.button(e.live ? "JOIN" : "REMIND ME", { primary: e.live, sm: true, onclick: function () {
            if (e.live) { UI.pop(); PlayScreen.showMatchmaking({ mode: e.mode, ranked: e.mode === "ranked", length: 5, maxGuesses: 6, raceMode: true, title: e.name.toUpperCase(), victAnim: Store.get().profile.victAnim }); }
            else { UI.toast("Reminder set for " + e.name, "success"); }
          } })
        ])
      ]));
    });
    scr._body.appendChild(grid); UI.push(scr);
  }

  // ============ SETTINGS ============
  function settings() {
    var s = Store.get();
    var scr = UI.screen({ title: "SETTINGS", sub: "Customize your experience" });
    var card = UI.el("div", { class: "gcard", style: { "max-width": "760px" } });
    function row(label, hint, control) { return UI.el("div", { class: "set-row" }, [UI.el("div", {}, [UI.el("div", { class: "set-label", text: label }), UI.el("div", { class: "set-hint", text: hint })]), control]); }
    card.appendChild(UI.el("div", { class: "gtitle", text: "AUDIO" }));
    card.appendChild(row("Master Volume", "Overall sound", slider(s.settings.master, function (v) { updateSetting("master", v); })));
    card.appendChild(row("SFX", "UI & gameplay sounds", slider(s.settings.sfx, function (v) { updateSetting("sfx", v); })));
    card.appendChild(row("Mute All", "Silence everything", toggle(s.settings.muted, function (v) { updateSetting("muted", v); })));
    card.appendChild(UI.el("div", { class: "gtitle", style: { "margin-top": "14px" }, text: "ACCOUNT" }));
    card.appendChild(row("Log Out", "Return to the sign-in screen", UI.button("LOG OUT", { navy: true, sm: true, onclick: function () { UI.confirm("Log out of Loutris?", function () { Store.patch(function (s) { s.authed = false; s.authMethod = null; }); UI.popAll(); setTimeout(function () { AuthScreen.show(); }, 300); }, { title: "LOG OUT?", yesLabel: "LOG OUT" }); } })));
    scr._body.appendChild(card); UI.push(scr);
  }
  function slider(val, onChg) {
    var s = UI.el("div", { class: "slider" }, [UI.el("i", { style: { width: (val * 100) + "%" } }), UI.el("span", { style: { left: (val * 100) + "%" } })]);
    var dragging = false;
    function set(e) { var r = s.getBoundingClientRect(); var p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); s.firstChild.style.width = (p * 100) + "%"; s.lastChild.style.left = (p * 100) + "%"; onChg(p); }
    s.addEventListener("mousedown", function (e) { dragging = true; set(e); });
    window.addEventListener("mousemove", function (e) { if (dragging) set(e); });
    window.addEventListener("mouseup", function () { dragging = false; });
    return s;
  }
  function toggle(on, onChg) { var t = UI.el("div", { class: "toggle" + (on ? " on" : ""), onclick: function () { t.classList.toggle("on"); onChg(t.classList.contains("on")); } }); return t; }
  function updateSetting(key, val) { Store.patch(function (s) { s.settings[key] = val; }); Audio.applySettings(Store.get().settings); }

  // ============ REWARDS ============
  function rewards() {
    var s = Store.get();
    var scr = UI.screen({ title: "REWARDS", sub: "Claim your earned rewards" });
    var any = false;
    ["daily", "weekly", "monthly"].forEach(function (b) {
      var q = s.quests[b] || {};
      Object.keys(q).forEach(function (id) { var d = q[id]; if (d.done && !s.quests.claimed[id]) { any = true; scr._body.appendChild(UI.el("div", { class: "quest-card done" }, [UI.el("div", { class: "q-head" }, [UI.el("div", { class: "q-name", text: d.name }), UI.el("div", { class: "q-reward", text: "+" + d.xp + " XP" })]), UI.el("div", { class: "tc", style: { "margin-top": "8px" } }, [UI.button("CLAIM", { gold: true, sm: true, onclick: function () { H.claimQuest(id, d); } })])])); } });
    });
    var readyChests = s.chests.filter(function (c) { return c.readyAt <= Date.now(); });
    if (readyChests.length) {
      any = true; scr._body.appendChild(UI.el("div", { class: "gtitle", style: { margin: "14px 0 10px" }, text: "READY CHESTS" }));
      var row = UI.el("div", { class: "flex gap12" });
      readyChests.forEach(function (ch) { row.appendChild(UI.el("div", { class: "gcard", style: { padding: "14px", "text-align": "center", cursor: "pointer" }, onclick: function () { UI.pop(); setTimeout(M.chests, 280); } }, [H.chestSvg(ch.rarity, 60), UI.el("div", { class: "mute", style: { "margin-top": "6px" }, text: "Tap to open" })])); });
      scr._body.appendChild(row);
    }
    var track = Data.seasonTrack();
    var seasonClaims = track.filter(function (t) { return s.season.tier >= t.tier && !s.season.claimedFree[t.tier]; });
    if (seasonClaims.length) { any = true; scr._body.appendChild(UI.el("div", { class: "gtitle", style: { margin: "14px 0 10px" }, text: "SEASON PASS REWARDS" })); scr._body.appendChild(UI.el("div", { class: "mute", html: 'You have <b>' + seasonClaims.length + '</b> unclaimed season rewards. <span class="glink">Open Season Pass ›</span>', onclick: function () { UI.pop(); setTimeout(M.seasonPass, 280); } })); }
    if (!any) scr._body.appendChild(UI.el("div", { class: "empty", html: '<span class="e-ico">' + UI.ICON.gift + '</span>No rewards to claim right now. Play matches to earn more!' }));
    UI.push(scr);
  }

  // ============ STATISTICS ============
  function statistics() {
    var s = Store.get();
    var scr = UI.screen({ title: "STATISTICS", sub: "Detailed performance" });
    var wr = s.stats.matchesPlayed ? ((s.stats.wins / s.stats.matchesPlayed) * 100).toFixed(1) : "0.0";
    var avg = s.stats.matchesPlayed ? (s.stats.totalGuesses / s.stats.matchesPlayed).toFixed(2) : "0.00";
    var card = UI.el("div", { class: "gcard" });
    [["Matches Played", s.stats.matchesPlayed], ["Wins", s.stats.wins], ["Losses", s.stats.losses], ["Win Rate", wr + "%"],
     ["Current Streak", s.stats.currentStreak], ["Best Streak", s.stats.bestStreak], ["Perfect Solves", s.stats.perfectSolves], ["Avg Guesses/Match", avg],
     ["Multiplayer Matches", s.stats.multiPlayed], ["Team Wins", s.stats.teamWins], ["Daily Words Solved", s.stats.dailySolved],
     ["Current ELO", s.ranked.elo], ["Peak ELO", s.ranked.peakElo], ["Total XP", s.profile.totalXp || 0]
    ].forEach(function (r) { card.appendChild(UI.el("div", { class: "lrow" }, [UI.el("div", { class: "l-main" }, [UI.el("div", { class: "l-t", text: r[0] })]), UI.el("div", { class: "l-end", text: String(r[1]) })])); });
    scr._body.appendChild(card);
    var dist = [0, 0, 0, 0, 0, 0, 0];
    s.history.forEach(function (h) { if (h.result === "W" && h.guesses >= 1 && h.guesses <= 7) dist[h.guesses - 1]++; });
    var maxd = Math.max.apply(null, dist) || 1;
    scr._body.appendChild(UI.el("div", { class: "gtitle", style: { margin: "18px 0 10px" }, text: "GUESS DISTRIBUTION" }));
    var distCard = UI.el("div", { class: "gcard" });
     dist.forEach(function (c, i) { distCard.appendChild(UI.el("div", { class: "flex aic gap8", style: { margin: "6px 0" } }, [UI.el("div", { style: { width: "20px", "font-family": "IBM Plex Mono,monospace", "font-weight": "500" }, text: String(i + 1) }), UI.el("div", { class: "bar", style: { flex: "1" } }, [UI.el("i", { style: { width: (c / maxd * 100 || 3) + "%" } })]), UI.el("div", { class: "mute", style: { width: "30px", "text-align": "right" }, text: String(c) })])); });
    scr._body.appendChild(distCard); UI.push(scr);
  }

  // ============ COLLECTION ============
  function collection() {
    var s = Store.get();
    var scr = UI.screen({ title: "COLLECTION", sub: "Your cosmetics" });
    var total = Data.allShopItems().length, owned = Object.keys(s.inventory.owned).length + 6;
    scr._body.appendChild(UI.el("div", { class: "mute", style: { "margin-bottom": "14px" }, text: owned + " / " + total + " items collected" }));
    scr._body.appendChild(M._collectionTab(s));
    UI.push(scr);
  }

  M.leaderboard = leaderboard; M.friends = friends; M.club = club; M.events = events;
  M.settings = settings; M.rewards = rewards; M.statistics = statistics; M.collection = collection;
})(window);
