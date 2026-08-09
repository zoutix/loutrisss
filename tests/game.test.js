"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadGame() {
  const context = {
    window: {},
    Math,
    Date,
    setTimeout,
    clearTimeout,
    console
  };
  context.window.window = context.window;
  context.window.Data = {
    ANSWERS: { 4: ["able", "bake", "cage", "cold", "deal", "dove"], 5: ["cigar", "arise", "cairn", "civic", "crown", "broom", "spear", "shame", "crane", "abide"], 6: ["planet"] },
    isValidGuess(word, length) { return !!(this.ANSWERS[length] || []).includes(word); },
    randomAnswer(length) { return this.ANSWERS[length][0]; },
    dailyWord(length) { return this.ANSWERS[length][0]; }
  };
  context.Data = context.window.Data;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8"), context);
  return context.window.Game;
}

test("evaluate handles duplicate letters with two passes", () => {
  const Game = loadGame();
  const result = Game.evaluate("civic", "cigar");
  assert.deepEqual(Array.from(result, (item) => item.state), ["correct", "correct", "absent", "absent", "absent"]);
});

test("hard mode requires present letters and moves them", () => {
  const Game = loadGame();
  const match = Game.createMatch({ length: 5, answer: "cigar", maxGuesses: 6, hardMode: true });
  assert.equal(Game.submitGuess(match, "arise").ok, true);
  assert.equal(Game.submitGuess(match, "civic").error, "Hard mode: reuse revealed letters");
  assert.equal(Game.submitGuess(match, "cairn").error, "Hard mode: move revealed letters");
});

test("hard mode keeps correct letters and rejects known absent letters", () => {
  const Game = loadGame();
  const match = Game.createMatch({ length: 5, answer: "cigar", maxGuesses: 6, hardMode: true });
  assert.equal(Game.submitGuess(match, "civic").ok, true);
  assert.equal(Game.submitGuess(match, "arise").error, "Hard mode: keep revealed letters");
});

test("duel alternates turns and rejects duplicate or out-of-turn submissions", () => {
  const Game = loadGame();
  const duel = Game.createDuel({ length: 5, answer: "cigar", starter: Game.P1 });
  assert.equal(duel.attemptLimits.p1, 4);
  assert.equal(duel.attemptLimits.p2, 3);
  assert.equal(Game.submitDuelGuess(duel, Game.P2, "arise").error, "Not your turn");
  assert.equal(Game.submitDuelGuess(duel, Game.P1, "arise").ok, true);
  assert.equal(duel.currentTurn, Game.P2);
  assert.equal(Game.submitDuelGuess(duel, Game.P2, "arise").error, "Already guessed");
  assert.equal(Game.rowOwner(duel, 0), Game.P1);
  assert.equal(Game.rowOwner(duel, 1), Game.P2);
  assert.equal(Game.rowOwner(duel, 6), Game.P1);
});

test("duel clock ends only the active player turn", () => {
  const Game = loadGame();
  const duel = Game.createDuel({ length: 5, answer: "cigar", starter: Game.P1, clockPerPlayer: 1 });
  assert.equal(Game.tickDuelClock(duel), Game.P1);
  assert.equal(duel.status, "lost");
  assert.equal(duel.winner, Game.P2);
});
