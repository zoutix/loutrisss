/* =====================================================================
   LOUTRIS — js/screens/auth.js
   Email + password accounts (no guests) + username creation + avatar pick.
   ===================================================================== */
(function (global) {
  "use strict";

  var AVATAR_COLORS = [
    ["#1A2150", "#0C1130"], ["#2A1A40", "#1A0A2A"], ["#0A2A2A", "#06181"], ["#2A1A0A", "#1A0A06"],
    ["#0A1A2A", "#06101A"], ["#2A0A1A", "#1A061A"], ["#1A2A0A", "#101A06"], ["#0A0A2A", "#06061A"],
    ["#2A2A0A", "#1A1A06"], ["#0A2A1A", "#061A10"]
  ];
  var AVATAR_LETTERS = ["LX", "ZX", "CR", "WD", "LT", "GO", "RX", "AX", "VR", "NL", "KP", "EX", "LV", "OR", "ZE"];

  var COUNTRY_OPTIONS = [
    ["", "Worldwide"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"],
    ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["PT", "Portugal"], ["NL", "Netherlands"],
    ["BR", "Brazil"], ["MX", "Mexico"], ["AR", "Argentina"],
    ["IN", "India"], ["PK", "Pakistan"],
    ["ID", "Indonesia"], ["PH", "Philippines"], ["JP", "Japan"], ["KR", "South Korea"], ["SA", "Saudi Arabia"],
    ["AE", "UAE"], ["TR", "Türkiye"], ["RO", "Romania"], ["PL", "Poland"], ["UA", "Ukraine"], ["EG", "Egypt"],
    ["NG", "Nigeria"], ["ZA", "South Africa"], ["IL", "Israel"], ["SE", "Sweden"], ["NO", "Norway"], ["FI", "Finland"],
    ["DK", "Denmark"], ["CH", "Switzerland"], ["AT", "Austria"], ["BE", "Belgium"], ["CZ", "Czechia"], ["GR", "Greece"]
  ];

  function show() {
    var layer = document.getElementById("auth-layer");
    UI.clear(layer);
    var s = Store.get();
    var card = renderLogin();
    layer.appendChild(card);
  }
  function hide() { var layer = document.getElementById("auth-layer"); if (layer) UI.clear(layer); }

  function renderLogin() {
    var card = UI.el("div", { class: "auth-card" });
    var mode = "login"; // "login" | "create"
    var busy = false;

    var title = UI.el("div", { class: "form-title", text: "SIGN IN" });
    var emailInput = UI.el("input", { class: "input", type: "email", placeholder: "you@example.com", value: "" });
    var passInput = UI.el("input", { class: "input", type: "password", placeholder: "Password", value: "" });
    var confirmWrap = UI.el("div", { style: { display: "flex" } });
    var confirmInput = UI.el("input", { class: "input", type: "password", placeholder: "Confirm password", value: "", style: { width: "100%" } });
    confirmWrap.appendChild(confirmInput);
    var confirmField = UI.el("div", { class: "field", style: { display: "none" } }, [UI.el("label", { text: "Confirm Password" }), confirmWrap]);
    var status = UI.el("div", { class: "name-status" });
    var submitLabel = UI.el("span", { class: "lbl", text: "SIGN IN" });
    var submitBtn = UI.el("button", { class: "auth-btn guest", onclick: submit }, [UI.el("span", { html: UI.ICON.crown }), submitLabel]);
    var switchBtn = UI.el("button", { class: "auth-switch", text: "CREATE AN ACCOUNT", onclick: function () { setMode(mode === "login" ? "create" : "login"); } });
    var switchLine = UI.el("div", { class: "auth-switch-line" });
    var form = UI.el("div", { class: "auth-form", style: { display: "none" } }, [
      title,
      UI.el("div", { class: "field" }, [UI.el("label", { text: "Email" }), emailInput]),
      UI.el("div", { class: "field" }, [UI.el("label", { text: "Password" }), passInput]),
      confirmField,
      status,
      submitBtn,
      switchBtn,
      switchLine
    ]);
    var emailCta = UI.el("button", { class: "auth-btn guest", onclick: function () {
      emailCta.style.display = "none";
      form.style.display = "";
      setTimeout(function () { emailInput.focus(); }, 50);
    } }, [UI.el("span", { html: UI.ICON.user }), "Continue with Email"]);

    function setStatus(msg, bad) {
      status.className = "name-status" + (bad ? " bad" : (msg ? " good" : ""));
      status.textContent = msg || "";
    }
    function setMode(m) {
      mode = m;
      title.textContent = m === "create" ? "CREATE ACCOUNT" : "SIGN IN";
      confirmField.style.display = m === "create" ? "" : "none";
      submitLabel.textContent = m === "create" ? "CREATE MY ACCOUNT" : "SIGN IN";
      switchBtn.textContent = m === "create" ? "BACK TO SIGN IN" : "CREATE AN ACCOUNT";
      setStatus("");
    }
    function submit() {
      if (busy) return;
      var email = emailInput.value.trim().toLowerCase();
      var pass = passInput.value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus("Enter a valid email address.", true); return; }
      if (pass.length < 6) { setStatus("Password must be at least 6 characters.", true); return; }
      if (mode === "create" && pass !== confirmInput.value) { setStatus("Passwords do not match.", true); return; }
      if (!global.Supabase || !Supabase.configured) { setStatus("Cloud connection is not configured.", true); return; }
      busy = true; setStatus("");
      var go = function () {
        var done = function (res) {
          busy = false;
          if (!res.ok) { setStatus(res.error || "Something went wrong.", true); return; }
          if (res.needsConfirm) {
            setStatus("We sent a confirmation link to " + email + ". Click it, then sign in.", false);
            setMode("login");
            return;
          }
          afterEmailAuthed();
        };
        if (mode === "create") Supabase.signUp(email, pass, done);
        else Supabase.signIn(email, pass, done);
      };
      if (Supabase.isReady()) { go(); }
      else {
        Supabase.init(function () {
          if (Supabase.isReady()) go();
          else { busy = false; setStatus("Could not reach the cloud. Try again.", true); }
        });
      }
    }

    [emailInput, passInput, confirmInput].forEach(function (el) {
      el.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    });

    card.appendChild(UI.el("div", { class: "auth-logo-wrap" }, [
      UI.el("div", { class: "auth-crown", html: UI.ICON.crown }),
      UI.el("div", { class: "logo-sm", text: "LOUTRIS" }),
       UI.el("div", { class: "tag-sm", text: "A house of words." })
    ]));
    card.appendChild(emailCta);
    card.appendChild(form);
    card.appendChild(UI.el("div", { class: "auth-sep", text: "OR" }));
    card.appendChild(UI.el("button", { class: "auth-btn google", onclick: function () { UI.toast("Google sign-in is coming soon", "info"); } }, [UI.el("span", { html: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="#4285F4" d="M22 12c0-.7-.06-1.4-.18-2H12v4h5.6a4.8 4.8 0 01-2.1 3.1v2.6h3.4A9.9 9.9 0 0022 12z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.4-2.6c-.9.6-2 1-3.3 1-2.5 0-4.7-1.7-5.5-4H3v2.6A10 10 0 0012 22z"/><path fill="#FBBC05" d="M6.5 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3a10 10 0 000 9.2z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 003 7.4L6.5 10C7.3 7.7 9.5 6 12 6z"/></svg>' }), "Continue with Google"]));
    card.appendChild(UI.el("button", { class: "auth-btn apple", onclick: function () { UI.toast("Apple sign-in is coming soon", "info"); } }, [UI.el("span", { html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702"/></svg>' }), "Continue with Apple"]));
    card.appendChild(UI.el("div", { style: { "font-family": "DM Sans,sans-serif", "font-size": "12px", color: "var(--text-mute)", "letter-spacing": "0.5px" }, text: "Your account, Elo, team and leaderboard standing live in the cloud." }));
    return card;
  }

  // After a successful email sign-in / sign-up: restore the cloud profile
  // if one exists, otherwise take the user through profile creation.
  function afterEmailAuthed() {
    Audio.play("matchFound");
    Supabase.pull(function (db) {
      if (db && db.profile && db.profile.name) {
        if (Store.applyCloudSnapshot) Store.applyCloudSnapshot(db);
        else Store.replace(db);
        Store.patch(function (s) { s.authed = true; s.authMethod = "email"; });
        var s = Store.get();
        hide();
        if (global.App && App.onAuthed) App.onAuthed();
        UI.toast("Welcome back, " + String(s.profile.name || "").toUpperCase() + "!", "gold");
      } else {
        var card = renderProfileSetup("email", "PLAYER" + Math.floor(Math.random() * 9000 + 1000));
        var layer = document.getElementById("auth-layer");
        UI.clear(layer); layer.appendChild(card);
      }
    });
  }

  function transitionToProfile(method, suggestedName) {
    Audio.play("matchFound");
    var card = renderProfileSetup(method, suggestedName || "PLAYER");
    var layer = document.getElementById("auth-layer");
    UI.clear(layer); layer.appendChild(card);
  }

  function renderProfileSetup(method, suggestedName) {
    var chosenColor = 0, chosenLetters = "LX", chosenCountry = "";
    var nameInput = UI.el("input", { class: "input", placeholder: suggestedName, maxlength: "14", value: "" });
    var nameStatus = UI.el("div", { class: "name-status" });
    var enterBtn = UI.el("button", { class: "auth-btn guest", style: { "margin-top": "20px" }, onclick: function () {
      var raw = nameInput.value || suggestedName;
      var name = raw.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 14);
      if (Store.isNameTaken(name)) { UI.toast("Username \"" + name + "\" is already taken.", "error"); Audio.play("error"); return; }
      var go = function () { finalize(method, name, chosenLetters, chosenColor, chosenCountry); };
      if (global.Supabase && Supabase.configured && Supabase.isReady()) {
        Supabase.isNameTaken(name, function (taken) {
          if (taken) { UI.toast("Username \"" + name + "\" is already taken on another device.", "error"); Audio.play("error"); return; }
          go();
        });
      } else { go(); }
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
    var countrySel = UI.el("select", { class: "input", style: { width: "100%", background: "#101631" } });
    COUNTRY_OPTIONS.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c[0]; opt.textContent = c[1];
      countrySel.appendChild(opt);
    });
    countrySel.addEventListener("change", function () { chosenCountry = countrySel.value; });
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
       UI.el("label", { style: { "font-family": "IBM Plex Mono,monospace", "font-size": "11px", color: "var(--text-mute)", "text-transform": "uppercase", "letter-spacing": "1px", "margin-top": "10px", display: "block" }, text: "Country" }),
      countrySel,
      enterBtn
    ]);
  }

  function finalize(method, name, letters, colorIdx, country) {
    name = (name || "PLAYER").toUpperCase();
    letters = (letters || name.slice(0, 2) || "LX").toUpperCase();
    var prev = Store.get();
    var isNewAccount = name !== (prev.profile.name || "").toUpperCase();
    if (isNewAccount) Store.reset();
    Store.assignTeam(); // permanent Blue/Red assignment (balanced)
    var finish = function () {
      Store.patch(function (s) {
        s.authed = true; s.authMethod = method;
        s.profile.name = name; s.profile.avatar = letters; s.profile.avatarColor = colorIdx;
        s.profile.country = country || null;
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
    };
    if (global.Supabase && Supabase.configured && Supabase.isReady() && Supabase.saveProfileSettings) {
      Supabase.saveProfileSettings({ name: name, avatar: letters, country: country || null }, Store.get().settings, function (ok) {
        if (!ok) { UI.toast("Could not save your profile. Try again.", "error"); return; }
        finish();
      });
    } else {
      finish();
    }
  }

  global.AuthScreen = { show: show, hide: hide };
})(window);
