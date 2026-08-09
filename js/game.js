/* =====================================================================
   LOUTRIS — js/game.js
   Authoritative Wordle engine (pure logic) + bot AI + 1v1 turn/board helpers.
   Used by all match modes (classic, multiplayer, teams, ranked, training).
   ===================================================================== */
(function (global) {
  "use strict";

  // ---- 1v1 turn-based board helper ----
  // A 1v1 match shares ONE answer across two players who alternate turns.
  //   The first mover gets the extra attempt (starter: 4, other: 3),
  //   so whoever starts is always the player who makes the final guess.
  //   The board has 7 rows total: players alternate rows by turn.
  //   rows 0,2,4,6 belong to the starter; rows 1,3,5 to the other player.
  // The "first player" is selected randomly per match (bot duels) or
  // derived deterministically (peer duels: P1 = the host).
  // Turn order rotates strictly P1 -> P2 -> P1 -> P2 ... regardless of
  // which row physically gets filled next.
  var P1 = "p1"; var P2 = "p2";
  function createDuel(opts) {
    opts = opts || {};
    var len = opts.length || 5;
    // Asymmetric budgets: the first mover has the initiative, so the
    // starter gets 4 attempts and the other player gets 3 (7 chances
    // total). Keyed by player ID so both peers in a live duel always
    // agree on the limits.
    var attemptsStarter = opts.attemptsStarter != null ? opts.attemptsStarter : 4;
    var attemptsOther = opts.attemptsOther != null ? opts.attemptsOther : 3;
    // Chess-clock: each player gets their own budget. Only counts down
    // during that player's turn. Default 3 minutes (180s) per player.
    var clockPerPlayer = opts.clockPerPlayer != null ? opts.clockPerPlayer : 90;
    var answer = opts.answer || (opts.daily ? Data.dailyWord(len) : Data.randomAnswer(len));
    // Randomly pick who goes first; P1 = local player, P2 = opponent.
    // For peer duels the starter is passed explicitly so both sides agree.
    var starter = opts.starter || (Math.random() < 0.5 ? P1 : P2);
    return {
      kind: "duel",
      length: len,
      attemptLimits: starter === P1 ? { p1: attemptsStarter, p2: attemptsOther } : { p1: attemptsOther, p2: attemptsStarter },
      maxRows: attemptsStarter + attemptsOther,
      answer: answer,
      starter: starter,
      // guesses[i] = { player, row, word, eval, status }
      // row is 0..6; player is P1 or P2
      guesses: [],
      keyStates: {},
      attempts: { p1: 0, p2: 0 },
      counts: { p1: 0, p2: 0 }, // cumulative guess counts (persist past end)
      currentTurn: starter,
      winner: null,            // P1 | P2 | "draw" | null
      status: "playing",       // playing | won | lost | draw
      startedAt: Date.now(),
      clockPerPlayer: clockPerPlayer,
      clocks: { p1: clockPerPlayer, p2: clockPerPlayer }
    };
  }

  function isDuel(match) { return match && match.kind === "duel"; }

  // Decrement the active player's clock by 1 second. Returns the player
  // whose clock ran out (or null). Only the current turn's clock ticks.
  function tickDuelClock(duel) {
    if (!isDuel(duel) || duel.status !== "playing") return null;
    var pid = duel.currentTurn;
    duel.clocks[pid] = Math.max(0, (duel.clocks[pid] || 0) - 1);
    if (duel.clocks[pid] <= 0) {
      duel.winner = (pid === P1) ? P2 : P1;
      duel.status = "lost";
      return pid;
    }
    return null;
  }

  // 0-indexed guess number -> which player's row to write to (alternating
  // starting from the chosen starter; the final row belongs to the starter).
  function rowOwner(duel, guessIndex) {
    if (!isDuel(duel)) return P1;
    return (duel.starter === P2)
      ? (((guessIndex % 2) === 0) ? P2 : P1)
      : (((guessIndex % 2) === 0) ? P1 : P2);
  }

  // Validate and submit a duel guess. Caller must check that it's that
  // player's turn and they still have attempts remaining.
  function submitDuelGuess(duel, playerId, word) {
    if (!isDuel(duel)) return { ok: false, error: "Not a duel match" };
    if (duel.status !== "playing") return { ok: false, error: "Match ended" };
    if (duel.currentTurn !== playerId) return { ok: false, error: "Not your turn" };
    if ((duel.attempts[playerId] || 0) >= duel.attemptLimits[playerId]) return { ok: false, error: "No attempts left" };
    word = (word || "").toLowerCase().trim();
    if (word.length !== duel.length) return { ok: false, error: "Wrong length" };
    if (!/^[a-z]+$/.test(word)) return { ok: false, error: "Letters only" };
    // No duplicate guesses overall, just like Wordle.
    for (var i = 0; i < duel.guesses.length; i++) if (duel.guesses[i].word === word) return { ok: false, error: "Already guessed" };
    if (!Data.isValidGuess(word, duel.length)) return { ok: false, error: "Not in word list" };

    var ev = evaluate(word, duel.answer);
    duel.guesses.push({
      player: playerId,
      row: duel.guesses.length,  // physical board row index
      word: word,
      eval: ev
    });
    duel.attempts[playerId] = (duel.attempts[playerId] || 0) + 1;
    duel.counts[playerId] = (duel.counts[playerId] || 0) + 1;

    for (var k = 0; k < ev.length; k++) {
      var ch = ev[k].letter, st = ev[k].state;
      var rank = { correct: 3, present: 2, absent: 1 }[st];
      if (!duel.keyStates[ch] || rank > duel.keyStates[ch].rank) duel.keyStates[ch] = { state: st, rank: rank };
    }

    // Win condition: first to solve the word wins.
    if (word === duel.answer) {
      duel.winner = playerId;
      duel.status = "won";
    } else if (
      duel.attempts.p1 >= duel.attemptLimits.p1 &&
      duel.attempts.p2 >= duel.attemptLimits.p2
    ) {
      // Both players have used all their attempts without solving.
      duel.winner = "draw";
      duel.status = "draw";
    } else {
      // Advance to the other player's turn — but skip past a player who
      // has no attempts left, so the other can finish their budget
      // (starter: 4, other: 3 — the extra chance belongs to the first mover).
      var next = (playerId === P1) ? P2 : P1;
      duel.currentTurn = ((duel.attempts[next] || 0) < duel.attemptLimits[next]) ? next : playerId;
    }
    return { ok: true, eval: ev, status: duel.status, winner: duel.winner };
  }

  // Evaluate a guess against the answer. Returns array of {letter, state}
  // states: "correct" | "present" | "absent"
  // Implements proper duplicate-letter handling (two-pass).
  function evaluate(guess, answer) {
    guess = guess.toLowerCase(); answer = answer.toLowerCase();
    var n = answer.length;
    var res = new Array(n);
    var counts = {};
    for (var i = 0; i < n; i++) { counts[answer[i]] = (counts[answer[i]] || 0) + 1; }
    // pass 1: correct
    for (var j = 0; j < n; j++) {
      if (guess[j] === answer[j]) { res[j] = { letter: guess[j], state: "correct" }; counts[guess[j]]--; }
    }
    // pass 2: present/absent
    for (var k = 0; k < n; k++) {
      if (res[k]) continue;
      var ch = guess[k];
      if (counts[ch] > 0) { res[k] = { letter: ch, state: "present" }; counts[ch]--; }
      else { res[k] = { letter: ch, state: "absent" }; }
    }
    return res;
  }

  // Create a new match state (authoritative).
  function createMatch(cfg) {
    cfg = cfg || {};
    var len = cfg.length || 5;
    var maxGuesses = cfg.maxGuesses || 6;
    var answer = cfg.answer || (cfg.daily ? Data.dailyWord(len) : Data.randomAnswer(len));
    return {
      length: len,
      maxGuesses: maxGuesses,
      answer: answer,
      guesses: [],          // array of words
      evaluations: [],      // array of eval arrays
      keyStates: {},        // letter -> worst state
      status: "playing",    // playing | won | lost
      hardMode: !!cfg.hardMode,
      hintsUsed: 0,
      maxHints: cfg.maxHints != null ? cfg.maxHints : 1,
      timeLimit: cfg.timeLimit || 0,
      startedAt: Date.now(),
      hints: []             // revealed positions
    };
  }

  // Validate + submit a guess. Returns {ok, eval, status, error}
  function submitGuess(match, word) {
    if (match.status !== "playing") return { ok: false, error: "Match ended" };
    word = (word || "").toLowerCase().trim();
    if (word.length !== match.length) return { ok: false, error: "Wrong length" };
    if (!/^[a-z]+$/.test(word)) return { ok: false, error: "Letters only" };
    if (match.guesses.indexOf(word) !== -1) return { ok: false, error: "Already guessed" };
    if (!Data.isValidGuess(word, match.length)) return { ok: false, error: "Not in word list" };
    if (match.hardMode && match.guesses.length) {
      var fixed = {}, forbidden = {}, minimum = {};
      match.evaluations.forEach(function (ev) {
        ev.forEach(function (clue, i) {
          var letter = clue.letter;
          if (clue.state === "correct") fixed[i] = letter;
          if (clue.state === "present") {
            forbidden[letter] = forbidden[letter] || {};
            forbidden[letter][i] = true;
          }
          if (clue.state === "correct" || clue.state === "present") minimum[letter] = (minimum[letter] || 0) + 1;
        });
      });
      for (var position = 0; position < word.length; position++) {
        if (fixed[position] && word[position] !== fixed[position]) return { ok: false, error: "Hard mode: keep revealed letters" };
        if (forbidden[word[position]] && forbidden[word[position]][position]) return { ok: false, error: "Hard mode: move revealed letters" };
      }
      var counts = {};
      for (var c = 0; c < word.length; c++) counts[word[c]] = (counts[word[c]] || 0) + 1;
      for (var required in minimum) if ((counts[required] || 0) < minimum[required]) return { ok: false, error: "Hard mode: reuse revealed letters" };
      for (var previous in match.keyStates) if (!minimum[previous] && match.keyStates[previous].state === "absent" && counts[previous]) return { ok: false, error: "Hard mode: remove absent letters" };
    }
    var ev = evaluate(word, match.answer);
    match.guesses.push(word);
    match.evaluations.push(ev);
    // update key states (correct > present > absent)
    for (var k = 0; k < ev.length; k++) {
      var ch = ev[k].letter, st = ev[k].state;
      var rank = { correct: 3, present: 2, absent: 1 }[st];
      if (!match.keyStates[ch] || rank > match.keyStates[ch].rank) match.keyStates[ch] = { state: st, rank: rank };
    }
    if (word === match.answer) match.status = "won";
    else if (match.guesses.length >= match.maxGuesses) match.status = "lost";
    return { ok: true, eval: ev, status: match.status };
  }

  // Reveal a hint: pick an unrevealed position, return its letter+position.
  function useHint(match) {
    if (match.hintsUsed >= match.maxHints) return null;
    if (match.status !== "playing") return null;
    var revealed = {};
    match.hints.forEach(function (h) { revealed[h.pos] = true; });
    // also positions already correct in any guess
    match.evaluations.forEach(function (ev) { ev.forEach(function (c, i) { if (c.state === "correct") revealed[i] = true; }); });
    var candidates = [];
    for (var i = 0; i < match.answer.length; i++) if (!revealed[i]) candidates.push(i);
    if (!candidates.length) return null;
    var pos = candidates[Math.floor(Math.random() * candidates.length)];
    var h = { pos: pos, letter: match.answer[pos] };
    match.hints.push(h); match.hintsUsed++;
    return h;
  }

  // ---------- Bot AI ----------
  // Skill in [0,1]. Higher = guesses more optimally. Returns a guess word
  // consistent with current knowledge, occasionally near-optimal.
  function botGuess(match, skill, vocabulary) {
    var len = match.length;
    var pool = vocabulary || Data.ANSWERS[len] || Data.ANSWERS[5];
    var guesses = match.guesses;
    // Standard matches store evaluations separately; duels store them
    // inside each guess object as .eval — unify into an evals array.
    var evals = match.evaluations || guesses.map(function (g) { return g.eval || g; });
    // filter pool by consistency with all prior evaluations
    var consistent = pool.filter(function (w) {
      for (var g = 0; g < guesses.length; g++) {
        var ev = evals[g];
        for (var i = 0; i < len; i++) {
          if (ev[i].state === "correct" && w[i] !== ev[i].letter) return false;
          if (ev[i].state === "absent") {
            // absent means letter not in answer beyond accounted present/correct — approximate:
            // if this letter appears in answer (some present/correct elsewhere) it's allowed; else disallow
            var inAns = match.answer.indexOf(ev[i].letter) !== -1;
            if (!inAns && w.indexOf(ev[i].letter) !== -1) return false;
          }
          if (ev[i].state === "present") {
            if (w.indexOf(ev[i].letter) === -1) return false;
            if (w[i] === ev[i].letter) return false; // present means not at this pos
          }
        }
      }
      return true;
    });
    if (!consistent.length) consistent = pool;
    // with probability skill, the bot "knows" a strong word; pick a random consistent.
    // occasionally (1-skill) pick a deliberately weaker word to simulate mistakes.
    if (Math.random() > skill) {
      // random noisy guess from the full pool (a mistake)
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // small chance to guess the exact answer directly when few options remain (bluffing skill)
    if (consistent.length <= 2 + Math.floor(skill * 3) && Math.random() < 0.6 + skill * 0.4) {
      // pick the answer if it's in consistent (cheating a little for high skill)
      if (consistent.indexOf(match.answer) !== -1) return match.answer;
    }
    return consistent[Math.floor(Math.random() * consistent.length)];
  }

  // Simulate a full bot opponent asynchronously, emitting guesses over time.
  // cb(guessWord, guessIndex, isFinal)
  function simulateOpponent(opts, onUpdate, onDone) {
    var answer = opts.answer, len = answer.length, skill = opts.skill || 0.5, speed = opts.speed || 0.6;
    var maxGuesses = opts.maxGuesses || 6;
    var match = createMatch({ length: len, answer: answer, maxGuesses: maxGuesses, maxHints: 0 });
    var delays = [1200, 1800, 2200, 2600, 3000, 3400];
    function step() {
      if (match.status !== "playing") { onDone(match); return; }
      var g = botGuess(match, skill, opts.vocab);
      var r = submitGuess(match, g);
      onUpdate(g, match.guesses.length - 1, match);
      if (r.status === "won" || r.status === "lost") { onDone(match); return; }
      var d = delays[Math.min(match.guesses.length, delays.length - 1)] * (1.2 - speed);
      setTimeout(step, d + Math.random() * 400);
    }
    setTimeout(step, 900 + Math.random() * 600);
    return { match: match };
  }

  // Compute ELO delta (player vs opponent). k scaling.
  function eloDelta(playerElo, oppElo, won, k) {
    k = k || 32;
    var expected = 1 / (1 + Math.pow(10, (oppElo - playerElo) / 400));
    var score = won ? 1 : 0;
    return Math.round(k * (score - expected));
  }

  global.Game = {
    evaluate: evaluate, createMatch: createMatch, submitGuess: submitGuess, useHint: useHint,
    botGuess: botGuess, simulateOpponent: simulateOpponent, eloDelta: eloDelta,
    createDuel: createDuel, submitDuelGuess: submitDuelGuess, isDuel: isDuel, rowOwner: rowOwner, tickDuelClock: tickDuelClock,
    P1: P1, P2: P2
  };
})(window);
