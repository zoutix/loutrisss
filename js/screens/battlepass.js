/* =====================================================================
   LOUTRIS — js/screens/battlepass.js
   Battle Pass screen: season hero (level / days left / premium),
   progress bar, and the full 40-level reward grid with per-reward claim
   buttons. All money-moves go through BattlePass.claim() which calls the
   server RPC, so state here is just a mirror of cloud truth.
   ===================================================================== */
(function (global) {
  "use strict";

  var M = global.BattlePassScreen || (global.BattlePassScreen = {});

  var TYPE_META = {
    COINS: { icon: "✦", tone: "bp-amber", label: "COINS" },
    COSMETIC: { icon: "◈", tone: "bp-cyan", label: "COSMETIC" },
    TITLE: { icon: "✧", tone: "bp-violet", label: "TITLE" },
    BANNER: { icon: "▰", tone: "bp-sky", label: "BANNER" },
    EMOTE: { icon: "☻", tone: "bp-pink", label: "EMOTE" }
  };

  function open() {
    var scr = UI.screen({ title: "BATTLE PASS", sub: "Season One · Moonlit Isles" });
    UI.push(scr);
    var body = scr._body;
    body.appendChild(UI.el("div", { class: "center-stage", style: { padding: "60px 20px" } }, [
      UI.el("div", { class: "e-ico", html: UI.ICON.crown }),
      UI.el("div", { class: "mute", text: "Loading the pass…" })
    ]));

    BattlePass.refresh(function (s) {
      UI.clear(body);
      if (s) {
        renderBody(body, s);
        return;
      }
      if (BattlePass.ready()) {
        BattlePass.fetchTeaser(function (teaser) {
          UI.clear(body);
          if (teaser) renderTeaser(body, teaser);
          else paintMute(body, "NO ACTIVE SEASON", "A new battle pass will open soon. Keep playing.");
        });
      } else {
        paintMute(body, "OFFLINE", "Sign in and reconnect to open the Battle Pass.");
      }
    });
  }

  function paintMute(body, title, sub) {
    body.appendChild(UI.el("div", { class: "center-stage", style: { padding: "60px 20px" } }, [
      UI.el("div", { class: "e-ico", html: UI.ICON.crown }),
      UI.el("div", { class: "lt", text: title }),
      UI.el("div", { class: "ls", text: sub })
    ]));
  }

  // ---- season not live yet: countdown teaser ----
  function renderTeaser(body, s) {
    var ms = new Date(s.starts_at).getTime() - Date.now();
    var days = Math.max(0, Math.ceil(ms / 86400000));
    var hero = UI.el("div", { class: "gcard bp-hero bp-teaser" }, [
      UI.el("div", { class: "bp-kicker", html: '<span class="bp-dot"></span>SEASON ONE · ' + String(s.name).toUpperCase() }),
      UI.el("div", { class: "bp-title", text: "THE BATTLE PASS RETURNS" }),
      UI.el("div", { class: "bp-tag", text: s.name + " · 40 levels · two reward tracks. Match XP you earn counts the moment the season opens." }),
      UI.el("div", { class: "bp-teaser-count" }, [
        UI.el("div", { class: "bp-count-num", text: String(days) }),
        UI.el("div", { class: "bp-count-lbl", text: "DAYS UNTIL SEASON ONE" })
      ])
    ]);
    body.appendChild(hero);
    body.appendChild(UI.el("div", { class: "bp-note", text: "XP earned in matches before the season starts is banked when the pass goes live." }));
  }

  // ---- live season: hero + progress + reward grid ----
  function renderBody(body, s) {
    var season = s.season;
    var owned = !!s.progress.premium_owned;
    var per = season.xp_per_level || 1000;
    var maxLvl = season.max_level || 40;
    var level = BattlePass.levelFromXp(s);
    var cur = level >= maxLvl ? per : s.progress.xp % per;
    var pct = level >= maxLvl ? 100 : Math.round((cur / per) * 100);
    var daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000));
    var price = (season.premium_price_cents / 100).toFixed(2);

    var premiumCta = owned
      ? UI.el("div", { class: "chip gold on", html: '<span class="chip-ico">' + UI.ICON.check + '</span>PREMIUM ACTIVE' })
      : UI.button("$" + price + " · PREMIUM PASS", {
          gold: true, sm: true,
          onclick: function () { UI.toast("Premium purchases are coming soon.", "info"); Audio.play("click"); }
        });

    var hero = UI.el("div", { class: "gcard bp-hero" }, [
      UI.el("div", { class: "bp-kicker", html: '<span class="bp-dot"></span>SEASON ONE · ' + String(season.name).toUpperCase() }),
      UI.el("div", { class: "bp-hero-row" }, [
        UI.el("div", { class: "bp-hero-main" }, [
          UI.el("div", { class: "bp-title", text: season.name }),
          UI.el("div", { class: "bp-tag", text: "Chart the moonlit islands. Play matches, earn pass XP, unlock relics and Wordsmith cosmetics." })
        ]),
        UI.el("div", { class: "bp-stats" }, [
          UI.el("div", { class: "bp-stat" }, [
            UI.el("div", { class: "bp-stat-lbl", text: "YOUR LEVEL" }),
            UI.el("div", { class: "bp-stat-val", html: String(level) + '<span class="bp-stat-cap">/' + maxLvl + "</span>" })
          ]),
          UI.el("div", { class: "bp-stat" }, [
            UI.el("div", { class: "bp-stat-lbl", text: "SEASON ENDS" }),
            UI.el("div", { class: "bp-stat-val", html: String(daysLeft) + '<span class="bp-stat-cap"> DAYS</span>' })
          ]),
          UI.el("div", { class: "bp-stat bp-stat-prem" }, [
            UI.el("div", { class: "bp-stat-lbl", text: "PREMIUM" }),
            UI.el("div", { class: "bp-stat-val", html: owned ? 'OWNED<span class="bp-stat-cap"> PASS</span>' : "$" + price })
          ])
        ])
      ]),
      UI.el("div", { class: "bp-progress" }, [
        UI.el("div", { class: "bp-prog-meta" }, [
          UI.el("span", { class: "bp-prog-lbl", text: "LEVEL " + level + " PROGRESS" }),
          UI.el("span", { class: "bp-prog-xp", text: cur.toLocaleString() + " / " + per.toLocaleString() + " XP" })
        ]),
        UI.el("div", { class: "bar bp-bar" }, [UI.el("i", { style: { width: pct + "%" } })]),
        UI.el("div", { class: "bp-prog-foot" }, [
          UI.el("span", { text: s.progress.xp.toLocaleString() + " XP TOTAL" }),
          premiumCta
        ])
      ])
    ]);
    body.appendChild(hero);

    // ---- track headers ----
    body.appendChild(UI.el("div", { class: "bp-track-head" }, [
      UI.el("div", { class: "bp-th-level" }),
      UI.el("div", { class: "bp-th bp-th-free", html: "<b>FREE TRACK</b><span>Earned by every Wordsmith</span>" }),
      UI.el("div", { class: "bp-th bp-th-prem", html: "<b>PREMIUM TRACK</b><span>Exclusive seasonal relics</span>" })
    ]));

    // ---- reward grid ----
    var list = UI.el("div", { class: "bp-list" });
    for (var l = 1; l <= maxLvl; l++) {
      var free = findReward(s, l, "FREE");
      var prem = findReward(s, l, "PREMIUM");
      var row = UI.el("div", {
        class: "bp-row" + (l === level ? " current" : ""),
        title: free && free.description ? free.description : ""
      }, [
        UI.el("div", { class: "bp-level" }, [levelBadge(l, level)]),
        free ? rewardCard(s, free, level, owned) : UI.el("div", { class: "bp-card none" }),
        prem ? rewardCard(s, prem, level, owned) : UI.el("div", { class: "bp-card none" })
      ]);
      list.appendChild(row);
    }
    body.appendChild(list);
  }

  function findReward(s, level, track) {
    for (var i = 0; i < s.rewards.length; i++) {
      var r = s.rewards[i];
      if (r.level === level && r.track === track) return r;
    }
    return null;
  }

  function levelBadge(l, level) {
    var cls = "bp-lvl-badge";
    if (l === level) cls += " current";
    else if (l < level) cls += " passed";
    var badge = UI.el("div", { class: cls });
    badge.appendChild(UI.el("span", { text: l < level ? "✓" : String(l) }));
    return badge;
  }

  function rewardCard(s, rw, level, owned) {
    var meta = TYPE_META[rw.type] || TYPE_META.COSMETIC;
    var premium = rw.track === "PREMIUM";
    var unlocked = level >= rw.level;
    var claimable = unlocked && !rw.claimed && (!premium || owned);
    var locked = premium && !owned;

    var cls = "bp-card" + (premium ? " prem" : "") + (rw.claimed ? " claimed" : "") + (locked ? " locked" : "");
    var card = UI.el("div", { class: cls, title: rw.description || "" }, [
      UI.el("div", { class: "bp-art " + meta.tone }, [
        UI.el("div", { class: "bp-art-glyph", text: meta.icon }),
        UI.el("div", { class: "bp-art-lbl", text: meta.label }),
        premium ? UI.el("div", { class: "bp-prem-tag", html: UI.ICON.crown }) : null
      ]),
      UI.el("div", { class: "bp-card-body" }, [
        UI.el("div", { class: "bp-name", text: rw.display_name }),
        rw.amount != null
          ? UI.el("div", { class: "bp-amount", text: "×" + rw.amount.toLocaleString() })
          : null,
        cardFooter(s, rw, claimable, locked, unlocked, level)
      ])
    ]);
    return card;
  }

  function cardFooter(s, rw, claimable, locked, unlocked, level) {
    if (locked) {
      return UI.el("div", { class: "bp-status bp-status-prem", html: UI.ICON.crown + "PREMIUM PASS" });
    }
    if (rw.claimed) {
      return UI.el("div", { class: "bp-status ok", html: UI.ICON.check + "CLAIMED" });
    }
    if (claimable) {
      var btn = UI.button("CLAIM", {
        sm: true, gold: rw.track === "PREMIUM", primary: rw.track === "FREE",
        onclick: function () { doClaim(s, rw, btn); }
      });
      return btn;
    }
    return UI.el("div", { class: "bp-status muted", text: unlocked ? "AVAILABLE SOON" : "UNLOCKS AT " + rw.level });
  }

  function doClaim(s, rw, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "CLAIMING…";
    BattlePass.claim(rw.id, function (res) {
      if (!res.ok) {
        btn.disabled = false;
        btn.textContent = "CLAIM";
        if (res.error !== "PENDING") {
          var msg = res.error === "OFFLINE"
            ? "Cloud offline — can't claim right now."
            : res.error === "LEVEL_NOT_REACHED"
              ? "Keep playing — you need a higher level."
              : res.error === "PREMIUM_REQUIRED"
                ? "This reward needs the Premium Pass."
                : "Could not claim this reward.";
          UI.toast(msg, "error"); Audio.play("error");
        }
        return;
      }
      if (res.already) { UI.toast("Already claimed: " + rw.display_name, "info"); }
      else {
        Audio.play("reward"); UI.confetti(28);
        UI.toast("Claimed: " + rw.display_name + (res.amount ? " ×" + res.amount : ""), "gold");
      }
      // re-render with fresh state (cache was updated by BattlePass.claim)
      UI.pop();
      setTimeout(open, 240);
    });
  }

  M.open = open;
})(window);
