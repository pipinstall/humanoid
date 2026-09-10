/* Shared helpers + data loader + header shell. Sets window.HRI. Plain script, no modules. */
(function () {
  "use strict";
  var HRI = window.HRI || (window.HRI = {});

  HRI.ERA_ORDER = ["automata", "foundational", "dynamic-bipedalism", "drc", "commercial-pivot", "explosion"];
  HRI.ERA_SHORT = {
    "automata": "Automata", "foundational": "Foundational", "dynamic-bipedalism": "Dynamic",
    "drc": "DRC", "commercial-pivot": "Commercial", "explosion": "Explosion"
  };

  HRI.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  HRI.titleCase = function (s) {
    return String(s).replace(/(^|[\s\-\/])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  };
  HRI.num = function (v, unit) { return v == null ? "—" : (v + (unit || "")); };
  HRI.cssv = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  };
  HRI.eraColor = function (id) { return HRI.cssv("--era-" + id) || HRI.cssv("--ink-muted"); };

  /* data root: pages set window.HRI_ROOT (relative prefix) before loading */
  function dataUrl(name) { return (window.HRI_ROOT || "") + "data/" + name + ".json"; }

  HRI.loadData = function () {
    if (HRI._data) return Promise.resolve(HRI._data);
    if (window.__HRI_DATA__) { return Promise.resolve(finish(window.__HRI_DATA__)); }
    var names = ["robots", "hands", "eras", "milestones", "news", "images"];
    return Promise.all(names.map(function (n) {
      return fetch(dataUrl(n)).then(function (r) {
        if (!r.ok) throw new Error(n + " " + r.status);
        return r.json();
      }).catch(function () { return n === "images" ? {} : Promise.reject(new Error(n)); });
    })).then(function (a) {
      var d = {};
      names.forEach(function (n, i) { d[n] = a[i]; });
      return finish(d);
    });
  };

  function finish(d) {
    d.eraById = {};
    (d.eras || []).forEach(function (x) { d.eraById[x.id] = x; });
    d.robotById = {};
    (d.robots || []).forEach(function (x) { d.robotById[x.id] = x; });
    d.handById = {};
    (d.hands || []).forEach(function (x) { d.handById[x.id] = x; });
    HRI._data = d;
    return d;
  }

  /* header: theme toggle + let charts know to re-render on theme change */
  HRI.onThemeChange = [];
  HRI.initShell = function () {
    var btn = document.getElementById("themeBtn");
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var isDark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      var next = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("hri-theme", next); } catch (e) {}
      HRI.onThemeChange.forEach(function (fn) { try { fn(); } catch (e) {} });
    });
  };

  if (document.readyState !== "loading") HRI.initShell();
  else document.addEventListener("DOMContentLoaded", HRI.initShell);
})();
