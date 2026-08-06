/* =====================================================================
   LOUTRIS — js/net.js
   Networking/presence layer. Uses BroadcastChannel for genuine cross-tab
   play when available; falls back to bot opponents otherwise. Transport is
   abstracted so a real WebSocket server can be dropped in unchanged.
   ===================================================================== */
(function (global) {
  "use strict";

  var CHANNEL = "loutris_net_v1";
  var bc = null, bcOk = false, clientId = "c" + Math.random().toString(36).slice(2, 9);
  var handlers = {};
  var peers = {};       // clientId -> {name, elo, lastSeen}
  var rooms = {};       // roomId -> {id, host, members, config, password, spectators}
  var presenceTimer = null;

  try { bc = new BroadcastChannel(CHANNEL); bcOk = true; } catch (e) { bcOk = false; }
  if (bc) {
    bc.onmessage = function (e) { dispatch(e.data); };
  }

  function dispatch(msg) {
    if (!msg || msg.from === clientId) return;
    var arr = handlers[msg.type] || [];
    for (var i = 0; i < arr.length; i++) try { arr[i](msg); } catch (e) {}
  }
  function send(type, payload, to) {
    var msg = Object.assign({ type: type, from: clientId, t: Date.now() }, payload || {});
    if (to) msg.to = to;
    if (bc) { try { bc.postMessage(msg); } catch (e) {} }
    // also dispatch locally for single-tab tests? no — only remote.
  }
  function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); return function () { handlers[type] = (handlers[type] || []).filter(function (h) { return h !== fn; }); }; }
  function off(type, fn) {
    if (!handlers[type]) return;
    handlers[type] = handlers[type].filter(function (h) { return h !== fn; });
  }

  // ---- Presence ----
  function announce(profile) {
    send("presence", { profile: profile });
  }
  on("presence", function (msg) {
    peers[msg.from] = Object.assign({}, msg.profile, { lastSeen: Date.now() });
    if (global.Store && msg.profile && msg.profile.name) {
      Store.registerPlayer({ name: msg.profile.name, elo: msg.profile.elo, avatar: msg.profile.avatar, status: "online" });
    }
    // respond so the new peer learns about us
    if (global.Store) {
      var s = Store.get();
      send("presence:ack", { profile: { name: s.profile.name, elo: s.ranked.elo, avatar: s.profile.avatar } }, msg.from);
    }
  });
  on("presence:ack", function (msg) {
    if (msg.to === clientId) {
      peers[msg.from] = Object.assign({}, msg.profile, { lastSeen: Date.now() });
      if (global.Store && msg.profile && msg.profile.name) {
        Store.registerPlayer({ name: msg.profile.name, elo: msg.profile.elo, avatar: msg.profile.avatar, status: "online" });
      }
    }
  });
  on("presence:leave", function (msg) {
    var p = peers[msg.from];
    if (p && global.Store && p.name) {
      // mark as offline in registry but keep the entry
      try { Store.registerPlayer({ name: p.name, elo: p.elo, avatar: p.avatar, status: "offline" }); } catch (e) {}
    }
    delete peers[msg.from];
  });
  function startPresence() {
    var s = global.Store ? Store.get() : null;
    if (s) {
      announce({ name: s.profile.name, elo: s.ranked.elo, avatar: s.profile.avatar });
      Store.registerPlayer({ name: s.profile.name, elo: s.ranked.elo, avatar: s.profile.avatar, status: "online" });
    }
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = setInterval(function () {
      // prune stale peers (older than 8s)
      var now = Date.now();
      Object.keys(peers).forEach(function (id) { if (now - peers[id].lastSeen > 8000) delete peers[id]; });
      var cur = global.Store ? Store.get() : null;
      if (cur) {
        announce({ name: cur.profile.name, elo: cur.ranked.elo, avatar: cur.profile.avatar });
        Store.registerPlayer({ name: cur.profile.name, elo: cur.ranked.elo, avatar: cur.profile.avatar, status: "online" });
      }
    }, 4000);
    if (window.addEventListener) window.addEventListener("beforeunload", function () { send("presence:leave", {}); });
  }
  function onlineCount() { return Object.keys(peers).length + 1; }
  function peerList() { return Object.keys(peers).map(function (id) { return peers[id]; }); }

  // ---- Matchmaking ----
  // queue -> try to find a cross-tab peer within elo range; otherwise spawn a bot.
  function findMatch(opts, onMatch) {
    opts = opts || {};
    var s = Store.get();
    var myElo = s.ranked.elo;
    // look for an open match request from a peer
    var foundPeer = null;
    Object.keys(peers).forEach(function (id) {
      if (peers[id].seeking && Math.abs((peers[id].elo || 1500) - myElo) < 400 && !foundPeer) foundPeer = id;
    });
    if (bcOk && foundPeer) {
      // negotiate as joiner
      var roomId = "r" + Math.random().toString(36).slice(2, 8);
      send("match:propose", { to: foundPeer, roomId: roomId, mode: opts.mode, length: opts.length, ranked: opts.ranked, myName: s.profile.name, myElo: myElo });
      on("match:confirmed", function confirm(msg) {
        if (msg.to === clientId && msg.roomId === roomId) {
          off("match:confirmed", confirm);
          onMatch({ type: "pvp", opponent: { name: msg.oppName, elo: msg.oppElo, avatar: (msg.oppName || "?").slice(0, 2), isPeer: true, peerId: foundPeer }, roomId: roomId, host: false });
        }
      });
      // timeout -> bot
      setTimeout(function () { off("match:confirmed", confirm); }, 4000);
      return;
    }
    // broadcast seeking + wait briefly; if a proposal arrives, accept as host
    send("match:seeking", { elo: myElo, mode: opts.mode, length: opts.length });
    var propHandler = on("match:propose", function (msg) {
      if (msg.to === clientId) {
        off("match:propose", propHandler);
        send("match:confirmed", { to: msg.from, roomId: msg.roomId, oppName: s.profile.name, oppElo: myElo });
        onMatch({ type: "pvp", opponent: { name: msg.myName, elo: msg.myElo, avatar: (msg.myName || "?").slice(0, 2), isPeer: true, peerId: msg.from }, roomId: msg.roomId, host: true });
      }
    });
    // fallback: bot after short delay
    var wait = opts.queueTime || 2500;
    setTimeout(function () {
      off("match:propose", propHandler);
      send("match:stopseek", {});
      var bot = Data.botForElo(myElo + (Math.random() * 200 - 100));
      onMatch({ type: "bot", opponent: { name: bot.name, elo: bot.elo, avatar: bot.avatar, skill: bot.skill, speed: bot.speed }, roomId: null });
    }, wait);
  }
  on("match:seeking", function (msg) { /* store seeking flag on peer */ if (peers[msg.from]) peers[msg.from].seeking = true; });
  on("match:stopseek", function (msg) { if (peers[msg.from]) peers[msg.from].seeking = false; });

  // ---- Rooms (custom games / parties) ----
  function createRoom(config, onJoin) {
    var roomId = "r" + Math.random().toString(36).slice(2, 8);
    var s = Store.get();
    rooms[roomId] = { id: roomId, host: clientId, members: [clientId], config: config, password: config.password || null, spectators: [] };
    send("room:create", { room: { id: roomId, config: config, hostName: s.profile.name } });
    on("room:joinreq", function h(msg) {
      if (msg.roomId === roomId) {
        if (config.password && msg.password !== config.password) { send("room:reject", { to: msg.from, roomId: roomId, reason: "Wrong password" }); return; }
        rooms[roomId].members.push(msg.from);
        send("room:accept", { to: msg.from, roomId: roomId, members: rooms[roomId].members.length });
        onJoin && onJoin({ name: msg.name, elo: msg.elo, peerId: msg.from });
      }
    });
    return roomId;
  }
  function joinRoom(roomId, password, onAccept, onReject) {
    var s = Store.get();
    send("room:joinreq", { roomId: roomId, password: password, name: s.profile.name, elo: s.ranked.elo });
    var a = on("room:accept", function (msg) { if (msg.to === clientId && msg.roomId === roomId) { off("room:accept", a); off("room:reject", r); onAccept(msg); } });
    var r = on("room:reject", function (msg) { if (msg.to === clientId && msg.roomId === roomId) { off("room:accept", a); off("room:reject", r); onReject(msg); } });
    setTimeout(function () { off("room:accept", a); off("room:reject", r); onReject({ reason: "Timed out" }); }, 6000);
  }

  // ---- In-match messaging (guess sync for PvP, chat, votes) ----
  function matchMsg(roomId, type, payload, to) {
    send("match:" + type, Object.assign({ roomId: roomId }, payload || {}), to);
  }
  function onMatchMsg(type, fn) { return on("match:" + type, fn); }

  // ---- Chat (room/global) ----
  function chat(roomId, who, text) { send("chat", { roomId: roomId, who: who, text: text }); }
  on("chat", function (msg) { /* listeners via on('chat') */ });

  // ---- Friend requests (cross-tab) ----
  function _findPeerIdByName(name) {
    var n = (name || "").toUpperCase();
    var keys = Object.keys(peers);
    for (var i = 0; i < keys.length; i++) {
      if ((peers[keys[i]].name || "").toUpperCase() === n) return keys[i];
    }
    return null;
  }
  function sendFriendRequestCrossTab(targetName, fromName) {
    var targetId = _findPeerIdByName(targetName);
    if (targetId) send("friend:request", { targetName: targetName, fromName: fromName }, targetId);
  }
  function sendFriendAccept(toId, targetName) {
    send("friend:accept", { targetName: targetName }, toId);
  }
  function sendFriendReject(toId, targetName) {
    send("friend:reject", { targetName: targetName }, toId);
  }
  on("friend:request", function (msg) {
    if (!global.Store || (msg.to && msg.to !== clientId)) return;
    var s = Store.get();
    if ((s.profile.name || "").toUpperCase() === (msg.targetName || "").toUpperCase()) {
      Store.receiveFriendRequest(msg.from, msg.fromName, msg.targetName);
    }
  });
  on("friend:accept", function (msg) {
    if (!global.Store || (msg.to && msg.to !== clientId)) return;
    var targetName = (msg.targetName || "").toUpperCase();
    var idx = -1;
    var s = Store.get();
    for (var i = 0; i < s.friendOutgoing.length; i++) {
      if (s.friendOutgoing[i].name === targetName) { idx = i; break; }
    }
    if (idx === -1) return;
    var req = s.friendOutgoing[idx];
    Store.patch(function (st) {
      st.friendOutgoing.splice(idx, 1);
      if (!st.friends.some(function (f) { return f.name === req.name; })) {
        var reg = null;
        for (var j = 0; j < (st.registry || []).length; j++) if (st.registry[j].name === req.name) { reg = st.registry[j]; break; }
        var elo = reg ? reg.elo : 300;
        var avatar = reg ? reg.avatar : req.name.slice(0, 2);
        st.friends.push({ name: req.name, status: reg ? reg.status : "offline", elo: elo, avatar: avatar });
      }
    });
  });
  on("friend:reject", function (msg) {
    if (!global.Store || (msg.to && msg.to !== clientId)) return;
    var targetName = (msg.targetName || "").toUpperCase();
    var idx = -1;
    var s = Store.get();
    for (var i = 0; i < s.friendOutgoing.length; i++) {
      if (s.friendOutgoing[i].name === targetName) { idx = i; break; }
    }
    if (idx === -1) return;
    Store.patch(function (st) { st.friendOutgoing.splice(idx, 1); });
  });

  // ---- Invites ----
  function invite(peerName, roomId) { send("invite", { to: null, fromName: Store.get().profile.name, roomId: roomId, peerName: peerName }); }
  function onInvite(fn) { return on("invite", fn); }
  function acceptInvite(roomId, password, onAccept, onReject) { joinRoom(roomId, password, onAccept, onReject); }

  global.Net = {
    clientId: clientId, isLive: bcOk, peers: peers,
    on: on, send: send, startPresence: startPresence, onlineCount: onlineCount, peerList: peerList,
    findMatch: findMatch, createRoom: createRoom, joinRoom: joinRoom,
    matchMsg: matchMsg, onMatchMsg: onMatchMsg,
    chat: chat, invite: invite, onInvite: onInvite,
    sendFriendRequestCrossTab: sendFriendRequestCrossTab, sendFriendAccept: sendFriendAccept, sendFriendReject: sendFriendReject
  };
})(window);
