/* =====================================================================
   LOUTRIS — js/screens/meta.js (part 1)
   Profile, Season Pass, Quests, Shop, Chests + shared helpers exposed
   on window._metaH for meta2.js.
   ===================================================================== */
(function (global) {
  "use strict";

  // ---- shared helpers (also used by meta2.js) ----
  function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function timeAgo(ts) { var d = (Date.now() - ts) / 1000; if (d < 60) return "just now"; if (d < 3600) return Math.floor(d / 60) + "m ago"; if (d < 86400) return Math.floor(d / 3600) + "h ago"; return Math.floor(d / 86400) + "d ago"; }
  function fmtCountdown(ms) { if (ms <= 0) return "READY"; var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000); return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s; }
  function avatarNode(p, size) {
    var a = UI.el("div", { class: "pf-av", style: { width: size + "px", height: size + "px", flex: "none" } });
    a.appendChild(UI.el("div", { class: "in", style: { "font-size": (size * 0.35) + "px" }, text: p.avatar }));
    return a;
  }
  function pill(label, val) { return UI.el("div", { class: "pf-pill" }, [UI.el("span", { text: label + ": " }), UI.el("b", { text: String(val) })]); }
  function catKey(cat) { return { Themes: "theme", "Tile Skins": "tile", Keyboards: "kbd", Frames: "frame", Emotes: "emote", "Victory Animations": "va" }[cat]; }
  function findItem(id) { var all = Data.allShopItems(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function isEquipped(s, id) {
    var item = findItem(id); if (!item) return false;
    var eq = s.inventory.equipped[item.cat];
    if (item.cat === "themes") eq = s.profile.skin;
    if (item.cat === "tiles") eq = s.profile.tileSkin;
    if (item.cat === "keyboards") eq = s.profile.kbdSkin;
    if (item.cat === "frames") eq = s.profile.frame;
    if (item.cat === "victanim") eq = s.profile.victAnim;
    return eq === id;
  }
  function equipItem(s, id) {
    var item = findItem(id); if (!item) return;
    Store.patch(function (st) {
      if (item.cat === "themes") st.profile.skin = id;
      else if (item.cat === "tiles") st.profile.tileSkin = id;
      else if (item.cat === "keyboards") st.profile.kbdSkin = id;
      else if (item.cat === "frames") st.profile.frame = id;
      else if (item.cat === "victanim") st.profile.victAnim = id;
      else st.inventory.equipped[item.cat] = id;
    });
    Audio.play("reward");
  }
  function chestSvg(rarity, size) {
     var colors = { golden: ["#C3DDFF", "#173A83", "#4E8FFF"], azure: ["#DCEAFF", "#244B93", "#6BA4FF"], royal: ["#B9C9FF", "#334D9C", "#799AFF"] };
    var c = colors[rarity] || colors.azure;
    return UI.el("div", { class: "chest-visual", style: { width: size + "px", height: size + "px", "pointer-events": "none" }, html: '<svg viewBox="0 0 48 48" fill="none"><defs><linearGradient id="g' + rarity + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="100" stop-color="' + c[1] + '"/></linearGradient><linearGradient id="l' + rarity + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="100" stop-color="' + c[2] + '"/></linearGradient></defs><rect x="6" y="16" width="36" height="26" rx="4" fill="url(#g' + rarity + ')" stroke="' + c[2] + '" stroke-width="1.5"/><path d="M6 24h36M24 16v26" stroke="' + c[1] + '" stroke-width="1.5"/><path d="M14 16c0-10 8-14 10-14s10 4 10 14" fill="url(#l' + rarity + ')" stroke="' + c[2] + '" stroke-width="1.5"/><circle cx="24" cy="29" r="4" fill="#FFF1C9" stroke="#C07A10" stroke-width="1"/><rect x="22" y="29" width="4" height="11" fill="#5A45D8"/></svg>' });
  }
  function claimQuest(id, q) {
    Store.patch(function (s) { s.quests.claimed[id] = true; });
    Store.addXp(q.xp);
    Audio.play("reward"); UI.toast("Quest complete: +" + q.xp + " XP", "gold");
    UI.pop(); setTimeout(quests, 280);
  }

  global._metaH = { escapeHtml: escapeHtml, timeAgo: timeAgo, fmtCountdown: fmtCountdown, avatarNode: avatarNode, pill: pill, catKey: catKey, findItem: findItem, isEquipped: isEquipped, equipItem: equipItem, chestSvg: chestSvg, claimQuest: claimQuest };
  global.MetaScreen = global.MetaScreen || {};

  // ============ PROFILE ============
  function profile() {
    var s = Store.get();
    var scr = UI.screen({ title: "PROFILE", sub: s.profile.name + " · " + s.profile.title });
    var hero = UI.el("div", { class: "gcard profile-hero" }, [
      avatarNode(s.profile, 120),
      UI.el("div", { style: { flex: "1" } }, [
        UI.el("div", { class: "pf-name", text: s.profile.name }),
        UI.el("div", { class: "pf-title", text: s.profile.title }),
        UI.el("div", { class: "pf-meta" }, [pill("LEVEL", s.profile.level), pill("ELO", s.ranked.elo), pill("WINS", s.stats.wins), pill("STREAK", s.stats.currentStreak)]),
        UI.el("div", { class: "xp-bar" }, [UI.el("div", { class: "bar-meta", style: { "margin-bottom": "4px" } }, [UI.el("span", { text: "Level XP" }), UI.el("span", { text: s.profile.xp + "/" + Store.levelNeed(s.profile.level) })]), UI.progressBar((s.profile.xp / Store.levelNeed(s.profile.level)) * 100)])
      ])
    ]);
    scr._body.appendChild(hero);
    // team allegiance + season record
    var myTeam = s.profile.team;
    var badges = Store.teamBadges(s);
    var curSeason = s.ranked.season || 1;
    var algClass = myTeam === "blue" ? "blue" : myTeam === "red" ? "red" : "";
    var algBlock = UI.el("div", { class: "allegiance" + (algClass ? " " + algClass : "") }, [
      UI.el("div", { class: "alg-crest", html: UI.ICON.shield }),
      UI.el("div", { class: "alg-info" }, [
        UI.el("div", { class: "alg-kicker", text: "YOUR ALLEGIANCE" }),
        UI.el("div", { class: "alg-name", text: myTeam === "blue" ? "BLUE TEAM" : myTeam === "red" ? "RED TEAM" : "NO TEAM" }),
        UI.el("div", { class: "alg-sub", text: myTeam ? "SEASON " + curSeason + " · ACTIVE" : "AWAITING DRAFT" })
      ])
    ]);
    scr._body.appendChild(UI.el("div", { style: { "margin-top": "16px" } }, [algBlock]));
    var champSeasons = {};
    badges.forEach(function (b) { champSeasons[b.season] = true; });
    var record = (s.profile.teamSeasons || []).map(function (t) {
      return { season: t.season, team: t.team, champ: !!champSeasons[t.season], cur: false };
    });
    if (myTeam) record.push({ season: curSeason, team: myTeam, champ: false, cur: true });
    record.sort(function (a, b) { return b.season - a.season; });
    var sWrap = UI.el("div", { class: "gcard season-record", style: { "margin-top": "14px" } });
    sWrap.appendChild(UI.el("div", { class: "gtitle", style: { "margin-bottom": "12px" }, text: "SEASON RECORD" }));
    if (record.length) {
      var rail = UI.el("div", { class: "srail" });
      record.forEach(function (r, i) {
        rail.appendChild(UI.el("div", { class: "snode" + (r.champ ? " champ" : "") + (i === record.length - 1 ? " last" : "") }, [
          UI.el("div", { class: "snode-dot " + (r.champ ? "gold" : r.team) }),
          UI.el("div", { class: "snode-body" }, [
            UI.el("div", { class: "snode-meta" }, [
              UI.el("span", { text: "SEASON " + r.season }),
              r.cur ? UI.el("span", { class: "snode-tag on", text: "ACTIVE" })
                : r.champ ? UI.el("span", { class: "snode-tag champ", html: UI.ICON.crown + "CHAMPION" })
                : null
            ]),
            UI.el("div", { class: "snode-team " + r.team, text: r.team === "blue" ? "BLUE TEAM" : "RED TEAM" })
          ])
        ]));
      });
      sWrap.appendChild(rail);
    } else {
      sWrap.appendChild(UI.el("div", { class: "empty", html: '<span class="e-ico">' + UI.ICON.shield + "</span>No seasons played yet." }));
    }
    scr._body.appendChild(sWrap);
    var tabRow = UI.el("div", { class: "tabs" });
    ["STATS", "ACHIEVEMENTS", "HISTORY", "WORDS"].forEach(function (t) {
      var tab = UI.el("div", { class: "tab" + (t === "STATS" ? " on" : ""), text: t, onclick: function () { $$(".tab", tabRow).forEach(function (x) { x.classList.remove("on"); }); tab.classList.add("on"); showTab(t); } });
      tabRow.appendChild(tab);
    });
    scr._body.appendChild(tabRow);
    var tabBody = UI.el("div", {});
    scr._body.appendChild(tabBody);
    function showTab(t) {
      UI.clear(tabBody);
      if (t === "STATS") tabBody.appendChild(statsTab(s));
      else if (t === "ACHIEVEMENTS") tabBody.appendChild(achievementsTab(s));
      else if (t === "HISTORY") tabBody.appendChild(historyTab(s));
      else if (t === "WORDS") tabBody.appendChild(wordsTab(s));
    }
    showTab("STATS"); UI.push(scr);
  }
  function statsTab(s) {
    var wr = s.stats.matchesPlayed ? ((s.stats.wins / s.stats.matchesPlayed) * 100).toFixed(1) : "0.0";
    var avg = s.stats.matchesPlayed ? (s.stats.totalGuesses / s.stats.matchesPlayed).toFixed(2) : "0.00";
    var grid = UI.el("div", { class: "grid cols-4" });
    [["Win Rate", wr + "%", "g"], ["Matches", s.stats.matchesPlayed, ""], ["Wins", s.stats.wins, "g"], ["Losses", s.stats.losses, ""],
     ["Current Streak", s.stats.currentStreak, "p"], ["Best Streak", s.stats.bestStreak, "b"], ["Perfect Solves", s.stats.perfectSolves, "g"], ["Avg Guesses", avg, ""],
     ["Multiplayer", s.stats.multiPlayed, "p"], ["Team Wins", s.stats.teamWins, "b"], ["Daily Solved", s.stats.dailySolved, "g"], ["Ranked Played", s.ranked.rankedPlayed, ""],
     ["Current ELO", s.ranked.elo, "g"], ["Peak ELO", s.ranked.peakElo, "b"], ["Level", s.profile.level, "p"]
    ].forEach(function (r) { grid.appendChild(UI.el("div", { class: "stat" }, [UI.el("div", { class: "s-lbl", text: r[0] }), UI.el("div", { class: "s-val " + r[2], text: String(r[1]) })])); });
    return grid;
  }
  function achievementsTab(s) {
    var grid = UI.el("div", { class: "ach-grid" });
    Data.ACHIEVEMENTS.forEach(function (a) {
      var unlocked = !!s.achievements[a.id];
      grid.appendChild(UI.el("div", { class: "ach" + (unlocked ? " unlocked" : "") }, [
        UI.el("div", { class: "a-ico", html: UI.ICON[a.icon] || UI.ICON.star }), UI.el("div", { class: "a-name", text: a.name }), UI.el("div", { class: "a-desc", text: a.desc }),
        unlocked ? UI.el("div", { class: "chip on", style: { "margin-top": "8px" }, text: "UNLOCKED" }) : UI.el("div", { class: "chip", style: { "margin-top": "8px", opacity: ".5" }, text: "LOCKED" })
      ]));
    });
    return grid;
  }
  function historyTab(s) {
    if (!s.history.length) return UI.el("div", { class: "empty", html: '<span class="e-ico">' + UI.ICON.doc + '</span>No matches yet. Play a game!' });
    var wrap = UI.el("div", {});
    s.history.forEach(function (h) {
      wrap.appendChild(UI.el("div", { class: "hist-row" }, [
        UI.el("div", { class: "hist-w " + h.result, text: h.result }),
        UI.el("div", { class: "hist-mode", text: (h.type ? h.type.toUpperCase() + " · " : "") + h.mode }),
        UI.el("div", { class: "hist-word", text: h.word.toUpperCase() }),
        UI.el("div", { class: "hist-when", text: timeAgo(h.when) + (h.eloDelta ? " · " + (h.eloDelta >= 0 ? "+" : "") + h.eloDelta + " ELO" : "") })
      ]));
    });
    return wrap;
  }
  function wordsTab(s) {
    var entries = Object.keys(s.stats.favoriteWords).map(function (w) { return [w, s.stats.favoriteWords[w]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 30);
    if (!entries.length) return UI.el("div", { class: "empty", html: '<span class="e-ico">' + UI.ICON.book + '</span>No favorite words yet.' });
    var grid = UI.el("div", { class: "grid cols-auto" });
    entries.forEach(function (e) { grid.appendChild(UI.el("div", { class: "gcard", style: { padding: "14px", "text-align": "center" } }, [UI.el("div", { style: { "font-family": "Barlow Semi Condensed,sans-serif", "font-weight": "700", "font-size": "22px", "letter-spacing": "3px", color: "var(--neon)" }, text: e[0].toUpperCase() }), UI.el("div", { class: "mute", style: { "margin-top": "6px" }, text: "Solved " + e[1] + "x" })])); });
    return grid;
  }
  function collectionTab(s) {
    var wrap = UI.el("div", {});
    ["Themes", "Tile Skins", "Keyboards", "Frames", "Emotes", "Victory Animations"].forEach(function (cat) {
      var key = catKey(cat);
      var owned = Object.keys(s.inventory.owned).filter(function (id) { return id.startsWith(key) && id !== key; });
      wrap.appendChild(UI.el("div", { class: "gtitle", style: { margin: "16px 0 8px" }, text: cat.toUpperCase() }));
      if (!owned.length) { wrap.appendChild(UI.el("div", { class: "mute", text: "None owned. Visit the shop." })); return; }
      var row = UI.el("div", { class: "flex wrap gap12" });
      owned.forEach(function (id) { var item = findItem(id); row.appendChild(UI.el("div", { class: "chip" + (isEquipped(s, id) ? " on" : ""), html: (item ? item.name : id) + (isEquipped(s, id) ? ' <span class="chip-ico">' + UI.ICON.check + '</span>' : ""), onclick: function () { equipItem(s, id); UI.toast("Equipped " + (item ? item.name : id), "success"); } })); });
      wrap.appendChild(row);
    });
    return wrap;
  }

  // ============ SEASON PASS ============
  function seasonPass() {
    var s = Store.get();
    var scr = UI.screen({ title: "SEASON PASS", sub: "Season " + s.ranked.season + " · Tier " + s.season.tier });
    var top = UI.el("div", { class: "gcard", style: { display: "flex", "align-items": "center", "gap": "18px", "margin-bottom": "16px" } }, [
      UI.el("div", { class: "tier-medal", text: String(s.season.tier) }),
      UI.el("div", { style: { flex: "1" } }, [
        UI.el("div", { class: "gtitle", html: "CROWN <span class='accent'>SEASON</span>" }),
        UI.el("div", { class: "bar-meta", style: { margin: "8px 0 4px" } }, [UI.el("span", { text: "Tier " + s.season.tier + " XP" }), UI.el("span", { text: s.season.xp + " XP" })]),
        UI.progressBar((s.season.xp % 480) / 480 * 100)
      ]),
      s.season.premium ? UI.el("div", { class: "chip gold on", html: '<span class="chip-ico">' + UI.ICON.check + '</span>PREMIUM ACTIVE' }) : UI.button("UNLOCK PREMIUM", { gold: true, onclick: buyPremium })
    ]);
    scr._body.appendChild(top);
    var track = Data.seasonTrack(), trackWrap = UI.el("div", { class: "track" });
    track.forEach(function (t) {
      var claimedF = !!s.season.claimedFree[t.tier], claimedP = !!s.season.claimedPrem[t.tier];
      var canClaimF = s.season.tier >= t.tier && !claimedF, canClaimP = s.season.premium && s.season.tier >= t.tier && !claimedP;
      var nodeCls = "tier-node" + (s.season.tier === t.tier ? " current" : (s.season.tier > t.tier ? " claimed" : (s.season.tier < t.tier ? " locked" : "")));
      trackWrap.appendChild(UI.el("div", { class: nodeCls }, [
        UI.el("div", { class: "tier-num", text: "TIER " + t.tier }),
        UI.el("div", { class: "tier-cols" }, [UI.el("div", { class: "tier-cell free" }, [UI.el("div", { class: "rn", text: "FREE" }), UI.el("div", { text: t.free.label })]), UI.el("div", { class: "tier-cell prem" }, [UI.el("div", { class: "rn", text: "PREMIUM" }), UI.el("div", { text: t.prem.label })])]),
        UI.el("div", { class: "flex gap8" }, [
          claimedF ? UI.el("button", { class: "claim-btn done", text: "CLAIMED" }) : canClaimF ? UI.el("button", { class: "claim-btn ready", text: "CLAIM FREE", onclick: function () { claimReward(t.tier, "free", t.free); } }) : UI.el("button", { class: "claim-btn locked", text: "FREE" }),
          claimedP ? UI.el("button", { class: "claim-btn done", text: "CLAIMED" }) : canClaimP ? UI.el("button", { class: "claim-btn ready", text: "CLAIM PREMIUM", onclick: function () { claimReward(t.tier, "prem", t.prem); } }) : UI.el("button", { class: "claim-btn locked", text: "PREMIUM" })
        ])
      ]));
    });
    scr._body.appendChild(trackWrap); UI.push(scr);
  }
  function claimReward(tier, kind, reward) {
    Store.patch(function (s) { if (kind === "free") s.season.claimedFree[tier] = true; else s.season.claimedPrem[tier] = true; });
    if (reward.kind === "coins") Store.addCurrency("coins", reward.amount);
    else if (reward.kind === "gems") Store.addCurrency("gems", reward.amount);
    else if (reward.kind === "prem") Store.addCurrency("prem", reward.amount);
    else if (reward.kind === "chest") Store.patch(function (s) { s.chests.push({ id: "c" + Date.now(), rarity: reward.rarity, readyAt: 0, opened: false }); });
    else if (reward.kind === "cosmetic" || reward.kind === "skin") Store.patch(function (s) { s.inventory.owned[reward.item] = true; });
    Audio.play("reward"); UI.confetti(40); UI.toast("Claimed: " + reward.label, "gold");
    UI.pop(); setTimeout(seasonPass, 280);
  }
  function buyPremium() {
    if (Store.get().currency.prem < 980) { UI.toast("Need 980 premium currency for Season Pass", "error"); return; }
    UI.confirm("Unlock Premium Season Pass for 980 Premium?", function () {
      if (!Store.spendCurrency("prem", 980)) { UI.toast("Not enough premium currency", "error"); return; }
      Store.patch(function (st) { st.season.premium = true; });
      UI.toast("Premium Season Pass unlocked!", "gold"); Audio.play("levelUp"); UI.pop(); setTimeout(seasonPass, 280);
    }, { title: "UNLOCK PREMIUM PASS?", yesLabel: "UNLOCK" });
  }

  // ============ QUESTS ============
  function quests() {
    ensureQuests(); var s = Store.get();
    var scr = UI.screen({ title: "QUESTS", sub: "Daily · Weekly · Monthly" });
    ["daily", "weekly", "monthly"].forEach(function (bucket) {
      scr._body.appendChild(UI.el("div", { class: "gtitle", style: { margin: "0 0 10px", "text-transform": "uppercase" }, text: bucket }));
      var defs = s.quests[bucket] || {}; var keys = Object.keys(defs);
      if (!keys.length) scr._body.appendChild(UI.el("div", { class: "mute", text: "No " + bucket + " quests." }));
      keys.forEach(function (id) {
        var q = defs[id]; var pct = Math.min(100, ((q.progress || 0) / q.goal) * 100);
        scr._body.appendChild(UI.el("div", { class: "quest-card" + (q.done ? " done" : "") }, [
          UI.el("div", { class: "q-head" }, [UI.el("div", {}, [UI.el("div", { class: "q-name", text: q.name }), UI.el("div", { class: "q-type " + bucket, text: bucket.toUpperCase() })]), UI.el("div", { class: "q-reward", text: "+" + q.xp + " XP" })]),
          UI.el("div", { class: "bar-meta", style: { margin: "8px 0 4px" } }, [UI.el("span", { text: (q.progress || 0) + "/" + q.goal }), UI.el("span", { text: q.done ? "COMPLETE" : "IN PROGRESS" })]),
          UI.progressBar(pct),
          q.done && !s.quests.claimed[id] ? UI.el("div", { class: "tc", style: { "margin-top": "10px" } }, [UI.button("CLAIM", { gold: true, sm: true, onclick: function () { claimQuest(id, q); } })]) : null,
          s.quests.claimed[id] ? UI.el("div", { class: "chip on", style: { "margin-top": "8px" }, html: '<span class="chip-ico">' + UI.ICON.check + '</span>CLAIMED' }) : null
        ]));
      });
    });
    UI.push(scr);
  }
  function ensureQuests() {
    Store.patch(function (s) {
      var today = new Date().toDateString(), now = Date.now(), templates = Data.questTemplates();
      if (s.quests.refreshedDaily !== today) { s.quests.daily = instantiate(templates.daily); s.quests.refreshedDaily = today; }
      if (!s.quests.refreshedWeekly || now - s.quests.refreshedWeekly > 7 * 864e5) { s.quests.weekly = instantiate(templates.weekly); s.quests.refreshedWeekly = now; }
      if (!s.quests.refreshedMonthly || now - s.quests.refreshedMonthly > 30 * 864e5) { s.quests.monthly = instantiate(templates.monthly); s.quests.refreshedMonthly = now; }
    });
  }
  function instantiate(arr) { var o = {}; arr.forEach(function (t) { o[t.id] = Object.assign({ progress: 0, done: false }, t); }); return o; }

  // ============ SHOP ============
  function shop() {
    var s = Store.get();
    var scr = UI.screen({ title: "SHOP", sub: "Cosmetics only — no pay-to-win" });
    [["themes", "Themes"], ["tiles", "Tile Skins"], ["keyboards", "Keyboards"], ["frames", "Avatar Frames"], ["emotes", "Emotes"], ["victanim", "Victory Animations"]].forEach(function (c) {
      scr._body.appendChild(UI.el("div", { class: "gtitle", style: { margin: "10px 0" }, text: c[1].toUpperCase() }));
      var grid = UI.el("div", { class: "shop-grid" });
      Data.SHOP[c[0]].forEach(function (item) { grid.appendChild(shopCard(item, s)); });
      scr._body.appendChild(grid);
    });
    UI.push(scr);
  }
  function shopCard(item, s) {
    var owned = !!s.inventory.owned[item.id] || item.price === 0;
    var equipped = isEquipped(s, item.id);
    var preview = UI.el("div", { class: "shop-preview" });
    if (item.swatches) { var sp = UI.el("div", { class: "theme-prev" }); item.swatches.forEach(function (col) { sp.appendChild(UI.el("div", { class: "sw", style: { background: col } })); }); preview.appendChild(sp); }
     else preview.appendChild(UI.el("div", { style: { "font-family": "Barlow Semi Condensed,sans-serif", "font-weight": "700", "font-size": "24px", color: "var(--gold-3)" }, text: item.name.split(" ")[0] }));
    return UI.el("div", { class: "shop-item" + (owned ? " owned" : "") + (equipped ? " equipped" : "") }, [
      preview, UI.el("div", { class: "shop-name", text: item.name }), UI.el("div", { class: "shop-desc", text: item.desc }),
      UI.el("div", { class: "shop-foot" }, [
        item.price === 0 ? UI.el("div", { class: "price", text: "FREE" }) : UI.priceTag(item.cur, item.price),
        owned ? (equipped ? UI.el("div", { class: "chip on", text: "EQUIPPED" }) : UI.button("EQUIP", { sm: true, onclick: function () { equipItem(s, item.id); UI.pop(); setTimeout(shop, 280); } })) : UI.button("BUY", { primary: true, sm: true, onclick: function () { buyItem(item); } })
      ])
    ]);
  }
  function buyItem(item) {
    if (Store.get().currency[item.cur] < item.price) { UI.toast("Not enough " + item.cur, "error"); Audio.play("error"); return; }
    UI.confirm("Buy " + item.name + " for " + item.price + " " + item.cur + "?", function () {
      if (!Store.spendCurrency(item.cur, item.price)) { UI.toast("Purchase failed", "error"); return; }
      Store.patch(function (st) { st.inventory.owned[item.id] = true; });
      Audio.play("coin"); UI.toast("Purchased " + item.name + "!", "gold"); UI.pop(); setTimeout(shop, 280);
    }, { title: "CONFIRM PURCHASE", yesLabel: "BUY" });
  }

  // ============ CHESTS ============
  function chests() {
    var s = Store.get();
    var scr = UI.screen({ title: "REWARD CHESTS", sub: "Open chests for coins, gems & cosmetics" });
    var grid = UI.el("div", { class: "grid cols-3" });
    s.chests.forEach(function (ch, idx) {
      var ready = ch.readyAt <= Date.now();
      grid.appendChild(UI.el("div", { class: "gcard", style: { "text-align": "center", padding: "20px" } }, [
        chestSvg(ch.rarity, 80),
        UI.el("div", { class: "gtitle", style: { "margin-top": "8px" }, text: ch.rarity.toUpperCase() + " CHEST" }),
         ready ? UI.button("OPEN", { gold: true, onclick: function () { openChest(idx); } }) : UI.el("div", { class: "timer", style: { color: "var(--neon)", "font-family": "IBM Plex Mono,monospace", "font-weight": "500", "margin-top": "8px" }, text: fmtCountdown(ch.readyAt - Date.now()) })
      ]));
    });
    scr._body.appendChild(grid);
    scr._body.appendChild(UI.el("div", { class: "gtitle", style: { margin: "20px 0 10px" }, text: "DUPLICATE PROTECTION" }));
    scr._body.appendChild(UI.el("div", { class: "mute", text: "Cosmetics you already own are converted into coins automatically." }));
    UI.push(scr);
    var intv = setInterval(function () {
      if (!UI.isTop(scr)) { clearInterval(intv); return; }
      $$(".timer", scr._body).forEach(function (t, i) {
        var ch = s.chests[i]; if (!ch) return; var left = ch.readyAt - Date.now();
        if (left <= 0) { UI.pop(); clearInterval(intv); setTimeout(chests, 200); return; }
        t.textContent = fmtCountdown(left);
      });
    }, 1000);
  }
  function openChest(idx) {
    var s = Store.get(), ch = s.chests[idx]; if (!ch || ch.readyAt > Date.now()) return;
    Audio.play("chestOpen");
    var veil = UI.el("div", { class: "chest-veil" });
    var stage = UI.el("div", { class: "chest-stage" }, [chestSvg(ch.rarity, 220), UI.el("div", { class: "ls", text: "Opening..." })]);
    veil.appendChild(stage); document.getElementById("fx-layer").appendChild(veil);
    var visual = stage.firstChild;
    setTimeout(function () { visual.classList.add("shake"); }, 600);
    setTimeout(function () {
      var reward = rollChest(ch.rarity, s);
      visual.classList.remove("shake"); visual.classList.add("burst"); UI.confetti(60);
      stage.appendChild(UI.el("div", { class: "chest-reward", html: reward.label + '<span class="amt">' + reward.amount + "</span>" }));
      if (reward.kind === "coins") Store.addCurrency("coins", reward.amount);
      else if (reward.kind === "gems") Store.addCurrency("gems", reward.amount);
      else if (reward.kind === "cosmetic") Store.patch(function (st) { st.inventory.owned[reward.item] = true; });
      Store.patch(function (st) { st.chests.splice(idx, 1); });
      Audio.play("reward");
      setTimeout(function () { veil.remove(); UI.pop(); setTimeout(chests, 300); }, 1800);
    }, 1400);
  }
  function rollChest(rarity, s) {
    var table = {
      golden: [{ kind: "coins", min: 300, max: 600 }, { kind: "gems", min: 10, max: 25 }, { kind: "cosmetic" }],
      azure: [{ kind: "coins", min: 150, max: 300 }, { kind: "gems", min: 5, max: 12 }],
      royal: [{ kind: "coins", min: 80, max: 180 }]
    };
    var t = table[rarity] || table.azure;
    var pick = t[Math.floor(Math.random() * t.length)];
    if (pick.kind === "cosmetic") {
      var all = Data.allShopItems().filter(function (i) { return i.cur === "gems" || i.cur === "prem"; });
      var unowned = all.filter(function (i) { return !s.inventory.owned[i.id]; });
      var item = unowned.length ? unowned[Math.floor(Math.random() * unowned.length)] : (all[Math.floor(Math.random() * all.length)] || { id: "mystery", name: "Mystery" });
      if (s.inventory.owned[item.id]) return { kind: "coins", amount: Math.floor(200 + Math.random() * 200), label: "Duplicate → Coins" };
      return { kind: "cosmetic", item: item.id, amount: 1, label: item.name };
    }
    var amt = Math.floor(pick.min + Math.random() * (pick.max - pick.min));
    return { kind: pick.kind, amount: amt, label: pick.kind === "coins" ? "Coins" : "Gems" };
  }

  // expose part-1 screens + collectionTab/statsTab for reuse
  global.MetaScreen.profile = profile;
  global.MetaScreen.seasonPass = seasonPass;
  global.MetaScreen.quests = quests;
  global.MetaScreen.shop = shop;
  global.MetaScreen.chests = chests;
  global.MetaScreen.ensureQuests = ensureQuests;
  global.MetaScreen._collectionTab = collectionTab;
  global.MetaScreen._statsTab = statsTab;
})(window);
