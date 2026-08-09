/* =====================================================================
   LOUTRIS — js/supabase.js
   Cloud persistence layer. The entire player state blob is synced to a
   single `profiles` row (jsonb) under an anonymous Supabase user, so a
   browser's save survives cache wipes and re-installs. localStorage stays
   the primary store and cache; Supabase is best-effort background sync.
   ===================================================================== */
(function (global) {
  "use strict";

  var cfg = global.LOUTRIS_SUPABASE || {};
  var configured = !!(
    cfg.url &&
    cfg.publishableKey &&
    global.supabase &&
    cfg.url.indexOf("PASTE") === -1
  );

  var sb = null;
  var userId = null;
  var state = configured ? "connecting" : "off"; // off | connecting | ready | error
  var dirty = false;
  var timer = null;
  var inited = false;
  var sessionListener = null;
  var lastError = null; // safe diagnostic code only

  function safeError(error, fallback) {
    var message = error && (error.code || error.message);
    var code = String(message || fallback || "CLOUD_ERROR").toUpperCase();
    if (code.indexOf("AUTH") !== -1 || code.indexOf("JWT") !== -1 || code.indexOf("SESSION") !== -1) return "AUTH_REQUIRED";
    if (code.indexOf("23505") !== -1 || code.indexOf("TAKEN") !== -1) return "CONFLICT";
    if (code.indexOf("NETWORK") !== -1 || code.indexOf("FETCH") !== -1) return "NETWORK_ERROR";
    return code.replace(/[^A-Z0-9_:-]/g, "_").slice(0, 64) || "CLOUD_ERROR";
  }

  function rpc(name, params, cb) {
    if (state !== "ready" || !sb || !userId) { if (cb) cb({ data: null, error: { code: "AUTH_REQUIRED" } }); return; }
    sb.rpc(name, params || {})
      .then(function (res) {
        if (res && res.error) lastError = safeError(res.error);
        if (cb) cb({ data: res && res.data, error: res && res.error ? { code: safeError(res.error) } : null });
      })
      .catch(function (error) {
        lastError = safeError(error);
        if (cb) cb({ data: null, error: { code: lastError } });
      });
  }

  function clearSessionState() {
    userId = null;
    dirty = false;
    if (timer) { clearTimeout(timer); timer = null; }
    pendingMatches.length = 0;
  }

  function flushPendingMatches() {
    while (pendingMatches.length && state === "ready" && sb) doRecordMatch(pendingMatches.shift());
  }

  function init(cb) {
    if (!configured) { state = "off"; if (cb) cb(null); return; }
    if (inited && state === "ready") { if (cb) cb(userId); return; }
    inited = true;
    state = "connecting";
    try {
      sb = global.supabase.createClient(cfg.url, cfg.publishableKey);
      sb.auth.getSession()
        .then(function (res) {
          var u = res && res.data && res.data.session && res.data.session.user;
          if (u) {
            userId = u.id;
            state = "ready";
            flushPendingMatches();
            if (dirty) schedule();
            if (cb) cb(userId);
          } else {
            clearSessionState();
            state = "ready";
            if (cb) cb(null);
          }
          if (!sessionListener && sb.auth.onAuthStateChange) {
            sessionListener = sb.auth.onAuthStateChange(function (event, session) {
              var next = session && session.user;
              if (!next || (userId && next.id !== userId)) clearSessionState();
              userId = next ? next.id : null;
              state = "ready";
            });
          }
        })
        .catch(function (error) { lastError = safeError(error, "SESSION_ERROR"); state = "error"; if (cb) cb(null); });
    } catch (e) {
      state = "error";
      if (cb) cb(null);
    }
  }

  // ---- email + password accounts (no guests) ----
  function signUp(email, password, cb) {
    if (state !== "ready" || !sb) { if (cb) cb({ ok: false, error: "Cloud not connected." }); return; }
    sb.auth.signUp({ email: email, password: password })
      .then(function (res) {
        if (res.error) { if (cb) cb({ ok: false, error: friendlyAuthError(res.error.message, "create") }); return; }
        var u = res.data && res.data.session && res.data.session.user;
        if (u) {
          userId = u.id;
          state = "ready";
          flushPendingMatches();
          if (dirty) schedule();
          if (cb) cb({ ok: true, needsConfirm: false });
        } else {
          // email confirmation is on — the user must click the link first
          if (cb) cb({ ok: true, needsConfirm: true, email: email });
        }
      })
      .catch(function () { if (cb) cb({ ok: false, error: "Could not reach the server." }); });
  }

  function signIn(email, password, cb) {
    if (state !== "ready" || !sb) { if (cb) cb({ ok: false, error: "Cloud not connected." }); return; }
    sb.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) { if (cb) cb({ ok: false, error: friendlyAuthError(res.error.message, "login") }); return; }
        var u = res.data && res.data.session && res.data.session.user;
        if (!u) { if (cb) cb({ ok: false, error: "Could not start a session." }); return; }
        userId = u.id;
        state = "ready";
        flushPendingMatches();
        if (dirty) schedule();
        if (cb) cb({ ok: true });
      })
      .catch(function () { if (cb) cb({ ok: false, error: "Could not reach the server." }); });
  }

  function signOut(cb) {
    clearSessionState();
    if (state !== "ready" || !sb) { if (cb) cb(); return; }
    sb.auth.signOut().then(function () { if (cb) cb(); }).catch(function () { if (cb) cb(); });
  }

  function isAuthed() { return !!userId; }

  function friendlyAuthError(msg, mode) {
    var m = String(msg || "").toLowerCase();
    if (m.indexOf("already registered") !== -1) return "That email is already registered — sign in instead.";
    if (m.indexOf("invalid login credentials") !== -1) return "Wrong email or password.";
    if (m.indexOf("not confirmed") !== -1) return "Email not confirmed yet — check your inbox.";
    if (m.indexOf("password") !== -1 && m.indexOf("length") !== -1) return "Password must be at least 6 characters.";
    return msg || "Something went wrong.";
  }

  // Pull only the cloud-owned snapshot. The answer, private match state,
  // wallet ledger, and authoritative progression never come from local data.
  function pull(cb) {
    if (state !== "ready" || !userId) { if (cb) cb(null); return; }
    sb.from("profiles")
      .select("id,username,display_name,avatar,country,team,elo,peak_elo,season_elo,season,wins,losses,draws,streak,best_streak,placement_done,xp,level,coins,gems,games_played,settings,updated_at")
      .eq("id", userId)
      .maybeSingle()
      .then(function (res) {
        if (res.error || !res.data) { if (cb) cb(null); return; }
        var row = res.data;
        if (cb) cb({
          _cloudSnapshot: true,
          _dbUpdatedAt: Date.parse(row.updated_at) || 0,
          authed: true,
          authMethod: "email",
          profile: { name: row.username || row.display_name || "PLAYER", avatar: row.avatar || "LX", country: row.country || null, team: row.team || null, level: row.level || 1, xp: row.xp || 0, totalXp: row.xp || 0 },
          ranked: { elo: row.elo || 0, peakElo: row.peak_elo || row.elo || 0, seasonElo: row.season_elo || row.elo || 0, season: row.season || 1, rankedPlayed: row.games_played || 0, rankedWins: row.wins || 0 },
          stats: { wins: row.wins || 0, losses: row.losses || 0, draws: row.draws || 0, currentStreak: row.streak || 0, bestStreak: row.best_streak || 0, matchesPlayed: row.games_played || 0 },
          currency: { coins: row.coins || 0, gems: row.gems || 0, prem: 0 },
          settings: row.settings || {}
        });
      })
      .catch(function () { if (cb) cb(null); });
  }

  // Save only non-authoritative profile fields. Never send the local state
  // blob or client-derived progression back to Supabase.
  function push(stateBlob, cb) {
    if (state !== "ready" || !userId || !stateBlob) { if (cb) cb(false); return; }
    var prof = stateBlob.profile || {};
    var settings = stateBlob.settings || {};
    rpc("save_profile_settings", {
      p_username: String(prof.name || "").toUpperCase() || null,
      p_display_name: String(prof.name || "") || null,
      p_avatar: String(prof.avatar || "LX"),
      p_country: prof.country || null,
      p_settings: settings
    }, function (res) { if (cb) cb(!res.error); });
  }

  // Debounced autosave: called on every store save. Changes made while
  // still connecting are queued and flushed once the client is ready.
  function markDirty() {
    if (state === "off" || state === "error") return;
    dirty = true;
    if (state !== "ready") return;
    schedule();
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(flushNow, 1500);
  }

  function flushNow() {
    timer = null;
    if (dirty && state === "ready" && global.Store) {
      dirty = false;
      push(global.Store.get());
    }
  }

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    flushNow();
  }

  function isReady() { return state === "ready"; }
  function getState() { return state; }

  // ---- leaderboards — REAL cloud data via public views ----
  // view: "global" | "peak" | "wins" | "xp" | "season" | "country"
  // opts: { country: "US" } to filter player views by country.
  var LB_ORDER = {
    global: "elo", peak: "peak_elo", wins: "wins", xp: "xp",
    season: "season_elo", country: "total_elo"
  };
  function leaderboard(view, opts, cb) {
    if (typeof opts === "function") { cb = opts; opts = {}; }
    if (!LB_ORDER[view]) view = "global";
    if (state !== "ready" || !sb) { if (cb) cb(null); return; }
    var q = sb.from("leaderboard_" + view).select("*");
    if (opts && opts.country) q = q.eq("country", opts.country);
    q.order(LB_ORDER[view], { ascending: false })
      .limit(100)
      .then(function (res) {
        if (res.error || !res.data) { if (cb) cb(null); return; }
        var rows = [];
        res.data.forEach(function (r, i) {
          if (view === "country") {
            rows.push({ country: r.country || "?", players: r.players || 0, totalElo: r.total_elo || 0, topElo: r.top_elo || 0, avgElo: r.avg_elo || 0, pos: i + 1, me: false });
          } else {
            rows.push({
              name: (r.name || "?").toUpperCase(),
              avatar: r.avatar || "LX",
              country: r.country || null,
              elo: r.elo || 0,
              peakElo: r.peak_elo || 0,
              wins: r.wins || 0,
              xp: r.xp || 0,
              seasonElo: r.season_elo || 0,
              pos: i + 1,
              me: false
            });
          }
        });
        if (cb) cb(rows);
      })
      .catch(function () { if (cb) cb(null); });
  }

  // ---- my own standing inside any leaderboard view ----
  var LB_MY_COL = { global: "elo", peak: "peak_elo", wins: "wins", xp: "xp", season: "season_elo" };
  function myStanding(view, cb) {
    if (typeof view === "function") { cb = view; view = "global"; }
    if (state !== "ready" || !userId || !sb) { if (cb) cb(null); return; }
    var col = LB_MY_COL[view];
    if (!col) { if (cb) cb(null); return; }
    var emit = function (r) {
      return { name: (r.name || "?").toUpperCase(), avatar: r.avatar || "LX", country: r.country || null, elo: r.elo || 0, peakElo: r.peak_elo || 0, wins: r.wins || 0, xp: r.xp || 0, seasonElo: r.season_elo || 0, pos: r.pos, me: true };
    };
    sb.from("leaderboard_" + view)
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(function (res) {
        if (res.error || !res.data) { if (cb) cb(null); return; }
        var r = res.data;
        sb.from("leaderboard_" + view)
          .select("id", { count: "exact", head: true })
          .gt(col, r[col])
          .then(function (c) {
            r.pos = (c && c.count != null) ? c.count + 1 : null;
            if (cb) cb(emit(r));
          })
          .catch(function () { r.pos = null; if (cb) cb(emit(r)); });
      })
      .catch(function () { if (cb) cb(null); });
  }

  // ---- username availability (public usernames view) ----
  function isNameTaken(name, cb) {
    if (state !== "ready" || !sb) { if (cb) cb(false); return; }
    var upper = String(name || "").toUpperCase();
    if (!upper) { if (cb) cb(false); return; }
    sb.from("usernames")
      .select("username")
      .eq("username", upper)
      .maybeSingle()
      .then(function (res) { if (cb) cb(!!(res && res.data && res.data.username)); })
      .catch(function () { if (cb) cb(false); });
  }

  // ---- find any player by exact username (for friend requests) ----
  // cb({id, username, avatar, country, elo, wins, peakElo}) or null if not found.
  function findPlayer(username, cb) {
    if (state !== "ready" || !sb) { if (cb) cb(null); return; }
    var upper = String(username || "").toUpperCase();
    if (!upper) { if (cb) cb(null); return; }
    sb.from("usernames")
      .select("id, username, avatar, country, elo, wins, peak_elo")
      .eq("username", upper)
      .maybeSingle()
      .then(function (res) {
        if (res.error || !res.data || !res.data.username) { if (cb) cb(null); return; }
        var d = res.data;
        if (cb) cb({
          id: d.id,
          username: d.username,
          avatar: d.avatar || d.username.slice(0, 2),
          country: d.country || null,
          elo: d.elo || 0,
          wins: d.wins || 0,
          peakElo: d.peak_elo || 0
        });
      })
      .catch(function () { if (cb) cb(null); });
  }

  // ---- cloud friend requests (visible to both accounts) ----
  // target = findPlayer() result. Writes a pending row both sides can read.
  function sendFriendRequestCloud(target, cb) {
    if (!target || !target.id) { if (cb) cb(false); return; }
    rpc("send_friend_request", { p_to_id: target.id }, function (res) { if (cb) cb(!!(res.data && res.data.ok) && !res.error); });
  }

  // All requests involving me: [{id, incoming, name, otherId, elo, avatar, status}]
  function listFriendRequests(cb) {
    if (state !== "ready" || !userId || !sb) { if (cb) cb(null); return; }
    sb.from("friend_requests")
      .select("*")
      .or("from_id.eq." + userId + ",to_id.eq." + userId)
      .then(function (res) {
        if (res.error || !res.data) { if (cb) cb(null); return; }
        var rows = [];
        res.data.forEach(function (r) {
          var incoming = r.to_id === userId;
          rows.push({
            id: r.id,
            incoming: incoming,
            name: incoming ? r.from_name : r.to_name,
            otherId: incoming ? r.from_id : r.to_id,
            elo: incoming ? (r.from_elo || 0) : (r.to_elo || 0),
            avatar: incoming ? (r.from_avatar || r.from_name.slice(0, 2)) : (r.to_avatar || r.to_name.slice(0, 2)),
            status: r.status
          });
        });
        if (cb) cb(rows);
      })
      .catch(function () { if (cb) cb(null); });
  }

  function respondFriendRequest(id, accept, cb) {
    rpc("respond_friend_request", { p_request_id: id, p_accept: !!accept }, function (res) { if (cb) cb(!!(res.data && res.data.ok) && !res.error); });
  }

  function deleteFriendRequest(id, cb) {
    rpc("delete_friend_request", { p_request_id: id }, function (res) { if (cb) cb(!!(res.data && res.data.ok) && !res.error); });
  }

  // ---- friends list → friends table (own rows) ----
  function syncFriends() {
    // Friends are server-owned and are changed only by friend-request RPCs.
  }

  // ---- owned cosmetics → inventory table (own rows) ----
  function syncInventory() {
    // Inventory is server-owned and is granted only by atomic reward RPCs.
  }

  // ---- Blue vs Red team war totals (public view) ----
  // cb({blue:{elo,count}, red:{elo,count}}) or null on error.
  function teamStats(cb) {
    if (state !== "ready" || !sb) { if (cb) cb(null); return; }
    sb.from("team_stats")
      .select("team, players, total_elo")
      .then(function (res) {
        if (res.error || !res.data) { if (cb) cb(null); return; }
        var out = { blue: { elo: 0, count: 0 }, red: { elo: 0, count: 0 } };
        res.data.forEach(function (r) {
          var t = r.team === "red" ? "red" : "blue";
          out[t].elo = r.total_elo || 0;
          out[t].count = r.players || 0;
        });
        if (cb) cb(out);
      })
      .catch(function () { if (cb) cb(null); });
  }

  // ---- match log ----
  var pendingMatches = [];
  function recordMatch(m) {
    if (state === "off" || state === "error" || !m) return;
    if (state !== "ready" || !sb) { pendingMatches.push(m); return; }
    doRecordMatch(m);
  }
  function doRecordMatch(m) {
    // Legacy client-authored match logs are intentionally not written. Ranked
    // settlement is performed atomically by submit_match_guess/forfeit_match.
    // Drop only this legacy item so it cannot block the queue indefinitely.
    if (pendingMatches.length) doRecordMatch(pendingMatches.shift());
  }

  // ---- auth provider detection: "google" or null (email/offline) ----
  function provider(cb) {
    if (state !== "ready" || !sb) { if (cb) cb(null); return; }
    sb.auth.getSession()
      .then(function (res) {
        var u = res && res.data && res.data.session && res.data.session.user;
        if (!u) { if (cb) cb(null); return; }
        var prov = (u.app_metadata && u.app_metadata.provider) || "";
        if (prov === "google") { if (cb) cb("google"); return; }
        var ids = u.identities || [];
        for (var i = 0; i < ids.length; i++) {
          if (ids[i].provider === "google") { if (cb) cb("google"); return; }
        }
        if (cb) cb(null);
      })
      .catch(function () { if (cb) cb(null); });
  }

  if (global.window && global.window.addEventListener) {
    global.window.addEventListener("beforeunload", flush);
  }

  global.Supabase = {
    init: init,
    pull: pull,
    push: push,
    markDirty: markDirty,
    flush: flush,
    isReady: isReady,
    getState: getState,
    configured: configured,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    isAuthed: isAuthed,
    leaderboard: leaderboard,
    myStanding: myStanding,
    teamStats: teamStats,
    recordMatch: recordMatch,
    isNameTaken: isNameTaken,
    findPlayer: findPlayer,
    sendFriendRequestCloud: sendFriendRequestCloud,
    listFriendRequests: listFriendRequests,
    respondFriendRequest: respondFriendRequest,
    deleteFriendRequest: deleteFriendRequest,
    syncFriends: syncFriends,
    syncInventory: syncInventory,
    provider: provider,
    rpc: rpc,
    rawClient: function () { return state === "ready" && sb && userId ? sb : null; },
    saveProfileSettings: function (profile, settings, cb) {
      profile = profile || {};
      rpc("save_profile_settings", {
        p_username: String(profile.name || "").toUpperCase() || null,
        p_display_name: String(profile.name || "") || null,
        p_avatar: String(profile.avatar || "LX"),
        p_country: profile.country || null,
        p_settings: settings || {}
      }, function (res) { if (cb) cb(!res.error, res); });
    },
    startRankedMatch: function (opponentId, length, cb) { rpc("start_ranked_match", { p_opponent: opponentId, p_length: length || 5 }, cb); },
    getMatchState: function (matchId, cb) { rpc("get_match_state", { p_match_id: matchId }, cb); },
    submitMatchGuess: function (matchId, actionId, word, cb) { rpc("submit_match_guess", { p_match_id: matchId, p_action_id: actionId, p_word: word }, cb); },
    forfeitMatch: function (matchId, actionId, cb) { rpc("forfeit_match", { p_match_id: matchId, p_action_id: actionId }, cb); },
    lastError: function () { return lastError; }
  };
})(window);
