/* =====================================================================
   LOUTRIS — js/screens/match.js
   Shared gameplay screen for classic / multiplayer / teams / ranked /
   training / custom. Board + keyboard + HUD + opponent + team mechanics.
   Supports turn-based 1v1 shared-board duels with color-coded rows and turn indicators.
   ===================================================================== */
(function (global) {
  "use strict";

  function open(cfg) {
    cfg = cfg || {};
    cfg.length = cfg.length || 5;
    cfg.maxGuesses = cfg.maxGuesses || 6;
    if (cfg.ranked) {
      UI.toast("Ranked play is unavailable until a verified cloud match is ready.", "error");
      return null;
    }
    var s = Store.get();

    var isDuel = cfg.opponent && !cfg.teams;
    var peerSynced = !!(cfg.opponent && cfg.opponent.isPeer);
    var match;

    if (isDuel) {
      match = Game.createDuel({
        length: cfg.length,
        daily: cfg.subMode === "daily",
        answer: cfg.answer,
        clockPerPlayer: cfg.duelClock || 90,
        // Peer duels: P1 is always the host (same physical player on both
        // sides), so a deterministic starter keeps both boards in sync.
        starter: peerSynced ? Game.P1 : undefined
      });
    } else {
      match = Game.createMatch({
        length: cfg.length,
        maxGuesses: cfg.maxGuesses,
        daily: cfg.subMode === "daily",
        answer: cfg.answer,
        maxHints: cfg.hints != null ? cfg.hints : 1,
        hardMode: cfg.hardMode,
        timeLimit: cfg.timeLimit || 0
      });
    }

    var state = {
      cfg: cfg, match: match,
      startedAt: Date.now(),
      currentInput: "",
      busy: false,
      ended: false,
      timeLeft: cfg.timeLimit || 0,
      timerInt: null,
      opp: cfg.opponent || null,
      oppMatch: null, oppGuessCount: 0, oppDone: false, oppWon: false,
      spectators: cfg.spectators || Math.floor(Math.random() * 6),
      chatLog: cfg.teams ? [{ who: "SYSTEM", text: "Team channel ready. Coordinate your guesses!", sys: true }] : [],
      votes: {}, // for team mode
      teammates: cfg.teammates || [],
      peerSynced: peerSynced,
      peerSendSeq: 0,
      peerLastSeq: -1
    };

    if (isDuel) {
      if (state.peerSynced) {
        var myKey = (s.profile.name + (cfg.peerId || "")).toLowerCase();
        var oppKey = (state.opp.name + (state.opp.peerId || "")).toLowerCase();
        var hostIsP1 = myKey < oppKey;
        state.myId = hostIsP1 ? Game.P1 : Game.P2;
        state.oppId = hostIsP1 ? Game.P2 : Game.P1;
      } else {
        // Bot match: human is always P1
        state.myId = Game.P1;
        state.oppId = Game.P2;
      }
    }

    // ---- Build screen ----
    if (isDuel && !cfg.sub) {
      // Show the live attempt split: starter gets the extra chance.
      cfg.sub = (cfg.length + "-letter") + " · " + match.maxRows + " chances · " +
        match.attemptLimits[state.myId] + " & " + match.attemptLimits[state.oppId] +
        " · " + (cfg.ranked ? "RANKED" : "CASUAL");
    }
    var scr = UI.screen({
      title: cfg.title || modeTitle(cfg),
      sub: cfg.sub || modeSub(cfg),
      onBack: function () { confirmExit(); }
    });
    scr.classList.add("match-screen");
    document.body.classList.add("match-active");
    var stage = UI.el("div", { class: "match" });
    scr._body.appendChild(stage);

    // HUD
    var hud = buildHUD(state);
    stage.appendChild(hud);

    var isSolo = !isDuel && !cfg.teams && !state.opp;
    var matchStage = UI.el("div", { class: "match-stage" + (isSolo ? " solo" : "") + (isDuel ? " duel-stage" : "") });

      // Opponent mini board (left) — only for competitive modes (not 1v1 duels)
      var oppWrap = UI.el("div", { class: "opp-board-wrap" });
      if (isDuel) {
        // MATCH DETAILS panel removed
      } else if (cfg.teams) {
        oppWrap.appendChild(UI.el("div", { class: "opp-head", text: "YOUR TEAM" }));
        cfg.teammates.forEach(function (tm) {
          oppWrap.appendChild(UI.el("div", { class: "friend-row" }, [
            UI.el("div", { class: "fr-av online", text: tm.avatar }),
            UI.el("div", { class: "fr-main" }, [UI.el("div", { class: "fr-name", text: tm.name }), UI.el("div", { class: "fr-status", text: "ready · " + tm.elo + " ELO" })])
          ]));
        });
      } else if (state.opp) {
        oppWrap.appendChild(UI.el("div", { class: "opp-head", html: '<span class="live"></span> ' + escapeHtml(state.opp.name) + " · LIVE" }));
        var oppBoard = buildBoard(cfg.length, cfg.maxGuesses, true);
        oppWrap.appendChild(oppBoard.node);
        state.oppBoard = oppBoard;
      }
      matchStage.appendChild(oppWrap);

      // My board (center)
      var myWrap = UI.el("div", { class: "my-board-wrap" });
      
      // Duel panel: [Clock P1] [TURN INDICATOR] [Clock P2] above the board
      if (isDuel) {
        var duelPanel = UI.el("div", { class: "duel-panel" });
        var dpRow = UI.el("div", { class: "dp-row" });
        var c1 = UI.el("div", { class: "dp-clock p1" }, [UI.el("span", { class: "dp-clock-lbl", text: "P1" }), UI.el("span", { class: "dp-clock-val", text: fmtTime(state.match.clocks[Game.P1]) })]);
        var c2 = UI.el("div", { class: "dp-clock p2" }, [UI.el("span", { class: "dp-clock-lbl", text: "P2" }), UI.el("span", { class: "dp-clock-val", text: fmtTime(state.match.clocks[Game.P2]) })]);
        var turnIndicator = UI.el("div", { class: "turn-indicator" });
        state.clockP1El = c1;
        state.clockP2El = c2;
        state.turnIndicator = turnIndicator;
        dpRow.appendChild(c1);
        dpRow.appendChild(turnIndicator);
        dpRow.appendChild(c2);
        duelPanel.appendChild(dpRow);
        myWrap.appendChild(duelPanel);
      }

      var myBoard = buildBoard(cfg.length, isDuel ? state.match.maxRows : cfg.maxGuesses, false);
      if (isDuel) {
        myBoard.node.classList.add("duel");
        // P1: 4 chances, P2: 3 — the final (7th) row always belongs to the
        // starter (the first mover), so starter == finisher.
        myBoard.node.querySelectorAll(".row").forEach(function (rowEl, r) {
          rowEl.setAttribute("data-owner", Game.rowOwner(state.match, r));
        });
      }
      myWrap.appendChild(myBoard.node);
      state.myBoard = myBoard;

      if (isDuel) {
        updateTurnIndicator(state);
      }

      // Controls under board
      var ctrls = UI.el("div", { class: "flex aic jcc gap12" });
      if (!isDuel) {
        if (cfg.subMode === "unlimited" || cfg.mode === "training") {
          ctrls.appendChild(UI.button("NEW WORD", { icon: "↻", onclick: function () { restart(state); }, ghost: true, sm: true }));
        }
      }
      myWrap.appendChild(ctrls);
      matchStage.appendChild(myWrap);

      // Side panel (right): chat/vote/spectators
      var sideWrap = UI.el("div", { class: "match-side" });
      buildSidePanel(sideWrap, state);
      matchStage.appendChild(sideWrap);

      stage.appendChild(matchStage);

    // Keyboard
    var kbd = buildKeyboard(state);
    stage.appendChild(kbd.node);
    state.kbd = kbd;

    // wire physical keyboard
    function keyHandler(e) {
      if (!UI.isTop(scr)) return;
      if (state.ended || state.busy) return;
      if (isDuel && state.match.currentTurn !== state.myId) return;
      var k = e.key;
      if (k === "Enter") { e.preventDefault(); submit(state); }
      else if (k === "Backspace") { e.preventDefault(); backspace(state); }
      else if (/^[a-zA-Z]$/.test(k)) { e.preventDefault(); typeKey(state, k.toLowerCase()); }
    }
    window.addEventListener("keydown", keyHandler);
    state._keyHandler = keyHandler;

    // ---- native phone keyboard input ----
    if (window.matchMedia && window.matchMedia("(max-width: 767px)").matches) {
      var nat = document.createElement("input");
      nat.type = "text";
      nat.className = "native-kb-input";
      nat.setAttribute("autocapitalize", "off");
      nat.setAttribute("autocomplete", "off");
      nat.setAttribute("autocorrect", "off");
      nat.setAttribute("spellcheck", "false");
      nat.setAttribute("enterkeyhint", "done");
      nat.addEventListener("input", function () { nat.value = ""; });
      scr.appendChild(nat);
      function focusNative() {
        if (state.ended || state.busy) return;
        if (isDuel && state.match.currentTurn !== state.myId) return;
        scr.classList.add("native-kb");
        try { nat.focus({ preventScroll: true }); } catch (e) { nat.focus(); }
      }
      nat.addEventListener("focus", function () {
        scr.classList.add("native-kb");
        if (state._scheduleMobileLayout) state._scheduleMobileLayout();
      });
      nat.addEventListener("blur", function () {
        scr.classList.remove("native-kb");
        if (state._scheduleMobileLayout) state._scheduleMobileLayout();
      });
      var boardEl = stage.querySelector(".board");
      if (boardEl) boardEl.addEventListener("pointerup", focusNative);
      state._nativeInput = nat;
    }

    UI.push(scr);
    Audio.play("enter");
    setupMobileLayout(state, scr, matchStage, myWrap, state.myBoard.node);

    // start timer
    if (isDuel) startDuelClock(state);
    else if (state.timeLeft > 0) startTimer(state);

    // start opponent simulation or 1v1 listener
    if (isDuel) {
      if (state.opp && !state.opp.isPeer) {
        if (state.match.currentTurn === state.oppId) {
          triggerBotTurn(state);
        }
      } else if (state.opp && state.opp.isPeer) {
        startPeerDuelListener(state);
      }
    } else {
      if (state.opp && !state.opp.isPeer) startBotOpponent(state);
      if (state.opp && state.opp.isPeer) startPeerOpponent(state);
    }

    // cleanup on pop
    state.cleanup = function () {
      document.body.classList.remove("match-active");
      window.removeEventListener("keydown", keyHandler);
      if (state._nativeInput) { state._nativeInput.blur(); state._nativeInput = null; }
      if (state._mobileLayoutCleanup) state._mobileLayoutCleanup();
      if (state.timerInt) clearInterval(state.timerInt);
      if (state.clockInt) clearInterval(state.clockInt);
      if (state._oppTimer) clearTimeout(state._oppTimer);
    };

    return state;
  }

  function setupMobileLayout(state, scr, matchStage, myWrap, boardEl) {
    if (!window.matchMedia || !window.matchMedia("(max-width: 767px)").matches) return;

    var viewport = window.visualViewport;
    var raf = 0;
    var disposed = false;
    var cleanups = [];

    function viewportHeight() {
      return viewport && viewport.height ? viewport.height : window.innerHeight;
    }

    function schedule() {
      if (disposed || raf) return;
      var run = function () {
        raf = 0;
        fit();
      };
      raf = window.requestAnimationFrame ? window.requestAnimationFrame(run) : window.setTimeout(run, 0);
    }

    function fit() {
      if (disposed) return;
      var height = viewportHeight();
      if (!height) return;
      scr.style.setProperty("--mobile-vh", height + "px");

      var rows = boardEl.querySelectorAll(".row");
      var firstTile = boardEl.querySelector(".tile");
      if (!rows.length || !firstTile || !myWrap.clientHeight) return;

      var boardStyle = window.getComputedStyle(boardEl);
      var rowStyle = window.getComputedStyle(rows[0]);
      var wrapStyle = window.getComputedStyle(myWrap);
      var duelPanel = myWrap.querySelector(".duel-panel");
      var controls = myWrap.querySelector(".flex");
      var rowGap = parseFloat(boardStyle.rowGap) || parseFloat(boardStyle.gap) || 0;
      var columnGap = parseFloat(rowStyle.columnGap) || parseFloat(rowStyle.gap) || 0;
      var wrapGap = parseFloat(wrapStyle.rowGap) || parseFloat(wrapStyle.gap) || 0;
      var rowVerticalExtra = (parseFloat(rowStyle.paddingTop) || 0) + (parseFloat(rowStyle.paddingBottom) || 0) +
        (parseFloat(rowStyle.borderTopWidth) || 0) + (parseFloat(rowStyle.borderBottomWidth) || 0);
      var rowHorizontalExtra = (parseFloat(rowStyle.paddingLeft) || 0) + (parseFloat(rowStyle.paddingRight) || 0) +
        (parseFloat(rowStyle.borderLeftWidth) || 0) + (parseFloat(rowStyle.borderRightWidth) || 0);
      var fixedHeight = (duelPanel ? duelPanel.offsetHeight + (parseFloat(window.getComputedStyle(duelPanel).marginBottom) || 0) : 0) +
        (controls ? controls.offsetHeight : 0) + wrapGap * Math.max(0, myWrap.children.length - 1);
      var heightBudget = myWrap.clientHeight - fixedHeight;
      var heightTile = (heightBudget - rowGap * (rows.length - 1) - rowVerticalExtra * rows.length) / rows.length;
      var widthTile = (myWrap.clientWidth - rowHorizontalExtra - columnGap * (state.match.length - 1)) / state.match.length;
      var tile = Math.floor(Math.min(heightTile, widthTile));
      tile = Math.min(48, Math.max(16, tile));
      boardEl.style.setProperty("--tile", tile + "px");
    }

    function addListener(target, event, handler) {
      target.addEventListener(event, handler, { passive: true });
      cleanups.push(function () { target.removeEventListener(event, handler); });
    }

    addListener(window, "resize", schedule);
    addListener(window, "orientationchange", schedule);
    if (viewport) {
      addListener(viewport, "resize", schedule);
      addListener(viewport, "scroll", schedule);
    }

    if (window.ResizeObserver) {
      var observer = new ResizeObserver(schedule);
      observer.observe(scr);
      observer.observe(matchStage);
      observer.observe(myWrap);
      cleanups.push(function () { observer.disconnect(); });
    }

    state._scheduleMobileLayout = schedule;
    state._mobileLayoutCleanup = function () {
      disposed = true;
      if (raf) {
        if (window.cancelAnimationFrame) window.cancelAnimationFrame(raf);
        else window.clearTimeout(raf);
      }
      cleanups.forEach(function (cleanup) { cleanup(); });
      scr.style.removeProperty("--mobile-vh");
      state._scheduleMobileLayout = null;
      state._mobileLayoutCleanup = null;
    };

    schedule();
  }

  function buildHUD(state) {
    var cfg = state.cfg, s = Store.get();
    var me = { name: s.profile.name, avatar: s.profile.avatar, elo: s.ranked.elo, rank: Data.rankFromElo(s.ranked.elo) };
    var opp = state.opp;
    var isDuel = Game.isDuel(state.match);
    var isSolo = !isDuel && !opp;
    var centerChildren = [];

    if (isDuel) {
      centerChildren.push(UI.el("div", { class: "hud-mode", text: "1V1 DUEL" }));
    } else if (state.opp) {
      centerChildren.push(UI.el("div", { class: "hud-mode", text: (cfg.ranked ? "RANKED DUEL" : "CASUAL DUEL") }));
    } else {
      centerChildren.push(UI.el("div", { class: "hud-mode", text: (cfg.mode || "CLASSIC").toUpperCase() }));
    }

    if (!isDuel && !state.opp) {
      centerChildren.push(state.timeLeft > 0 ? UI.el("div", { class: "hud-timer", text: fmtTime(state.timeLeft) }) : UI.el("div", { class: "hud-round", text: cfg.subMode ? cfg.subMode.toUpperCase() : "MATCH" }));
    }

    var hud = UI.el("div", { class: "match-hud" + (isSolo ? " solo" : "") }, [
      UI.el("div", { class: "hud-vs" }, [
        isDuel ? nameTag(me, true, state) : playerBlock(me, true, state),
        UI.el("div", { class: "hud-center" }, centerChildren),
        isDuel ? nameTag(opp, false, state) : (opp ? playerBlock(opp, false, state) : null)
      ])
    ]);
    state.hudTimer = $(".hud-timer", hud);
    return hud;
  }

  function nameTag(p, isMe, state) {
    var pId = isMe ? state.myId : state.oppId;
    var node = UI.el("div", { class: "hud-name-tag " + pId }, [
      UI.el("span", { class: "hud-tag-name", text: p.name }),
      UI.el("span", { class: "hud-tag-elo", text: p.elo + " ELO" })
    ]);
    if (isMe) state.meHud = node; else state.oppHud = node;
    return node;
  }

  function playerBlock(p, isMe, state) {
    var isDuel = Game.isDuel(state.match);
    var pId = isMe ? state.myId : state.oppId;
    var cls = "hud-player" + (isMe ? " me" : "");
    var avCls = "hud-av";

    if (isDuel) {
      cls += " " + pId;
      avCls += " " + pId;
    }

    var prog = 0;
    if (isDuel) {
      prog = Math.min(100, ((state.match.attempts[pId] || 0) / state.match.attemptLimits[pId]) * 100);
    } else {
      var m = isMe ? state.match : state.oppMatch;
      prog = m ? Math.min(100, (m.guesses.length / state.match.maxGuesses) * 100) : 0;
    }

    var node = UI.el("div", { class: cls }, [
      UI.el("div", { class: avCls, text: p.avatar || (p.name || "?").slice(0, 2) }),
      UI.el("div", { class: "hud-info" }, [
        UI.el("div", { class: "hud-name-row" }, [
          UI.el("div", { class: "hud-pn", text: isMe ? p.name : p.name }),
          UI.el("div", { class: "hud-pr", text: p.elo ? (p.elo + " ELO") : "" })
        ]),
        UI.el("div", { class: "hud-pbar" }, [UI.el("i", { style: { width: prog + "%" } })])
      ])
    ]);
    if (isMe) state.meHud = node; else state.oppHud = node;
    return node;
  }

  function updateHudProgress(state) {
    var isDuel = Game.isDuel(state.match);
    if (isDuel) return; // progress shown in duel panel clocks
    if (state.meHud) { var i = $(".hud-pbar > i", state.meHud); if (i) i.style.width = Math.min(100, (state.match.guesses.length / state.match.maxGuesses) * 100) + "%"; }
    if (state.oppHud && state.oppMatch) { var j = $(".hud-pbar > i", state.oppHud); if (j) j.style.width = Math.min(100, (state.oppMatch.guesses.length / state.oppMatch.maxGuesses) * 100) + "%"; }
  }

  function buildBoard(len, rows, mini) {
    var node = UI.el("div", { class: "board length" + len + (mini ? " mini" : "") });
    var rowNodes = [];
    for (var r = 0; r < rows; r++) {
      var row = UI.el("div", { class: "row" });
      var tiles = [];
      for (var c = 0; c < len; c++) { var t = UI.el("div", { class: "tile" }); row.appendChild(t); tiles.push(t); }
      node.appendChild(row); rowNodes.push(tiles);
    }
    return { node: node, rows: rowNodes };
  }

  function buildKeyboard(state) {
    var layout = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    var node = UI.el("div", { class: "keyboard" });
    var keyNodes = {};
    layout.forEach(function (line, li) {
      var row = UI.el("div", { class: "kbd-row" });
      if (li === 2) row.appendChild(makeKey("ENTER", "wide", state, "enter"));
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        var k = makeKey(ch.toUpperCase(), "", state, ch);
        keyNodes[ch] = k; row.appendChild(k);
      }
      if (li === 2) row.appendChild(makeKey("⌫", "wide", state, "back"));
      node.appendChild(row);
    });
    return { node: node, keys: keyNodes };
  }

  function makeKey(label, extra, state, key) {
    var k = UI.el("button", { class: "key" + (extra ? " " + extra : ""), text: label });
    k.addEventListener("click", function () {
      Audio.unlock(); Audio.play("click");
      if (state.ended || state.busy) return;
      if (key === "enter") submit(state);
      else if (key === "back") backspace(state);
      else typeKey(state, key);
    });
    k.addEventListener("mouseenter", function () { Audio.play("hover"); });
    return k;
  }

  function buildSidePanel(sideWrap, state) {
    if (state.cfg.teams || (state.opp && state.cfg.mode === "custom")) {
      var msgs = UI.el("div", { class: "chat-msgs" });
      state.chatMsgsEl = msgs;
      renderChat(state);
      var input = UI.el("input", { class: "input", placeholder: "Send a message..." });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter" && input.value.trim()) { sendChat(state, input.value.trim()); input.value = ""; } });
      sideWrap.appendChild(UI.el("div", { class: "chat-box gcard" }, [
        UI.el("div", { class: "ghead" }, [UI.el("div", { class: "gtitle", html: "TEAM <span class='accent'>CHAT</span>" })]),
        msgs, UI.el("div", { class: "chat-input" }, [input])
      ]));
      if (state.cfg.teams) {
        var voteBox = UI.el("div", { class: "gcard" }, [
          UI.el("div", { class: "ghead" }, [UI.el("div", { class: "gtitle", html: "WORD <span class='accent'>VOTE</span>" })]),
          UI.el("div", { class: "vote-list", text: "Propose a word with ENTER; teammates vote." })
        ]);
        state.voteListEl = $(".vote-list", voteBox);
        sideWrap.appendChild(voteBox);
      }
    } else if (state.opp) {
      // MATCH INFO panel removed
    }
  }

  // ---- Input handling ----
  function typeKey(state, ch) {
    var isDuel = Game.isDuel(state.match);
    if (isDuel && state.match.currentTurn !== state.myId) return;
    if (state.currentInput.length >= state.match.length) return;
    state.currentInput += ch;
    Audio.play("type");
    paintCurrentRow(state);
  }

  function backspace(state) {
    var isDuel = Game.isDuel(state.match);
    if (isDuel && state.match.currentTurn !== state.myId) return;
    state.currentInput = state.currentInput.slice(0, -1);
    Audio.play("back");
    paintCurrentRow(state);
  }

  function paintCurrentRow(state) {
    var r = state.match.guesses.length;
    var tiles = state.myBoard.rows[r];
    if (!tiles) return;
    for (var i = 0; i < tiles.length; i++) {
      var ch = state.currentInput[i] || "";
      tiles[i].textContent = ch.toUpperCase();
      tiles[i].className = "tile";
      if (ch) { tiles[i].classList.add("filled"); tiles[i].textContent = ch.toUpperCase(); }
      else if (isHinted(state, i)) { var h = hintAt(state, i); tiles[i].classList.add("hint"); tiles[i].textContent = h.letter.toUpperCase(); }
      else { tiles[i].textContent = ""; }
    }
  }

  function isHinted(state, pos) { return !Game.isDuel(state.match) && state.match.hints.some(function (h) { return h.pos === pos; }); }
  function hintAt(state, pos) { if (Game.isDuel(state.match)) return null; for (var i = 0; i < state.match.hints.length; i++) if (state.match.hints[i].pos === pos) return state.match.hints[i]; return null; }

  function submit(state) {
    if (state.busy || state.ended) return;
    var isDuel = Game.isDuel(state.match);
    if (isDuel && state.match.currentTurn !== state.myId) return;

    var word = state.currentInput.toLowerCase();
    if (word.length !== state.match.length) { shakeRow(state); Audio.play("error"); UI.toast("Not enough letters", "error"); return; }

    var res;
    if (isDuel) {
      res = Game.submitDuelGuess(state.match, state.myId, word);
    } else {
      res = Game.submitGuess(state.match, word);
    }

    if (!res.ok) { shakeRow(state); Audio.play("error"); UI.toast(res.error, "error"); return; }
    state.currentInput = "";
    state.busy = true;
    broadcastGuess(state, word);

    var rIdx = state.match.guesses.length - 1;
    animateRow(state, rIdx, res.eval, function () {
      state.busy = false;
      updateKeyboard(state);
      updateHudProgress(state);

      if (isDuel) {
        updateTurnIndicator(state);
        if (state.match.status !== "playing") {
          endMatch(state);
        } else {
          // If bot turn, run the bot logic
          if (state.opp && !state.opp.isPeer) {
            triggerBotTurn(state);
          }
        }
      } else {
        if (state.cfg.teams) teamComment(state, word);
        if (state.match.status !== "playing") endMatch(state);
      }
    });
  }

  function shakeRow(state) {
    var r = state.match.guesses.length;
    var tiles = state.myBoard.rows[r]; if (!tiles) return; var parent = tiles[0].parentNode; UI.shake(parent);
  }

  function animateRow(state, r, ev, done) {
    var tiles = state.myBoard.rows[r]; if (!tiles) { done && done(); return; }
    var delay = 0;
    tiles.forEach(function (t, i) {
      setTimeout(function () {
        t.classList.add("flip");
        Audio.play("flip");
        setTimeout(function () {
          t.classList.add(ev[i].state);
          t.classList.remove("filled");
          Audio.play(ev[i].state);
        }, 250);
      }, delay); delay += 280;
    });
    setTimeout(function () { tiles.forEach(function (t) { t.classList.remove("flip"); }); done && done(); }, delay + 200);
  }

  function updateKeyboard(state) {
    var ks = state.match.keyStates;
    Object.keys(ks).forEach(function (ch) {
      var node = state.kbd.keys[ch]; if (!node) return;
      node.classList.remove("correct", "present", "absent");
      node.classList.add(ks[ch].state);
    });
  }

  function useHint(state, board) {
    if (Game.isDuel(state.match)) return;
    var h = Game.useHint(state.match);
    if (!h) { UI.toast("No hints left", "error"); Audio.play("error"); return; }
    Audio.play("hint");
    paintCurrentRow(state);
    UI.toast("Hint revealed: " + h.letter.toUpperCase() + " at position " + (h.pos + 1), "gold");
  }

  function updateTurnIndicator(state) {
    if (!state.turnIndicator) return;
    var duel = state.match;
    UI.clear(state.turnIndicator);

    var r = duel.guesses.length;
    var rows = state.myBoard.node.querySelectorAll(".row");
    rows.forEach(function (rowEl, idx) {
      if (idx === r && duel.status === "playing") {
        rowEl.classList.add("active-turn");
      } else {
        rowEl.classList.remove("active-turn");
      }
    });

    if (duel.status !== "playing") {
      state.turnIndicator.className = "turn-indicator locked";
      state.turnIndicator.appendChild(UI.el("div", { text: "MATCH OVER" }));
      updateDuelClocks(state);
      return;
    }

    var activeOwner = "p1";
    if (r > 0) {
      var lastRow = rows[r];
      if (lastRow) activeOwner = lastRow.getAttribute("data-owner") === "P2" ? "p2" : "p1";
    } else {
      var firstRow = rows[0];
      if (firstRow) activeOwner = firstRow.getAttribute("data-owner") === "P2" ? "p2" : "p1";
    }

    if (duel.currentTurn === state.myId) {
      state.turnIndicator.className = "turn-indicator " + activeOwner + " is-mine";
      state.turnIndicator.appendChild(UI.el("span", { class: "ti-dot" }));
      state.turnIndicator.appendChild(UI.el("div", { class: "ti-lbl mine", text: "YOUR TURN" }));
    } else {
      state.turnIndicator.className = "turn-indicator " + activeOwner + " is-theirs";
      state.turnIndicator.appendChild(UI.el("span", { class: "ti-dot" }));
      state.turnIndicator.appendChild(UI.el("div", { class: "ti-lbl", text: escapeHtml(state.opp.name).toUpperCase() + "'S TURN" }));
    }
    updateDuelClocks(state);
  }

  // ---- Timer ----
  function startTimer(state) {
    state.timerInt = setInterval(function () {
      state.timeLeft--;
      if (state.hudTimer) { state.hudTimer.textContent = fmtTime(state.timeLeft); if (state.timeLeft <= 10) state.hudTimer.classList.add("low"); }
      if (state.timeLeft <= 5 && state.timeLeft > 0) Audio.play("countdown");
      if (state.timeLeft <= 0) { clearInterval(state.timerInt); state.timeLeft = 0; if (!state.ended) { Audio.play("go"); timeoutLoss(state); } }
    }, 1000);
  }

  // Chess-clock for 1v1 duels: only the player whose turn it is loses
  // time. Animation periods (busy) are free for both sides.
  function startDuelClock(state) {
    state.clockInt = setInterval(function () {
      if (state.ended || state.match.status !== "playing") return;
      if (state.busy) return; // free phase during flip animations
      var timedOut = Game.tickDuelClock(state.match);
      updateDuelClocks(state);
      if (timedOut) {
        clearInterval(state.clockInt);
        if (!state.ended) { Audio.play("go"); timeoutLoss(state); }
      }
    }, 1000);
    updateDuelClocks(state);
  }

  function updateDuelClocks(state) {
    if (!state.clockP1El || !state.clockP2El) return;
    state.clockP1El.textContent = fmtTime(state.match.clocks[Game.P1]);
    state.clockP2El.textContent = fmtTime(state.match.clocks[Game.P2]);
    var active = state.match.status === "playing" ? state.match.currentTurn : null;
    state.clockP1El.classList.toggle("active", active === Game.P1);
    state.clockP2El.classList.toggle("active", active === Game.P2);
    if (state.match.clocks[Game.P1] <= 10) state.clockP1El.classList.add("low");
    if (state.match.clocks[Game.P2] <= 10) state.clockP2El.classList.add("low");
  }

  function fmtTime(sec) { if (sec <= 0) return "0:00"; var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }
  function timeoutLoss(state) {
    if (Game.isDuel(state.match)) {
      state.match.winner = state.oppId;
    }
    state.match.status = "lost";
    endMatch(state);
  }

  // ---- Bot Opponent 1v1 turn trigger ----
  function triggerBotTurn(state) {
    if (state.ended) return;
    var duel = state.match;
    if (duel.currentTurn !== state.oppId) return;

    // Do NOT set busy during the bot's thinking delay, so the bot's own
    // chess-clock keeps ticking. Human input is already blocked because
    // it isn't their turn. busy is only raised for the flip animation.
    updateTurnIndicator(state);

    setTimeout(function () {
      var botWord = Game.botGuess(duel, state.opp.skill || 0.5);
      if (!botWord) botWord = Data.randomAnswer(duel.length);

      var rowIdx = duel.guesses.length;
      var tiles = state.myBoard.rows[rowIdx];
      if (tiles) {
        tiles.forEach(function (t, i) {
          setTimeout(function () {
            t.textContent = botWord[i].toUpperCase();
            t.classList.add("filled");
            Audio.play("type");
          }, i * 150);
        });
      }

      setTimeout(function () {
        var res = Game.submitDuelGuess(duel, state.oppId, botWord);
        if (res.ok) {
          state.busy = true;
          broadcastGuess(state, botWord);
          animateRow(state, rowIdx, res.eval, function () {
            state.busy = false;
            updateKeyboard(state);
            updateHudProgress(state);
            updateTurnIndicator(state);
            if (duel.status !== "playing") {
              endMatch(state);
            }
          });
        } else {
          state.busy = false;
          duel.currentTurn = state.myId; // rescue
          updateTurnIndicator(state);
        }
      }, botWord.length * 150 + 400);

    }, 1200 + Math.random() * 800);
  }

  // ---- Standard bot opponent (non-1v1 race mode) ----
  function startBotOpponent(state) {
    state.oppSim = Game.simulateOpponent({
      answer: state.match.answer,
      length: state.match.length,
      maxGuesses: state.match.maxGuesses,
      skill: state.opp.skill,
      speed: state.opp.speed
    }, function (guess, idx, om) {
      state.oppMatch = om; state.oppGuessCount = idx + 1;
      paintOpponentRow(state, idx, guess, om.evaluations[idx]);
      updateHudProgress(state);
    }, function (om) {
      state.oppDone = true; state.oppWon = (om.status === "won");
      updateHudProgress(state);
      if (state.cfg.ranked && state.match.status === "playing" && state.oppWon) {
        if (state.cfg.raceMode) { state.match.status = "lost"; endMatch(state); }
      }
    });
  }

  function paintOpponentRow(state, r, guess, ev) {
    if (!state.oppBoard) return;
    var tiles = state.oppBoard.rows[r]; if (!tiles) return;
    tiles.forEach(function (t, i) {
      setTimeout(function () { t.textContent = (guess[i] || "").toUpperCase(); t.classList.add("filled"); Audio.play("type"); }, i * 70);
    });
    setTimeout(function () {
      tiles.forEach(function (t, i) {
        setTimeout(function () { t.classList.add("flip", ev[i].state); t.classList.remove("filled"); }, i * 120);
      });
    }, guess.length * 70 + 250);
  }

  // ---- Standard Peer opponent (non-1v1 race mode) ----
  function startPeerOpponent(state) {
    var roomId = state.cfg.roomId;
    state._peerUnsub = Net.onMatchMsg("guess", function (msg) {
      if (msg.roomId !== roomId || msg.from !== (state.opp && state.opp.peerId)) return;
      if (!Number.isInteger(msg.seq) || msg.seq <= state.peerLastSeq) return;
      if (typeof msg.word !== "string" || !/^[a-z]+$/.test(msg.word) || msg.word.length !== state.match.length) return;
      state.peerLastSeq = msg.seq;
      var r = state.oppMatch ? state.oppMatch.guesses.length : 0;
      if (!state.oppMatch) state.oppMatch = Game.createMatch({ length: state.match.length, answer: state.match.answer, maxGuesses: state.match.maxGuesses, maxHints: 0 });
      var res = Game.submitGuess(state.oppMatch, msg.word);
      if (res.ok) paintOpponentRow(state, state.oppMatch.guesses.length - 1, msg.word, res.eval);
      if (res.status === "won") { state.oppDone = true; state.oppWon = true; }
      if (res.status === "lost") { state.oppDone = true; state.oppWon = false; }
      updateHudProgress(state);
    });
    state._peerLeave = Net.on("presence:leave", function (msg) {
      if (state.opp && state.opp.peerId === msg.from) showReconnect(state);
    });
  }

  // ---- Peer 1v1 Turn-Based Listener ----
  function startPeerDuelListener(state) {
    var roomId = state.cfg.roomId;
    state._peerUnsub = Net.onMatchMsg("guess", function (msg) {
      if (msg.roomId !== roomId || msg.from !== (state.opp && state.opp.peerId)) return;
      if (state.ended || state.busy) return;
      var duel = state.match;
      if (duel.currentTurn !== state.oppId) return;
      if (!Number.isInteger(msg.seq) || msg.seq <= state.peerLastSeq) return;
      if (typeof msg.word !== "string" || !/^[a-z]+$/.test(msg.word) || msg.word.length !== duel.length) return;
      state.peerLastSeq = msg.seq;

      state.busy = true;
      var rowIdx = duel.guesses.length;
      var word = msg.word.toLowerCase();
      var tiles = state.myBoard.rows[rowIdx];
      if (tiles) {
        tiles.forEach(function (t, i) {
          setTimeout(function () {
            t.textContent = word[i].toUpperCase();
            t.classList.add("filled");
            Audio.play("type");
          }, i * 150);
        });
      }

      setTimeout(function () {
        var res = Game.submitDuelGuess(duel, state.oppId, word);
        if (res.ok) {
          state.busy = false;
          animateRow(state, rowIdx, res.eval, function () {
            updateKeyboard(state);
            updateHudProgress(state);
            updateTurnIndicator(state);
            if (duel.status !== "playing") {
              endMatch(state);
            }
          });
        } else {
          state.busy = false;
        }
      }, word.length * 150 + 400);
    });

    state._peerLeave = Net.on("presence:leave", function (msg) {
      if (state.opp && state.opp.peerId === msg.from) showReconnect(state);
    });
  }

  function broadcastGuess(state, word) {
    if (state.peerSynced && state.cfg.roomId) {
      state.peerSendSeq++;
      Net.matchMsg(state.cfg.roomId, "guess", { word: word, seq: state.peerSendSeq });
    }
  }

  function showReconnect(state) {
    if (state.ended || state._reconnectVeil) return;
    var v = UI.el("div", { class: "rc-veil" }, [UI.el("div", { class: "loader-box" }, [
      UI.el("div", { class: "spinner" }),
      UI.el("div", { class: "lt", text: "OPPONENT DISCONNECTED" }),
      UI.el("div", { class: "ls", text: "Waiting for a verified reconnect. Leaving does not create a win." }),
      UI.button("RETURN HOME", { ghost: true, onclick: function () { v.remove(); state._reconnectVeil = null; exitMatch(state); } })
    ])]);
    state._reconnectVeil = v;
    document.getElementById("fx-layer").appendChild(v);
  }

  // ---- Team mechanics ----
  function teamComment(state, word) {
    var reactions = ["Good guess!", "Hmm, " + word.toUpperCase() + "?", "I trust the call.", "Risky one!", "Nice logic."];
    if (state.teammates && state.teammates.length) {
      var tm = state.teammates[Math.floor(Math.random() * state.teammates.length)];
      sendChat(state, reactions[Math.floor(Math.random() * reactions.length)], tm.name);
    }
    if (state.voteListEl) {
      UI.clear(state.voteListEl);
      var votes = Math.floor(Math.random() * state.teammates.length) + 1;
      state.voteListEl.appendChild(UI.el("div", { class: "vote-row" }, [UI.el("div", { class: "vword", text: word.toUpperCase() }), UI.el("div", { class: "vcount", text: votes + "/" + (state.teammates.length + 1) + " votes" })]));
    }
  }

  function sendChat(state, text, who) {
    who = who || Store.get().profile.name;
    state.chatLog.push({ who: who, text: text });
    if (state.chatLog.length > 50) state.chatLog.shift();
    renderChat(state);
    if (!who || who === Store.get().profile.name) Audio.play("click");
    if (state.peerSynced && state.cfg.roomId) Net.matchMsg(state.cfg.roomId, "chat", { who: who, text: text });
  }

  function renderChat(state) {
    if (!state.chatMsgsEl) return;
    UI.clear(state.chatMsgsEl);
    state.chatLog.forEach(function (m) {
      state.chatMsgsEl.appendChild(UI.el("div", { class: "chat-msg" + (m.sys ? " sys" : "") }, [m.sys ? UI.el("span", { text: m.text }) : [UI.el("span", { class: "who", text: m.who + ":" }), UI.el("span", { text: " " + m.text })]]));
    });
    state.chatMsgsEl.scrollTop = state.chatMsgsEl.scrollHeight;
  }

  // ---- End match ----
  function endMatch(state) {
    if (state.ended) return;
    state.ended = true;
    if (state.timerInt) clearInterval(state.timerInt);
    if (state.clockInt) clearInterval(state.clockInt);

    var isDuel = Game.isDuel(state.match);
    var playerWon, perfect, draw = false;
    var guesses = 0;

    if (isDuel) {
      playerWon = state.match.winner === state.myId;
      draw = state.match.winner === "draw";
      guesses = state.match.attempts[state.myId] || 0;
      perfect = playerWon && guesses === 1;
    } else {
      playerWon = state.match.status === "won";
      guesses = state.match.guesses.length;
      perfect = playerWon && guesses === 1;
    }

    finalizeMatch(state, playerWon, draw, guesses, perfect);
  }

  function finalizeMatch(state, playerWon, draw, guesses, perfect) {
    if (state.finalized) return;
    state.finalized = true;
    var isDuel = Game.isDuel(state.match);

    var eloDelta = 0;
    var eloBefore = null;
    var eloAfter = null;
    if (state.cfg.mode === "multiplayer" && state.opp && state.cfg.ranked) {
      // Ranked state is settled only by the verified server match RPC. The
      // client must never invent ELO or write a result-derived profile.
      eloBefore = Store.get().ranked.elo;
    }

    var xp = 0;
    if (isDuel && draw) {
      xp = 45;
    } else if (playerWon) {
      xp = state.cfg.ranked ? 120 : 80; if (perfect) { xp += 40; }
    } else {
      xp = 30;
    }
    if (state.cfg.mode === "daily" || state.cfg.subMode === "daily") { xp += 30; }
    Store.addXp(xp);

    Store.recordMatch({
      mode: state.cfg.subMode === "daily" ? "daily" : state.cfg.mode,
      subMode: state.cfg.subMode, word: state.match.answer, won: playerWon, guesses: guesses,
      perfect: perfect, type: state.cfg.mode === "multiplayer" ? "multi" : (state.cfg.mode === "teams" ? "team" : "casual"),
      eloDelta: eloDelta
    });

    // Ranked results are written by the server settlement RPC. Client-local
    // history is for the offline shell only and is never synced as a result.

    showResult(state, {
      won: playerWon, draw: draw, guesses: guesses, perfect: perfect,
      xp: xp, eloDelta: eloDelta, oppName: state.opp ? state.opp.name : null
    });

    if (isDuel) {
      updateTurnIndicator(state);
    }

    if (state.peerSynced && state.cfg.roomId) Net.matchMsg(state.cfg.roomId, "result", { seq: state.peerSendSeq + 1, status: state.match.status });

    if (draw) {
      Audio.play("lose");
    } else {
      Audio.play(playerWon ? "win" : "lose");
    }
    if (playerWon) { UI.confetti(state.cfg.victAnim === "va_fireworks" ? 140 : 90); UI.flash("rgba(244,206,123,0.4)"); }
  }

  function showResult(state, r) {
    var isDuel = Game.isDuel(state.match);
    var medalIcon = r.draw ? UI.ICON.star : (r.won ? UI.ICON.crown : UI.ICON.close);
    var titleText = r.draw ? "DRAW" : (r.won ? "VICTORY" : "DEFEAT");
    var titleCls = r.draw ? "draw" : (r.won ? "win" : "lose");
    var subText = r.draw ? "Neither player found the word!" : (r.won ? "You found the word!" : "Better luck next time");

    var guessLabel = isDuel ? (r.guesses + "/" + state.match.attemptLimits[state.myId]) : (r.guesses + "/" + state.match.maxGuesses);

    var card = UI.el("div", { class: "result-card " + (r.won ? "win" : "") }, [
      UI.el("div", { class: "result-medal", html: medalIcon }),
      UI.el("div", { class: "result-title " + titleCls, text: titleText }),
      UI.el("div", { class: "result-sub", text: subText }),
      UI.el("div", { class: "result-word", text: state.match.answer.toUpperCase() }),
      UI.el("div", { class: "result-stats" }, [
        statBlock("GUESSES", guessLabel, r.won ? "g" : (r.draw ? "draw" : "")),
        statBlock("XP", "+" + r.xp, "blue")
      ]),
      r.eloDelta ? UI.el("div", { class: "elo-delta " + (r.eloDelta >= 0 ? "up" : "down"), text: (r.eloDelta >= 0 ? "▲ +" : "▼ ") + Math.abs(r.eloDelta) + " ELO" }) : null,
      UI.el("div", { class: "result-actions" }, [
        (state.cfg && (state.cfg.mode === "daily" || state.cfg.subMode === "daily"))
          ? null
          : UI.button("PLAY AGAIN", { primary: true, onclick: function () {
              veil.remove();
              var cfg = state.cfg;
              if (state.cleanup) state.cleanup();
              if (state._peerUnsub) state._peerUnsub();
              UI.pop();
              setTimeout(function () {
                if (cfg.mode === "multiplayer" && global.PlayScreen && PlayScreen.showMatchmaking) {
                  PlayScreen.showMatchmaking(cfg);
                } else {
                  global.MatchScreen.open(cfg);
                }
              }, 280);
            } }),
        UI.button("HOME", { onclick: function () { veil.remove(); exitMatch(state); } })
      ])
    ]);
    var veil = UI.veil(card, { cls: "result-veil" });
    state._resultVeil = veil;
  }

  function statBlock(label, val, cls) {
    return UI.el("div", { class: "result-stat " + (cls || "") }, [UI.el("div", { class: "rsv", text: val }), UI.el("div", { class: "rsl", text: label })]);
  }

  function restart(state) {
    if (state._resultVeil) state._resultVeil.remove();
    if (state.cleanup) state.cleanup();
    UI.pop();
    setTimeout(function () { global.MatchScreen.open(state.cfg); }, 280);
  }

  function exitMatch(state) {
    var cfg = state.cfg || {};
    if (cfg.mode === "daily" || cfg.subMode === "daily") {
      Store.patch(function (s) { s.stats.dailyLockedDay = new Date().toDateString(); });
    }
    if (state.cleanup) state.cleanup();
    if (state._peerUnsub) state._peerUnsub();
    UI.popAll();
    if (global.App) App.refreshHome();
  }

  function confirmExit() {
    if (!stateRef) return;
    var isMulti = stateRef.cfg.mode === "multiplayer" && stateRef.opp;
    var isLive = stateRef && !stateRef.ended;
    if (isMulti && isLive) {
      UI.confirm("Forfeiting a multiplayer match will count as a loss and you will lose 30 ELO. Are you sure you want to leave?", function () {
        if (stateRef && !stateRef.ended) {
          if (Game.isDuel(stateRef.match)) {
            stateRef.match.winner = stateRef.oppId;
            stateRef.match.status = "lost";
          } else {
            stateRef.match.status = "lost";
          }
          endMatch(stateRef);
        }
      }, { title: "FORFEIT MATCH?", yesLabel: "LEAVE" });
    } else if (isLive) {
      var isDaily = stateRef.cfg.mode === "daily" || stateRef.cfg.subMode === "daily";
      UI.confirm(isDaily ? "Leaving now locks today's word — you can't play it again until tomorrow. Continue?" : "Leave this match? Your progress will be lost.", function () {
        if (stateRef) exitMatch(stateRef);
      }, { title: isDaily ? "LEAVE DAILY WORD?" : "LEAVE MATCH?", yesLabel: "LEAVE" });
    } else {
      exitMatch(stateRef);
    }
  }

  var stateRef = null;
  var originalOpen = open;
  function openWrap(cfg) { var st = originalOpen(cfg); stateRef = st; return st; }

  function modeTitle(cfg) {
    if (cfg.mode === "teams") return "TEAMS";
    if (cfg.mode === "multiplayer") return cfg.ranked ? "RANKED DUEL" : "CASUAL DUEL";
    if (cfg.subMode === "daily") return "DAILY WORD";
    if (cfg.subMode === "practice") return "PRACTICE";
    if (cfg.subMode === "unlimited") return "UNLIMITED";
    if (cfg.mode === "training") return "TRAINING";
    return "CLASSIC";
  }

  function modeSub(cfg) {
    if (cfg.opponent && !cfg.teams) {
      return (cfg.length + "-letter") + " · 7 chances · 4 & 3 · " + (cfg.ranked ? "RANKED" : "CASUAL");
    }
    return (cfg.length + "-letter") + " · " + (cfg.maxGuesses) + " guesses" + (cfg.ranked ? " · RANKED" : "");
  }

  function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  global.MatchScreen = { open: openWrap };
})(window);
