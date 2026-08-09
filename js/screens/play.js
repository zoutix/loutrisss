/* =====================================================================
   LOUTRIS — js/screens/play.js
   Mode select, Classic options (length / daily / practice / unlimited),
   Training modes, Custom game lobby.
   ===================================================================== */
(function (global) {
  "use strict";

  // ---- Classic options screen ----
  function classicOptions() {
    UI.pop();
    setTimeout(function () {
      MatchScreen.open({
        mode: "classic", subMode: "practice", length: 5, maxGuesses: 6,
        hardMode: false, hints: 1, title: "CLASSIC",
        victAnim: Store.get().profile.victAnim
      });
    }, 280);
  }

  // ---- Multiplayer lobby ----
  function multiplayerLobby() {
    var scr = UI.screen({ title: "MULTIPLAYER", sub: "Live PvP duels" });
    var grid = UI.el("div", { class: "mode-select" });
    [
      { k: "casual", name: "CASUAL DUEL", desc: "Fast PvP. No ELO risk.", icon: UI.ICON.user, color: "purple" }
    ].forEach(function (m) {
      var modeClass = m.k === "ranked" ? "ranked-duel" : (m.color === "blue" ? "classic" : "multi");
      var card = UI.el("div", { class: "mode " + modeClass, style: { cursor: "pointer", "min-height": "180px" }, onclick: function () { handleMultiChoice(m.k, scr); } }, [
        UI.el("div", { class: "m-head" }, [UI.el("div", { class: "m-ico", html: m.icon }), UI.el("div", { class: "m-tag", text: m.k.toUpperCase() })]),
        UI.el("div", { class: "m-name", text: m.name }),
        UI.el("div", { class: "m-sub", text: m.desc })
      ]);
      grid.appendChild(card);
    });
    scr._body.appendChild(grid);
    UI.push(scr);
  }
  function handleMultiChoice(k, scr) {
    if (k === "private") { UI.pop(); setTimeout(customLobby, 280); return; }
    var ranked = k === "ranked";
    UI.pop();
    showMatchmaking({ mode: "multiplayer", ranked: ranked, length: 5, maxGuesses: 6, title: ranked ? "RANKED DUEL" : "CASUAL DUEL", raceMode: true, victAnim: Store.get().profile.victAnim });
  }

  // ---- Matchmaking overlay ----
  function showMatchmaking(cfg) {
    var scr = UI.screen({ title: "MATCHMAKING", sub: "Finding opponent..." });
    var stage = UI.el("div", { class: "center-stage" });
    stage.appendChild(UI.el("div", { class: "spinner" }));
    stage.appendChild(UI.el("div", { class: "lt", text: "SEARCHING FOR OPPONENT" }));
    var cancelBtn = UI.button("CANCEL", { ghost: true, onclick: function () { cancelled = true; UI.pop(); } });
    stage.appendChild(cancelBtn);
    scr._body.appendChild(stage);
    UI.push(scr);
    var cancelled = false;
    Net.findMatch({ mode: cfg.mode, length: cfg.length, ranked: cfg.ranked, queueTime: 2200 }, function (match) {
      if (cancelled) return;
      // match-found presentation
      var opp = match.opponent;
      var veil = UI.el("div", { class: "mf-veil" });
      var card = UI.el("div", { class: "mf-card" }, [
        UI.el("div", { class: "mft", text: "MATCH FOUND" }),
        UI.el("div", { class: "mfs", text: match.type === "pvp" ? "CROSS-PLAY OPPONENT" : "OPPONENT FOUND" }),
        UI.el("div", { class: "vs-pair" }, [
          UI.el("div", { class: "vs-side" }, [UI.el("div", { class: "vs-av", text: Store.get().profile.avatar }), UI.el("div", { class: "hud-pn", text: Store.get().profile.name })]),
          UI.el("div", { class: "vs-mid", text: "VS" }),
          UI.el("div", { class: "vs-side" }, [UI.el("div", { class: "vs-av", text: opp.avatar }), UI.el("div", { class: "hud-pn", text: opp.name })])
        ]),
        UI.el("div", { class: "countdown-big", text: "3" })
      ]);
      veil.appendChild(card);
      document.getElementById("fx-layer").appendChild(veil);
      Audio.play("matchFound");
      var n = 3;
      var ci = setInterval(function () {
        n--;
        if (n > 0) { card.querySelector(".countdown-big").textContent = String(n); Audio.play("countdown"); }
        else if (n === 0) { card.querySelector(".countdown-big").textContent = "GO!"; Audio.play("go"); }
        else {
          clearInterval(ci); veil.remove(); UI.pop();
          var mcfg = Object.assign({}, cfg, { opponent: opp, roomId: match.roomId, raceMode: true });
          if (match.type === "pvp") { opp.isPeer = true; }
          MatchScreen.open(mcfg);
        }
      }, 900);
    });
  }

  // ---- Teams lobby ----
  function teamsLobby() {
    var scr = UI.screen({ title: "TEAMS", sub: "Cooperative word strategy" });
    var grid = UI.el("div", { class: "mode-select" });
    [
      { k: "2v2", name: "2 VERSUS 2", desc: "Pair up. Shared guesses, shared timer.", players: 2 },
      { k: "3v3", name: "3 VERSUS 3", desc: "Six-player cooperative chaos.", players: 3 }
    ].forEach(function (m) {
      var card = UI.el("div", { class: "mode teams", style: { cursor: "pointer", "min-height": "180px" }, onclick: function () { startTeamMatch(m.k, m.players); } }, [
        UI.el("div", { class: "m-head" }, [UI.el("div", { class: "m-ico", html: UI.ICON.user }), UI.el("div", { class: "m-tag", text: "CO-OP" })]),
        UI.el("div", { class: "m-name", text: m.name }),
        UI.el("div", { class: "m-sub", text: m.desc })
      ]);
      grid.appendChild(card);
    });
    scr._body.appendChild(grid);
    UI.push(scr);
  }
  function startTeamMatch(kind, players) {
    var s = Store.get();
    // generate bot teammates + opponents
    var teammates = [];
    for (var i = 0; i < players - 1; i++) {
      var b = Data.BOTS[Math.floor(Math.random() * Data.BOTS.length)];
      teammates.push({ name: b.name, avatar: b.avatar, elo: b.elo + Math.floor(Math.random() * 100 - 50), skill: b.skill });
    }
    var oppBot = Data.botForElo(s.ranked.elo);
    UI.pop();
    setTimeout(function () {
      MatchScreen.open({
        mode: "teams", subMode: kind, length: 5, maxGuesses: 7, teams: true,
        teammates: teammates, opponent: { name: "RIVAL TEAM", avatar: oppBot.avatar.slice(0, 2), elo: oppBot.elo, skill: oppBot.skill, speed: oppBot.speed },
        title: "TEAMS · " + kind, victAnim: s.profile.victAnim
      });
    }, 280);
  }

  // ---- Custom game lobby ----
  function customLobby() {
    var scr = UI.screen({ title: "CUSTOM GAME", sub: "Private lobby — invite friends" });
    var cfg = { length: 5, maxGuesses: 6, password: "", hardMode: false, spectators: true };
    var card = UI.el("div", { class: "gcard", style: { "max-width": "820px", margin: "0 auto" } });

    card.appendChild(UI.el("div", { class: "gtitle", html: "ROOM <span class='accent'>SETTINGS</span>" }));
    var lenRow = UI.el("div", { class: "opt-row" });
    [4, 5, 6].forEach(function (n) { lenRow.appendChild(UI.el("div", { class: "chip" + (n === cfg.length ? " on" : ""), text: n + " Letters", onclick: function () { cfg.length = n; syncChips(lenRow, n + " Letters"); } })); });
    card.appendChild(lenRow);
    var pwdInput = UI.el("input", { class: "input", placeholder: "Room password (optional)", style: { "margin-top": "12px", width: "100%" } });
    pwdInput.addEventListener("input", function () { cfg.password = pwdInput.value; });
    card.appendChild(UI.el("div", { class: "field", style: { "margin-top": "12px" } }, [UI.el("label", { text: "Password" }), pwdInput]));

    var roomCodeEl = UI.el("div", { class: "gcard", style: { "margin-top": "16px", "text-align": "center" } });
     var joinInput = UI.el("input", { class: "input", placeholder: "Enter room code to JOIN", style: { width: "260px", "text-align": "center", "font-family": "IBM Plex Mono,monospace", "letter-spacing": "3px", "font-weight": "500" } });

    var btnRow = UI.el("div", { class: "flex jcc gap12", style: { "margin-top": "16px" } }, [
      UI.button("CREATE ROOM", { primary: true, onclick: function () { createCustomRoom(cfg); } }),
      UI.button("JOIN ROOM", { gold: true, onclick: function () {
        if (!joinInput.value.trim()) { UI.toast("Enter a room code", "error"); return; }
        joinCustomRoom(joinInput.value.trim(), "");
      } })
    ]);
    card.appendChild(btnRow);
    card.appendChild(UI.el("div", { class: "gtitle", style: { "margin-top": "20px" }, html: "JOIN A <span class='accent'>ROOM</span>" }));
    card.appendChild(joinInput);

    scr._body.appendChild(card);
    UI.push(scr);
  }
  function createCustomRoom(cfg) {
    var s = Store.get();
    var roomId = Net.createRoom(cfg, function (joiner) {
      UI.toast(joiner.name + " joined the room", "success");
      Audio.play("join");
    });
    UI.toast("Room created: " + roomId, "success");
    // wait for opponent or allow start vs bot
    showRoomWaiting(roomId, cfg);
  }
  function showRoomWaiting(roomId, cfg) {
    var scr = UI.screen({ title: "ROOM " + roomId, sub: "Waiting for players..." });
    var stage = UI.el("div", { class: "center-stage" });
    stage.appendChild(UI.el("div", { class: "spinner" }));
    stage.appendChild(UI.el("div", { class: "lt", text: "ROOM CODE: " + roomId }));
    stage.appendChild(UI.el("div", { class: "ls", text: "Share this code. A friend can join from another tab." }));
    var opp = null;
    // listen for join via net (createRoom already handles joinreq); here we also accept peer match guess sync
    var startBtn = UI.button("START VS BOT", { primary: true, onclick: function () {
      var bot = Data.botForElo(Store.get().ranked.elo);
      UI.pop();
      setTimeout(function () { MatchScreen.open({ mode: "custom", length: cfg.length, maxGuesses: cfg.maxGuesses, hardMode: cfg.hardMode, opponent: { name: bot.name, avatar: bot.avatar, elo: bot.elo, skill: bot.skill, speed: bot.speed }, roomId: roomId, raceMode: true, title: "CUSTOM ROOM", victAnim: Store.get().profile.victAnim }); }, 280);
    } });
    stage.appendChild(startBtn);
    scr._body.appendChild(stage);
    UI.push(scr);
  }
  function joinCustomRoom(roomId, password) {
    Net.joinRoom(roomId, password, function (res) {
      UI.toast("Joined room " + roomId, "success");
      var bot = Data.botForElo(Store.get().ranked.elo);
      MatchScreen.open({ mode: "custom", length: 5, maxGuesses: 6, opponent: { name: "HOST", avatar: "HX", elo: 2000, skill: 0.6, speed: 0.6, isPeer: true, peerId: "host" }, roomId: roomId, raceMode: true, title: "CUSTOM ROOM", victAnim: Store.get().profile.victAnim });
    }, function (rej) { UI.toast("Failed to join: " + (rej.reason || "no response"), "error"); });
  }

  // ---- Training hub ----
  function trainingHub() {
    var scr = UI.screen({ title: "TRAINING", sub: "Sharpen your skills" });
    var grid = UI.el("div", { class: "train-grid" });
    [
      { k: "word", name: "WORD PRACTICE", desc: "Unlimited words, no pressure. Learn patterns.", icon: UI.ICON.star },
      { k: "speed", name: "SPEED MODE", desc: "Beat the clock. Fast solves earn more.", icon: UI.ICON.fire },
      { k: "reaction", name: "REACTION TRAINING", desc: "Tap the green target as fast as you can.", icon: UI.ICON.trophy },
      { k: "memory", name: "MEMORY MODE", desc: "Memorize and repeat the letter sequence.", icon: UI.ICON.crown }
    ].forEach(function (t) {
      var c = UI.el("div", { class: "train-card", onclick: function () { launchTraining(t.k); } }, [
        UI.el("div", { class: "tr-ico", html: t.icon }), UI.el("div", { class: "tr-name", text: t.name }), UI.el("div", { class: "tr-desc", text: t.desc })
      ]);
      grid.appendChild(c);
    });
    scr._body.appendChild(grid);
    UI.push(scr);
  }
  function launchTraining(k) {
    UI.pop();
    setTimeout(function () {
      if (k === "word") MatchScreen.open({ mode: "training", subMode: "practice", length: 5, maxGuesses: 8, hints: 2, title: "WORD PRACTICE", victAnim: Store.get().profile.victAnim });
      else if (k === "speed") MatchScreen.open({ mode: "training", subMode: "speed", length: 5, maxGuesses: 6, timeLimit: 60, hints: 0, title: "SPEED MODE", victAnim: Store.get().profile.victAnim });
      else if (k === "reaction") reactionTraining();
      else if (k === "memory") memoryTraining();
    }, 280);
  }

  function reactionTraining() {
    var scr = UI.screen({ title: "REACTION TRAINING", sub: "Click when it turns green" });
    var stage = UI.el("div", { class: "react-stage" });
    var target = UI.el("div", { class: "react-target idle", text: "WAIT" });
    var resultText = UI.el("div", { class: "ls", text: "Best time: —" });
    stage.appendChild(target); stage.appendChild(resultText);
    scr._body.appendChild(stage);
    UI.push(scr);
    var best = Infinity, startTime = 0, goTimeout = null, waiting = false;
    function reset() {
      target.className = "react-target wait"; target.textContent = "GET READY"; waiting = true;
      goTimeout = setTimeout(function () { target.className = "react-target go"; target.textContent = "CLICK!"; startTime = performance.now(); waiting = false; }, 800 + Math.random() * 2000);
    }
    target.addEventListener("click", function () {
      if (waiting) { // clicked too early
        clearTimeout(goTimeout); target.className = "react-target done"; target.textContent = "TOO EARLY!"; Audio.play("error");
        setTimeout(reset, 1200); return;
      }
      if (startTime) {
        var rt = Math.round(performance.now() - startTime);
        if (rt < best) { best = rt; resultText.textContent = "Best time: " + best + "ms"; Store.addXp(5); }
        target.className = "react-target done"; target.textContent = rt + "ms"; Audio.play("reward");
        startTime = 0; setTimeout(reset, 1400);
      }
    });
    reset();
  }

  function memoryTraining() {
    var scr = UI.screen({ title: "MEMORY MODE", sub: "Repeat the sequence" });
    var stage = UI.el("div", { class: "center-stage", style: { "min-height": "auto" } });
    var grid = UI.el("div", { class: "mem-grid", style: { width: "420px", "grid-template-columns": "repeat(4,1fr)" } });
    var status = UI.el("div", { class: "ls", text: "Level 1" });
    stage.appendChild(status); stage.appendChild(grid);
    scr._body.appendChild(stage);
    UI.push(scr);
    var letters = "ABCDEFGH".split(""), level = 1, seq = [], showing = false;
    var cells = letters.slice(0, 8).map(function (l) {
      var c = UI.el("div", { class: "mem-cell", text: l });
      c.addEventListener("click", function () { if (showing) return; handlePick(l, c); });
      grid.appendChild(c); return c;
    });
    var idx = 0;
    function nextLevel() { status.textContent = "Level " + level; seq = []; for (var i = 0; i < level + 2; i++) seq.push(letters[Math.floor(Math.random() * 8)]); idx = 0; playSeq(); }
    function playSeq() {
      showing = true;
      seq.forEach(function (l, i) { setTimeout(function () { var ci = letters.indexOf(l); cells[ci].classList.add("show"); Audio.play("hint"); setTimeout(function () { cells[ci].classList.remove("show"); }, 500); }, i * 700); });
      setTimeout(function () { showing = false; }, seq.length * 700 + 200);
    }
    function handlePick(l, cell) {
      if (l === seq[idx]) { cell.classList.add("correct"); setTimeout(function () { cell.classList.remove("correct"); }, 300); Audio.play("correct"); idx++; if (idx >= seq.length) { level++; Store.addXp(10); Audio.play("reward"); setTimeout(nextLevel, 600); } }
      else { cell.classList.add("wrong"); setTimeout(function () { cell.classList.remove("wrong"); }, 300); Audio.play("error"); UI.toast("Wrong! Back to level 1", "error"); level = 1; setTimeout(nextLevel, 800); }
    }
    nextLevel();
  }

  // ---- helpers ----
  function syncChips(row, onText) {
    $$(".chip", row).forEach(function (c) { c.classList.toggle("on", c.textContent === onText); });
  }

  global.PlayScreen = {
    classicOptions: classicOptions,
    multiplayerLobby: multiplayerLobby,
    teamsLobby: teamsLobby,
    customLobby: customLobby,
    trainingHub: trainingHub,
    showMatchmaking: showMatchmaking
  };
})(window);
