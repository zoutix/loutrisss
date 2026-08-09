/* =====================================================================
   LOUTRIS — js/battlepass.js
   Cloud Battle Pass client. Reads the active season + rewards + the
   player's own progress/claims from Supabase (RLS keeps progress/claims
   private), and moves money only via the server RPCs defined in
   supabase/schema.sql:
     - claim_battle_pass_reward(uuid)  atomic claim + reward grant
     - award_battle_pass_xp(text)      capped XP (daily 1200 / weekly 6000)
   The screen module (js/screens/battlepass.js) consumes this state.
   ===================================================================== */
(function (global) {
  "use strict";

  var cache = null;    // { season, progress, rewards, fetchedAt }
  var claimable = 0;   // count of currently claimable rewards (nav badge)
  var lastFetched = 0;
  var inFlight = false;
  var pendingClaims = {}; // rewardId -> true while an RPC is in flight

  function ready() {
    return global.Supabase && Supabase.configured && Supabase.isReady() && Supabase.isAuthed();
  }

  function isSeasonActive(s) {
    var now = Date.now();
    return s && new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() > now;
  }

  // ---- merged state: { season, progress, rewards } or null ----
  function fetchState(cb) {
    if (!ready()) { if (cb) cb(null); return; }
    var db = Supabase.rawClient ? Supabase.rawClient() : null;
    if (!db) { if (cb) cb(null); return; }
    var now = new Date().toISOString();

    db.from("battle_pass_seasons")
      .select("*, battle_pass_rewards(*)")
      .lte("starts_at", now)
      .gt("ends_at", now)
      .order("starts_at", { ascending: false })
      .limit(1)
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) { if (cb) cb(null); return; }
        var season = res.data[0];
        var rewards = (season.battle_pass_rewards || []).slice().sort(function (a, b) {
          return a.level - b.level || (a.track === "FREE" ? -1 : 1);
        });

        db.from("battle_pass_progress")
          .select("*")
          .eq("season_id", season.id)
          .maybeSingle()
          .then(function (p) {
            if (p.error) { if (cb) cb(null); return; }
            db.from("battle_pass_claims")
              .select("reward_id")
              .then(function (c) {
                if (c.error) { if (cb) cb(null); return; }
                var claimed = {};
                (c.data || []).forEach(function (r) { claimed[r.reward_id] = true; });
                var progress = p.data || { xp: 0, premium_owned: false };
                var state = {
                  season: {
                    id: season.id,
                    slug: season.slug,
                    name: season.name,
                    starts_at: season.starts_at,
                    ends_at: season.ends_at,
                    max_level: season.max_level,
                    xp_per_level: season.xp_per_level,
                    premium_price_cents: season.premium_price_cents
                  },
                  progress: {
                    xp: progress.xp || 0,
                    premium_owned: !!progress.premium_owned,
                    claimed: claimed
                  },
                  rewards: rewards.map(function (r) {
                    return {
                      id: r.id,
                      level: r.level,
                      track: r.track,
                      type: r.type,
                      item_key: r.item_key,
                      display_name: r.display_name,
                      description: r.description,
                      amount: r.amount,
                      claimed: !!claimed[r.id]
                    };
                  })
                };
                cache = state;
                cache.fetchedAt = Date.now();
                lastFetched = Date.now();
                claimable = countClaimable(state);
                if (cb) cb(state);
              });
          });
      })
      .catch(function () { if (cb) cb(null); });
  }

  function countClaimable(s) {
    if (!s || !isSeasonActive(s.season)) return 0;
    var level = levelFromXp(s);
    return s.rewards.filter(function (r) {
      return !r.claimed && r.level <= level && (r.track === "FREE" || s.progress.premium_owned);
    }).length;
  }

  function levelFromXp(s) {
    if (!s) return 1;
    var per = s.season.xp_per_level || 1000;
    return Math.min(s.season.max_level || 40, Math.floor(Math.max(0, s.progress.xp) / per) + 1);
  }

  function getCached() { return cache; }
  function getClaimable() { return claimable; }

  // Refresh the cache (idempotent, throttled). cb(null) when offline.
  function refresh(cb) {
    if (!ready()) { if (cb) cb(null); return; }
    if (inFlight) { if (cb) cb(cache); return; }
    inFlight = true;
    fetchState(function (s) {
      inFlight = false;
      if (cb) cb(s);
    });
  }

  // ---- next season regardless of live state (screen teaser) ----
  function fetchTeaser(cb) {
    if (!ready()) { if (cb) cb(null); return; }
    var db = Supabase.rawClient ? Supabase.rawClient() : null;
    if (!db) { if (cb) cb(null); return; }
    db.from("battle_pass_seasons")
      .select("id, slug, name, starts_at, ends_at, max_level, xp_per_level, premium_price_cents")
      .order("starts_at", { ascending: false })
      .limit(1)
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) { if (cb) cb(null); return; }
        if (cb) cb(res.data[0]);
      })
      .catch(function () { if (cb) cb(null); });
  }

  // ---- claim one reward (server-validated) ----
  // cb({ok, already, error, reward, type, item_key, amount})
  function claim(rewardId, cb) {
    if (pendingClaims[rewardId]) { if (cb) cb({ ok: false, error: "PENDING" }); return; }
    if (!ready()) { if (cb) cb({ ok: false, error: "OFFLINE" }); return; }
    pendingClaims[rewardId] = true;
    Supabase.rpc("claim_battle_pass_reward", { p_reward_id: rewardId }, function (res) {
      delete pendingClaims[rewardId];
      if (res.error || !res.data) {
        if (cb) cb({ ok: false, error: (res.error && res.error.code) || "CLAIM_FAILED" });
        return;
      }
      var d = res.data;
      if (d.ok && !d.already) {
        // mirror the server grant into the local state blob so the synced
        // profiles row (coins / inventory) never gets overwritten stale.
        if (d.type === "COINS" && d.amount) {
          Store.addCurrency("coins", d.amount);
        } else if (d.item_key) {
          Store.patch(function (st) { st.inventory.owned[d.item_key] = true; });
        }
      }
      if (cache) {
        var rw = cache.rewards.filter(function (r) { return r.id === rewardId; })[0];
        if (rw) rw.claimed = true;
        claimable = countClaimable(cache);
      }
      if (cb) cb({ ok: !!d.ok, already: !!d.already, error: d.error, reward: d.reward, type: d.type, item_key: d.item_key, amount: d.amount });
    });
  }

  // Match XP is awarded inside the server settlement transaction. The
  // browser cannot mint action IDs or call the internal award function.
  function awardMatchXp() {}

  function onAwarded(data) {
    if (cache && data.awarded > 0) {
      var before = levelFromXp(cache);
      cache.progress.xp = data.xp;
      var after = levelFromXp(cache);
      claimable = countClaimable(cache);
      if (global.UI && global.Audio) {
        if (after > before) {
          Audio.play("levelUp");
          UI.toast("BATTLE PASS LEVEL " + after, "gold");
        } else if (data.awarded >= 50) {
          Audio.play("reward");
          UI.toast("+" + data.awarded + " PASS XP", "info");
        }
      }
    }
  }

  global.BattlePass = {
    ready: ready,
    fetchState: fetchState,
    fetchTeaser: fetchTeaser,
    refresh: refresh,
    getCached: getCached,
    getClaimable: getClaimable,
    claim: claim,
    awardMatchXp: awardMatchXp,
    levelFromXp: levelFromXp,
    isSeasonActive: isSeasonActive
  };
})(window);
