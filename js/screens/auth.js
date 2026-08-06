/* =====================================================================
   LOUTRIS — js/screens/auth.js
   Login (guest / Google / Apple) + username creation + avatar pick.
   ===================================================================== */
(function (global) {
  "use strict";

  var AVATAR_COLORS = [
    ["#1A2150", "#0C1130"], ["#2A1A40", "#1A0A2A"], ["#0A2A2A", "#06181"], ["#2A1A0A", "#1A0A06"],
    ["#0A1A2A", "#06101A"], ["#2A0A1A", "#1A061A"], ["#1A2A0A", "#101A06"], ["#0A0A2A", "#06061A"],
    ["#2A2A0A", "#1A1A06"], ["#0A2A1A", "#061A10"]
  ];
  var AVATAR_LETTERS = ["LX", "ZX", "CR", "WD", "LT", "GO", "RX", "AX", "VR", "NL", "KP", "EX", "LV", "OR", "ZE"];

  function show() {
    var layer = document.getElementById("auth-layer");
    UI.clear(layer);
    var s = Store.get();
    var card = renderLogin();
    layer.appendChild(card);
  }
  function hide() { var layer = document.getElementById("auth-layer"); if (layer) UI.clear(layer); }

  function renderLogin() {
    var card = UI.el("div", { class: "auth-card" }, [
      UI.el("div", { class: "auth-logo-wrap" }, [
        UI.el("div", { class: "auth-crown", html: UI.ICON.crown }),
        UI.el("div", { class: "logo-sm", text: "LOUTRIS" }),
         UI.el("div", { class: "tag-sm", text: "The house of words." })
      ]),
      UI.el("button", { class: "auth-btn guest", onclick: function () { transitionToProfile("guest"); } }, [UI.el("span", { html: UI.ICON.user }), "Continue as Guest"]),
      UI.el("button", { class: "auth-btn google", onclick: function () { oauth("google"); } }, [UI.el("span", { html: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22 12c0-.7-.06-1.4-.18-2H12v4h5.6a4.8 4.8 0 01-2.1 3.1v2.6h3.4A9.9 9.9 0 0022 12z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.4-2.6c-.9.6-2 1-3.3 1-2.5 0-4.7-1.7-5.5-4H3v2.6A10 10 0 0012 22z"/><path fill="#FBBC05" d="M6.5 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3a10 10 0 000 9.2z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 003 7.4L6.5 10C7.3 7.7 9.5 6 12 6z"/></svg>' }), "Continue with Google"]),
      UI.el("button", { class: "auth-btn apple", onclick: function () { oauth("apple"); } }, [UI.el("span", { html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 12.5c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 5.9 1 7.8.7.9 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6 1.8-1 2.5-1.9c.8-1.1 1.1-2.2 1.1-2.2s-2.3-1-2.3-3.6zM14 6.3c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.7-.4 2.3-1.1z"/></svg>' }), "Continue with Apple"]),
      UI.el("div", { class: "auth-sep", text: "OR" }),
       UI.el("div", { style: { "font-family": "DM Sans,sans-serif", "font-size": "12px", color: "var(--text-mute)", "letter-spacing": "0.5px" }, text: "Your progress saves locally on this device." })
    ]);
    return card;
  }

  function oauth(provider) {
    // Simulated OAuth handshake (no real credentials). In production this would
    // redirect through the provider's OAuth flow and return a token.
    Audio.play("matchFound");
    var card = renderProfileSetup(provider, provider === "google" ? "GOOGLE" + Math.floor(Math.random() * 9000 + 1000) : "APPLE" + Math.floor(Math.random() * 9000 + 1000));
    var layer = document.getElementById("auth-layer");
    UI.clear(layer); layer.appendChild(card);
  }

  function transitionToProfile(method) {
    Audio.play("matchFound");
    var card = renderProfileSetup(method, method === "guest" ? "GUEST" + Math.floor(Math.random() * 9000 + 1000) : "PLAYER");
    var layer = document.getElementById("auth-layer");
    UI.clear(layer); layer.appendChild(card);
  }

  function renderProfileSetup(method, suggestedName) {
    var chosenColor = 0, chosenLetters = "LX";
    var nameInput = UI.el("input", { class: "input", placeholder: suggestedName, maxlength: "14", value: "" });
    var nameStatus = UI.el("div", { class: "name-status" });
    var enterBtn = UI.el("button", { class: "auth-btn guest", style: { "margin-top": "20px" }, onclick: function () {
      var raw = nameInput.value || suggestedName;
      var name = raw.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 14);
      if (Store.isNameTaken(name)) { UI.toast("Username \"" + name + "\" is already taken.", "error"); Audio.play("error"); return; }
      finalize(method, name, chosenLetters, chosenColor);
    } }, [UI.el("span", { html: UI.ICON.crown }), "ENTER THE ARENA"]);
    function updateNameStatus() {
      var v = nameInput.value;
      var upper = v.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 14);
      if (!v) {
        if (Store.isNameTaken(suggestedName)) {
          nameStatus.className = "name-status bad";
          nameStatus.textContent = "Suggested \"" + suggestedName + "\" is taken. Type a new username.";
          enterBtn.classList.add("disabled");
        } else {
          nameStatus.className = "name-status";
          nameStatus.textContent = "Suggested: " + suggestedName;
          enterBtn.classList.remove("disabled");
        }
        return;
      }
      if (v !== upper) { nameStatus.className = "name-status bad"; nameStatus.textContent = "Letters, numbers and underscore only."; enterBtn.classList.add("disabled"); return; }
      if (Store.isNameTaken(upper)) { nameStatus.className = "name-status bad"; nameStatus.textContent = "\"" + upper + "\" is already taken."; enterBtn.classList.add("disabled"); return; }
      nameStatus.className = "name-status good"; nameStatus.textContent = "\"" + upper + "\" is available.";
      enterBtn.classList.remove("disabled");
    }
    nameInput.addEventListener("input", function () {
      var v = nameInput.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 14);
      nameInput.value = v;
      chosenLetters = (v.slice(0, 2) || "LX");
      updatePreview();
      updateNameStatus();
    });
    var preview = UI.el("div", { class: "pf-av auth-preview", style: { width: "100px", height: "100px", margin: "0 auto 14px" } });
    var previewInner = UI.el("div", { class: "in", text: "LX" });
    preview.appendChild(previewInner);
    function updatePreview() {
      previewInner.textContent = chosenLetters;
      var c = AVATAR_COLORS[chosenColor];
       preview.style.background = "conic-gradient(from 210deg,#C3DDFF,#2657B8,#6F9DF2,#C3DDFF)";
      previewInner.style.background = "linear-gradient(160deg," + c[0] + "," + c[1] + ")";
    }
    var pick = UI.el("div", { class: "avatar-pick" });
    AVATAR_LETTERS.slice(0, 10).forEach(function (ltr, idx) {
      var o = UI.el("div", { class: "avatar-opt" + (idx === 0 ? " on" : ""), text: ltr, onclick: function () {
        $$(".avatar-opt", pick).forEach(function (n) { n.classList.remove("on"); });
        o.classList.add("on"); chosenLetters = ltr; updatePreview();
      } });
      pick.appendChild(o);
    });
    var colorPick = UI.el("div", { class: "avatar-pick" });
    AVATAR_COLORS.forEach(function (c, idx) {
      var o = UI.el("div", { class: "avatar-opt" + (idx === 0 ? " on" : ""), style: { background: "linear-gradient(160deg," + c[0] + "," + c[1] + ")", color: "transparent" }, onclick: function () {
        $$(".avatar-opt", colorPick).forEach(function (n) { n.classList.remove("on"); });
        o.classList.add("on"); chosenColor = idx; updatePreview();
      } });
      colorPick.appendChild(o);
    });
    updatePreview();
    updateNameStatus();

    return UI.el("div", { class: "auth-card", style: { width: "480px" } }, [
      UI.el("div", { class: "auth-crown", html: UI.ICON.crown }),
      UI.el("div", { class: "logo-sm", text: "CREATE PROFILE", style: { "font-size": "26px", "letter-spacing": "3px" } }),
       UI.el("div", { class: "tag-sm", text: "Set your place at the table", style: { "margin-bottom": "18px" } }),
      preview,
      UI.el("div", { class: "field", style: { "margin-bottom": "6px" } }, [
        UI.el("label", { text: "Username" }), nameInput
      ]),
      nameStatus,
       UI.el("label", { style: { "font-family": "IBM Plex Mono,monospace", "font-size": "11px", color: "var(--text-mute)", "text-transform": "uppercase", "letter-spacing": "1px" }, text: "Avatar Initials" }),
      pick,
       UI.el("label", { style: { "font-family": "IBM Plex Mono,monospace", "font-size": "11px", color: "var(--text-mute)", "text-transform": "uppercase", "letter-spacing": "1px", "margin-top": "10px", display: "block" }, text: "Avatar Background" }),
      colorPick,
      enterBtn
    ]);
  }

  function finalize(method, name, letters, colorIdx) {
    name = (name || "PLAYER").toUpperCase();
    letters = (letters || name.slice(0, 2) || "LX").toUpperCase();
    var prev = Store.get();
    var isNewAccount = name !== (prev.profile.name || "").toUpperCase();
    if (isNewAccount) Store.reset();
    Store.assignTeam(); // permanent Blue/Red assignment (balanced)
    Store.patch(function (s) {
      s.authed = true; s.authMethod = method;
      s.profile.name = name; s.profile.avatar = letters; s.profile.avatarColor = colorIdx;
      s.registry = s.registry || [];
      var selfExists = false;
      for (var i = 0; i < s.registry.length; i++) if (s.registry[i].name === name) { selfExists = true; s.registry[i].elo = s.ranked.elo; s.registry[i].avatar = letters; s.registry[i].status = "online"; s.registry[i].lastSeen = Date.now(); break; }
      if (!selfExists) s.registry.push({ name: name, elo: s.ranked.elo, avatar: letters, status: "online", lastSeen: Date.now() });
    });
    Store.pushNotification("Welcome to LOUTRIS, " + name + "!", "gold");
    Audio.play("win");
    hide();
    if (global.App && App.onAuthed) App.onAuthed();
    if (isNewAccount && global.App && App.showTeamReveal) App.showTeamReveal("join");
  }

  global.AuthScreen = { show: show, hide: hide };
})(window);
