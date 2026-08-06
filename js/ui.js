/* =====================================================================
   LOUTRIS — js/ui.js
   UI framework: DOM helpers, toast, modal, overlay router (push/pop),
   animations (tile flip, confetti, shake), reusable components.
   ===================================================================== */
(function (global) {
  "use strict";

  // ---- DOM helpers ----
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "style" && typeof attrs[k] === "object") Object.assign(n.style, attrs[k]);
      else if (k.startsWith("on") && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (k === "dataset") Object.assign(n.dataset, attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    appendKids(n, children);
    return n;
  }
  function appendKids(n, children) {
    if (children == null) return;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null) return;
      if (typeof c === "string" || typeof c === "number") n.appendChild(document.createTextNode(String(c)));
      else n.appendChild(c);
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); return n; }
  function svg(viewBox, pathHtml, opts) {
    opts = opts || {};
    return el("svg", Object.assign({ viewBox: viewBox, fill: "none", stroke: "currentColor", "stroke-width": "1.8" }, opts), []);
  }

  // ---- Icons (inline svg strings) — rounded cartoon style ----
  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="url(#coinG)" stroke="#C07A10" stroke-width="1"/><circle cx="12" cy="12" r="7" fill="none" stroke="#FFF1C9" stroke-width="1.2" opacity="0.7"/><defs><radialGradient id="coinG" cx="30%" cy="30%"><stop offset="0" stop-color="#FFF1C9"/><stop offset="100%" stop-color="#FF9E1B"/></radialGradient></defs></svg>',
    gem: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l9 7-9 13-9-13z" fill="url(#gemG)" stroke="#1C86EE" stroke-width="1"/><path d="M3 9h18" stroke="#7BE3FF" stroke-width="1"/><defs><linearGradient id="gemG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7BE3FF"/><stop offset="100%" stop-color="#1C86EE"/></linearGradient></defs></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.8 6.4L22 9.5l-5.2 5.1L18 22 12 18.5 6 22l1.2-7.4L2 9.5l7.2-1.1z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4.5"/><path d="M4 21c0-4.5 3.5-7.5 8-7.5s8 3 8 7.5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v3a5 5 0 01-10 0z"/><path d="M6 6H3v2a3.5 3.5 0 003.5 3.5M18 6h3v2a3.5 3.5 0 01-3.5 3.5"/><path d="M9 20h6M12 14v6"/></svg>',
    fire: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.2 4.5 4.5 6 4.5 10a4.5 4.5 0 01-9 0c0-2.5 1.2-3.8 2.5-5-3.5 0-6 3.5-6 7a8 8 0 1016 0c0-7-6-9.5-8-12z"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16l2.5-9 3.5 6 3.5-6 2.5 9H5z"/><circle cx="7.5" cy="5" r="1.5" fill="#FFF1C9"/><circle cx="12" cy="3" r="1.8" fill="#FFF1C9"/><circle cx="16.5" cy="5" r="1.5" fill="#FFF1C9"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12"/><path d="M12 8c-1.5 0-4-.5-4-2.5S9.5 3 11 3.5 12 8 12 8zm0 0c1.5 0 4-.5 4-2.5S14.5 3 13 3.5 12 8 12 8z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.5c2.8.4 5 2.3 5 5.5"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V4H6.5A2.5 2.5 0 004 6.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/><path d="M9 8h7"/></svg>',
    medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="6"/><path d="M12 13l1 2 2.2.3-1.6 1.6.4 2.1-2-1-2 1 .4-2.1-1.6-1.6L11 15z" fill="currentColor" stroke="none"/><path d="M8.5 9.5L5 3h5l2 4 2-4h5l-3.5 6.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-11"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 14H11l-1 8 8.5-12H12z"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4c4-2 8 2 14 0v10c-6 2-10-2-14 0"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M9 15l2 2 4-4"/></svg>',
    scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12a2 2 0 012 2v12a2 2 0 002 2H8a2 2 0 01-2-2V6a2 2 0 00-2-2z"/><path d="M6 4a2 2 0 00-2 2v1h4"/><path d="M10 9h6M10 13h6"/></svg>'
  };

  // ---- Toast ----
  // Icon is derived from the toast kind so every notification shares the
  // same crafted SVG language (legacy emoji args are ignored by design).
  var TOAST_ICON = { success: "check", gold: "crown", error: "close", info: "star" };
  function toast(text, kind, emoji) {
    var layer = document.getElementById("toast-layer"); if (!layer) return;
    var t = el("div", { class: "toast " + (kind || "") }, [
      el("div", { class: "t-ico", html: ICON[TOAST_ICON[kind]] || ICON.star }),
      el("div", { class: "t-txt", text: text })
    ]);
    layer.appendChild(t);
    Audio.play("click");
    setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 320); }, 2600);
  }

  // ---- Modal ----
  function modal(opts) {
    opts = opts || {};
    var layer = document.getElementById("modal-layer"); if (!layer) return;
    var veil = el("div", { class: "modal" });
    var card = el("div", { class: "modal-card" }, [
      el("div", { class: "modal-title", text: opts.title || "" }),
      opts.body ? el("div", { class: "modal-body", html: opts.body }) : null,
      el("div", { class: "modal-actions" }, (opts.actions || [
        { label: "OK", primary: true, action: function () {} }
      ]).map(function (a) {
        return el("button", { class: "btn " + (a.primary ? "primary" : "") + (a.danger ? " danger" : ""), onclick: function () { if (a.action) a.action(veil); if (a.close !== false) close(); } }, a.label);
      }))
    ]);
    function close() { veil.style.opacity = "0"; setTimeout(function () { veil.remove(); }, 200); }
    veil._close = close;
    veil.appendChild(card);
    veil.addEventListener("click", function (e) { if (e.target === veil && opts.dismissable !== false) close(); });
    layer.appendChild(veil);
    Audio.play("enter");
    return { close: close, card: card };
  }
  function confirm(text, onYes, opts) {
    opts = opts || {};
    modal({
      title: opts.title || "Confirm",
      body: text,
      actions: [
        { label: opts.noLabel || "Cancel", action: function () {} },
        { label: opts.yesLabel || "Confirm", primary: true, action: function () { onYes && onYes(); } }
      ]
    });
  }

  // ---- Overlay screen router (push/pop). Home shell preserved underneath. ----
  var stack = [];
  function push(screenEl) {
    var layer = document.getElementById("screen-layer");
    if (!layer) return;
    if (stack.length) stack[stack.length - 1].style.display = "none";
    stack.push(screenEl);
    layer.appendChild(screenEl);
    Audio.play("enter");
    return screenEl;
  }
  function pop() {
    var layer = document.getElementById("screen-layer");
    var top = stack.pop();
    if (!top) return;
    top.classList.add("out");
    setTimeout(function () { top.remove(); }, 260);
    if (stack.length) stack[stack.length - 1].style.display = "";
    // Returning from the final overlay means the player is back in the lobby.
    // Notify the shell so its navigation state cannot remain stale.
    if (!stack.length) window.dispatchEvent(new Event("loutris:home"));
    Audio.play("back");
  }
  function popAll() { while (stack.length) pop(); }
  function isTop(screenEl) { return stack[stack.length - 1] === screenEl; }
  function depth() { return stack.length; }

  // ---- ESC acts as the back button ----
  // Priority: close the topmost modal/reveal first, otherwise go back one
  // screen (via its back handler so in-game exits keep their confirm guard).
  function handleEscape(e) {
    if (e.key !== "Escape") return;
    var layer = document.getElementById("modal-layer");
    if (layer) {
      var veils = layer.querySelectorAll(".modal, .team-reveal-veil");
      if (veils.length) {
        var top = veils[veils.length - 1];
        if (top._close) top._close();
        else top.remove();
        return;
      }
    }
    if (stack.length) {
      var topScreen = stack[stack.length - 1];
      var backBtn = topScreen.querySelector(".s-back");
      if (backBtn) backBtn.click();
      else pop();
    }
  }
  window.addEventListener("keydown", handleEscape);

  // Standard screen builder with back button + title.
  function screen(opts) {
    opts = opts || {};
    var s = el("div", { class: "screen" });
    var top = el("div", { class: "s-top" }, [
      el("div", { class: "s-back", onclick: function () { opts.onBack ? opts.onBack() : pop(); }, html: ICON.back + "<span>BACK</span>" }),
      el("div", { class: "s-titles" }, [
        opts.title ? el("div", { class: "s-title", text: opts.title }) : null,
        opts.sub ? el("div", { class: "s-sub", text: opts.sub }) : null
      ]),
      el("div", { class: "s-spacer" }),
      opts.actions || null
    ]);
    var body = el("div", { class: "s-body" });
    s.appendChild(top); s.appendChild(body);
    s._body = body; s._top = top;
    if (opts.bodyContent) appendKids(body, opts.bodyContent);
    return s;
  }

  // ---- Animations ----
  function confetti(amount) {
    var fx = document.getElementById("fx-layer"); if (!fx) return;
    amount = amount || 80;
     var colors = ["#4E8FFF", "#C3DDFF", "#6BA4FF", "#5570A6", "#EDF3FF"];
    for (var i = 0; i < amount; i++) {
      var c = el("div", { class: "confetti" });
      c.style.left = (Math.random() * 100) + "vw";
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
      c.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
      c.style.width = (6 + Math.random() * 8) + "px"; c.style.height = (10 + Math.random() * 10) + "px";
      fx.appendChild(c);
      (function (node) { setTimeout(function () { node.remove(); }, 3400); })(c);
    }
  }
  function flash(color) {
    var fx = document.getElementById("fx-layer"); if (!fx) return;
    var f = el("div", { class: "flash" });
    if (color) f.style.background = "radial-gradient(circle at 50% 40%," + color + ",transparent 60%)";
    fx.appendChild(f); setTimeout(function () { f.remove(); }, 600);
  }
  function shake(node) { node.classList.add("shake"); setTimeout(function () { node.classList.remove("shake"); }, 420); }

  // ---- Reusable components ----
  function button(label, opts) {
    opts = opts || {};
    var cls = "btn"; if (opts.primary) cls += " primary"; if (opts.gold) cls += " gold"; if (opts.ghost) cls += " ghost"; if (opts.danger) cls += " danger"; if (opts.navy) cls += " navy"; if (opts.sm) cls += " sm"; if (opts.lg) cls += " lg";
    var b = el("button", { class: cls, onclick: opts.onclick }, (opts.icon ? [el("span", { html: opts.icon }), label] : label));
    if (opts.disabled) b.disabled = true;
    return b;
  }
  function gcard(title, accent, content, link) {
    var c = el("div", { class: "gcard" }, [
      el("div", { class: "ghead" }, [
        title ? el("div", { class: "gtitle", html: title + (accent ? ' <span class="accent">' + accent + "</span>" : "") }) : null,
        link ? el("div", { class: "glink", text: link.label || "MORE ›", onclick: link.onclick }) : null
      ])
    ]);
    if (content) appendKids(c, Array.isArray(content) ? content : [content]);
    return c;
  }
  function progressBar(pct, cls) {
    var b = el("div", { class: "bar" + (cls ? " " + cls : "") });
    b.appendChild(el("i", { style: { width: Math.max(0, Math.min(100, pct)) + "%" } }));
    return b;
  }
  function priceTag(cur, amount) {
    var cls = "price"; if (cur === "gems") cls += " gem"; if (cur === "prem") cls += " prem";
    return el("div", { class: cls, html: '<span class="pi"></span><span>' + (typeof amount === "number" ? amount.toLocaleString() : amount) + "</span>" });
  }

  // ---- FX helper: spawn a temporary full-screen veil (e.g. result, chest) ----
  function veil(content, opts) {
    opts = opts || {};
    var v = el("div", { class: opts.cls || "result-veil" });
    v.appendChild(content);
    document.getElementById("fx-layer").appendChild(v);
    if (opts.dismissable !== false) v.addEventListener("click", function (e) { if (e.target === v) { v.remove(); } });
    return v;
  }

  global.UI = {
    el: el, $: $, $$: $$, clear: clear, svg: svg, ICON: ICON,
    toast: toast, modal: modal, confirm: confirm,
    push: push, pop: pop, popAll: popAll, isTop: isTop, depth: depth, screen: screen,
    confetti: confetti, flash: flash, shake: shake,
    button: button, gcard: gcard, progressBar: progressBar, priceTag: priceTag, veil: veil
  };
  // expose query helpers globally so screen modules can use bare $ / $$
  global.$ = $;
  global.$$ = $$;
})(window);
