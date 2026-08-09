"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadStore() {
  const storage = new Map();
  const context = {
    window: {
      localStorage: {
        setItem(key, value) { storage.set(key, String(value)); },
        getItem(key) { return storage.has(key) ? storage.get(key) : null; },
        removeItem(key) { storage.delete(key); }
      }
    },
    Date,
    Math,
    Number,
    Object,
    JSON,
    setTimeout,
    clearTimeout,
    console
  };
  context.window.window = context.window;
  context.window.Data = {
    SEASON_MAX_TIER: 50,
    seasonTrack() { return Array.from({ length: 50 }, (_, index) => ({ xp: (index + 1) * 480 })); },
    ACHIEVEMENTS: []
  };
  context.Data = context.window.Data;
  context.window.Audio = { play() {} };
  context.Audio = context.window.Audio;
  context.window.Supabase = null;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "js", "store.js"), "utf8"), context);
  return context.window.Store;
}

test("local currency rejects invalid and negative mutations", () => {
  const Store = loadStore();
  const before = Store.get().currency.coins;
  assert.equal(Store.addCurrency("unknown", 10), false);
  assert.equal(Store.addCurrency("coins", -10), false);
  assert.equal(Store.spendCurrency("coins", -10), false);
  assert.equal(Store.get().currency.coins, before);
  assert.equal(Store.addCurrency("coins", 10), true);
  assert.equal(Store.get().currency.coins, before + 10);
});

test("local XP rejects invalid values", () => {
  const Store = loadStore();
  const before = Store.get().profile.totalXp;
  assert.equal(Store.addXp(0), false);
  assert.equal(Store.addXp(Number.NaN), false);
  assert.equal(Store.get().profile.totalXp, before);
  assert.equal(Store.addXp(10), undefined);
  assert.equal(Store.get().profile.totalXp, before + 10);
});

test("cloud snapshots do not discard local cosmetics or history", () => {
  const Store = loadStore();
  Store.patch((state) => {
    state.profile.skin = "theme_rose";
    state.history.push({ mode: "classic", word: "cigar" });
    state.currency.coins = 999;
  });
  Store.applyCloudSnapshot({
    authMethod: "email",
    profile: { name: "CLOUDUSER", level: 3, xp: 20, totalXp: 1020, avatar: "CU", team: "blue" },
    ranked: { elo: 1200, peakElo: 1200, season: 1 },
    stats: { wins: 4, losses: 1, matchesPlayed: 5 },
    currency: { coins: 120, gems: 8 },
    settings: { muted: true }
  });
  const state = Store.get();
  assert.equal(state.profile.name, "CLOUDUSER");
  assert.equal(state.ranked.elo, 1200);
  assert.equal(state.currency.coins, 120);
  assert.equal(state.profile.skin, "theme_rose");
  assert.equal(state.history.length, 1);
  assert.equal(state.settings.muted, true);
});
