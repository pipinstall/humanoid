/* The interactive explorer: catalogue, timeline (ribbon + reading list),
   milestones, news, analysis. Hash-routed & deep-linkable. Depends on util.js + charts.js. */
(function () {
  "use strict";
  var HRI = window.HRI, D = null;
  var esc = HRI.esc, titleCase = HRI.titleCase, num = HRI.num, eraColor = HRI.eraColor, cssv = HRI.cssv;
  var ERA_ORDER = HRI.ERA_ORDER, ERA_SHORT = HRI.ERA_SHORT;
  var $ = function (id) { return document.getElementById(id); };
  var ROOT = window.HRI_ROOT || "";

  var VIEWS = ["catalog", "timeline", "milestones", "news", "analysis"];
  var FKEYS = ["q", "era", "country", "form_factor", "openness", "status", "actuation", "purpose"];

  var state = {
    view: "catalog", dataset: "robots", mode: "table",
    sort: { key: "year_revealed", dir: 1 },
    filters: { q: "", era: "", country: "", form_factor: "", openness: "", status: "", actuation: "", purpose: "" },
    selected: null
  };
  var writingHash = false;

  HRI.loadData().then(function (d) {
    D = d;
    HRI.openDetail = openDetail;
    HRI.onThemeChange.push(function () { if (state.view === "analysis") renderAnalysis(); if (state.view === "timeline") renderRibbon(); });
    $("brandcount") && ($("brandcount").textContent = d.robots.length + " robots · " + d.hands.length + " hands");
    wirePanel();
    readHash();
    render();
    window.addEventListener("hashchange", function () {
      if (writingHash) { writingHash = false; return; }
      readHash(); render();
    });
  }).catch(function () {
    var b = $("catbody"); if (b) b.innerHTML = "<p>Could not load data.</p>";
  });

  /* ---------- hash <-> state ---------- */
  function readHash() {
    var h = location.hash.replace(/^#\/?/, "");
    var qi = h.indexOf("?");
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var qs = qi >= 0 ? h.slice(qi + 1) : "";
    var seg = path.split("/");
    state.selected = null;
    if (seg[0] === "robot" && seg[1]) { state.selected = seg[1]; state.view = "catalog"; }
    else if (seg[0] === "hand" && seg[1]) { state.selected = seg[1]; state.dataset = "hands"; state.view = "catalog"; }
    else if (VIEWS.indexOf(seg[0]) >= 0) state.view = seg[0];
    else state.view = "catalog";
    var p = {};
    qs.split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("="), k = decodeURIComponent(kv.slice(0, i)), v = decodeURIComponent(kv.slice(i + 1));
      p[k] = v;
    });
    if (p.ds === "hands" || p.ds === "robots") state.dataset = p.ds;
    if (p.mode === "cards" || p.mode === "table") state.mode = p.mode;
    if (p.sort) { var d = p.sort[0] === "-" ? -1 : 1; state.sort = { key: p.sort.replace(/^-/, ""), dir: d }; }
    FKEYS.forEach(function (k) { state.filters[k] = p[k] || ""; });
  }

  function writeHash() {
    var path;
    if (state.selected) path = (D.robotById[state.selected] ? "robot/" : "hand/") + state.selected;
    else path = state.view;
    var p = [];
    if (state.view === "catalog") {
      if (state.dataset !== "robots") p.push("ds=hands");
      if (state.mode !== "table") p.push("mode=cards");
      if (!(state.sort.key === "year_revealed" && state.sort.dir === 1))
        p.push("sort=" + (state.sort.dir < 0 ? "-" : "") + state.sort.key);
      FKEYS.forEach(function (k) { if (state.filters[k]) p.push(k + "=" + encodeURIComponent(state.filters[k])); });
    }
    writingHash = true;
    location.hash = "#/" + path + (p.length ? "?" + p.join("&") : "");
  }

  /* ---------- render dispatch ---------- */
  function render() {
    document.querySelectorAll(".view").forEach(function (s) { s.classList.remove("active"); });
    var host = $("v-" + state.view);
    if (host) host.classList.add("active");
    document.querySelectorAll(".nav a[data-v]").forEach(function (a) {
      a.setAttribute("aria-current", a.dataset.v === state.view ? "true" : "false");
    });
    if (state.view === "catalog") { buildFilters(); renderCatalog(); }
    else if (state.view === "timeline") { renderRibbon(); renderReading(); }
    else if (state.view === "milestones") renderMilestones();
    else if (state.view === "news") renderNews();
    else if (state.view === "analysis") renderAnalysis();
    if (state.selected) openDetail(state.selected, true);
    else closeDetail(true);
  }

  function go(view) { state.view = view; state.selected = null; writeHash(); render(); window.scrollTo(0, 0); }

  /* ---------- catalogue ---------- */
  var COLS_ROBOT = [
    { key: "name", label: "Name", cls: "name" }, { key: "maker", label: "Maker", cls: "maker" },
    { key: "country", label: "Country" }, { key: "year_revealed", label: "Year", cls: "num", sortable: true },
    { key: "height_cm", label: "Ht cm", cls: "num", sortable: true }, { key: "mass_kg", label: "Mass kg", cls: "num", sortable: true },
    { key: "dof_total", label: "DOF", cls: "num", sortable: true }, { key: "actuation", label: "Actuation" },
    { key: "form_factor", label: "Form" }, { key: "status", label: "Status" }
  ];
  var COLS_HAND = [
    { key: "name", label: "Name", cls: "name" }, { key: "maker", label: "Maker", cls: "maker" },
    { key: "country", label: "Country" }, { key: "year_revealed", label: "Year", cls: "num", sortable: true },
    { key: "dof_total", label: "DOF", cls: "num", sortable: true }, { key: "actuated_dof", label: "Act. DOF", cls: "num", sortable: true },
    { key: "fingers", label: "Fingers", cls: "num", sortable: true }, { key: "actuation", label: "Actuation" },
    { key: "tactile", label: "Tactile" }, { key: "status", label: "Status" }
  ];
  function uniqSorted(a) { return a.filter(function (v, i, r) { return v && r.indexOf(v) === i; }).sort(); }

  function buildFilters() {
    var host = $("filters"); if (!host) return;
    var rob = state.dataset === "robots";
    var src = rob ? D.robots : D.hands;
    function opts(vals, cur, ph) {
      return '<option value="">' + esc(ph || "All") + "</option>" + vals.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(titleCase(v)) + "</option>";
      }).join("");
    }
    var h = '<div class="seg" id="dsSeg"><button type="button" data-ds="robots" aria-pressed="' + rob + '">Robots</button>' +
      '<button type="button" data-ds="hands" aria-pressed="' + (!rob) + '">Hands</button></div>' +
      '<input type="search" id="fq" placeholder="Search name, maker, summary…" value="' + esc(state.filters.q) + '">';
    if (rob) {
      h += '<select id="f-era"><option value="">All eras</option>' + ERA_ORDER.map(function (id) {
        return '<option value="' + id + '"' + (state.filters.era === id ? " selected" : "") + ">" + esc(D.eraById[id].name) + "</option>";
      }).join("") + "</select>";
      h += '<select id="f-form_factor">' + opts(uniqSorted(src.map(function (r) { return r.form_factor; })), state.filters.form_factor, "All form factors") + "</select>";
    }
    h += '<select id="f-country">' + opts(uniqSorted(src.map(function (r) { return r.country; })), state.filters.country, "All countries") + "</select>";
    h += '<select id="f-actuation">' + opts(uniqSorted(src.map(function (r) { return r.actuation; })), state.filters.actuation, "Any actuation") + "</select>";
    h += '<select id="f-openness">' + opts(uniqSorted(src.map(function (r) { return r.openness; })), state.filters.openness, "Any openness") + "</select>";
    h += '<select id="f-status">' + opts(uniqSorted(src.map(function (r) { return r.status; })), state.filters.status, "Any status") + "</select>";
    if (rob) {
      var purposes = uniqSorted([].concat.apply([], D.robots.map(function (r) { return r.purpose || []; })));
      h += '<select id="f-purpose"><option value="">Any purpose</option>' + purposes.map(function (p) {
        return '<option value="' + esc(p) + '"' + (state.filters.purpose === p ? " selected" : "") + ">" + esc(titleCase(p)) + "</option>";
      }).join("") + "</select>";
    }
    h += '<div class="seg" id="modeSeg"><button type="button" data-m="table" aria-pressed="' + (state.mode === "table") + '">Table</button>' +
      '<button type="button" data-m="cards" aria-pressed="' + (state.mode === "cards") + '">Cards</button></div>' +
      '<button class="clearbtn" id="clearF" type="button">Reset</button>';
    host.innerHTML = h;

    $("dsSeg").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      state.dataset = b.dataset.ds; state.sort = { key: "year_revealed", dir: 1 };
      FKEYS.forEach(function (k) { if (k !== "q") state.filters[k] = ""; });
      writeHash(); buildFilters(); renderCatalog();
    });
    $("modeSeg").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      state.mode = b.dataset.m; writeHash(); buildFilters(); renderCatalog();
    });
    $("fq").addEventListener("input", function (e) { state.filters.q = e.target.value; writeHash(); renderCatalog(); });
    FKEYS.forEach(function (k) {
      var el = $("f-" + k);
      if (el) el.addEventListener("change", function (e) { state.filters[k] = e.target.value; writeHash(); renderCatalog(); });
    });
    $("clearF").addEventListener("click", function () {
      FKEYS.forEach(function (k) { state.filters[k] = ""; });
      writeHash(); buildFilters(); renderCatalog();
    });
  }

  function currentRows() {
    var f = state.filters;
    var rows = (state.dataset === "robots" ? D.robots : D.hands).filter(function (r) {
      if (f.q) {
        var hay = (r.name + " " + r.maker + " " + (r.summary || "")).toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) === -1) return false;
      }
      if (f.era && r.era !== f.era) return false;
      if (f.country && r.country !== f.country) return false;
      if (f.form_factor && r.form_factor !== f.form_factor) return false;
      if (f.openness && r.openness !== f.openness) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.actuation && r.actuation !== f.actuation) return false;
      if (f.purpose && (r.purpose || []).indexOf(f.purpose) === -1) return false;
      return true;
    });
    var k = state.sort.key, dir = state.sort.dir;
    rows.sort(function (a, b) {
      var av = a[k], bv = b[k];
      if (k === "name" || k === "maker" || k === "country") return String(av).localeCompare(String(bv)) * dir;
      av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv;
      if (av === bv) return String(a.name).localeCompare(String(b.name));
      return (av < bv ? -1 : 1) * dir;
    });
    return rows;
  }

  function imgFor(id) { return (D.images && D.images[id]) ? ROOT + "img/" + D.images[id] : null; }

  function renderCatalog() {
    var rows = currentRows();
    var total = state.dataset === "robots" ? D.robots.length : D.hands.length;
    $("resultline").textContent = rows.length + " / " + total + " " + state.dataset + (rows.length === total ? "" : "  ·  filtered");
    $("catbody").innerHTML = state.mode === "table" ? tableHTML(rows) : cardsHTML(rows);
    if (state.mode === "table") wireSort();
    wireRowClicks();
  }
  function eraCell(id) {
    if (!id) return "";
    var e = D.eraById[id];
    return '<span class="eratag"><span class="eradot" style="background:' + eraColor(id) + '"></span>' + esc(e ? ERA_SHORT[id] : id) + "</span>";
  }
  function tableHTML(rows) {
    var cols = state.dataset === "robots" ? COLS_ROBOT : COLS_HAND;
    var head = "<tr>" + cols.map(function (c) {
      var ar = state.sort.key === c.key ? ' <span class="arrow">' + (state.sort.dir > 0 ? "▲" : "▼") + "</span>" : "";
      return "<th" + (c.sortable ? ' class="sortable" data-k="' + c.key + '"' : "") + ">" + esc(c.label) + ar + "</th>";
    }).join("") + "</tr>";
    var body = rows.map(function (r) {
      return '<tr data-id="' + esc(r.id) + '"' + (state.selected === r.id ? ' aria-selected="true"' : "") + ">" + cols.map(function (c) {
        var v = r[c.key];
        if (c.cls === "name") {
          var im = imgFor(r.id);
          return '<td class="name">' + (im ? '<img class="thumb" src="' + esc(im) + '" alt="" loading="lazy">' : "") + esc(v) + "</td>";
        }
        if (c.key === "form_factor" && state.dataset === "robots")
          return "<td>" + esc(titleCase(v || "—")) + "<br>" + eraCell(r.era) + "</td>";
        if (c.cls === "num") return '<td class="num">' + (v == null ? "—" : v) + "</td>";
        if (c.cls === "maker") return '<td class="maker">' + esc(v) + "</td>";
        if (c.key === "status") return '<td><span class="status-pill" data-s="' + esc(v) + '">' + esc(v) + "</span></td>";
        return "<td>" + esc(titleCase(v || "—")) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="tablewrap"><table class="cat"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>";
  }
  function cardsHTML(rows) {
    return '<div class="cards">' + rows.map(function (r) {
      var specs = state.dataset === "robots"
        ? [r.height_cm != null ? r.height_cm + " cm" : null, r.mass_kg != null ? r.mass_kg + " kg" : null, r.dof_total != null ? r.dof_total + " DOF" : null, r.actuation || null]
        : [r.dof_total != null ? r.dof_total + " DOF" : null, r.fingers != null ? r.fingers + " fingers" : null, r.actuation || null, (r.tactile && r.tactile !== "none") ? "tactile" : null];
      specs = specs.filter(Boolean);
      var im = imgFor(r.id);
      return '<div class="card" data-id="' + esc(r.id) + '"' + (state.selected === r.id ? ' aria-selected="true"' : "") + ">" +
        (im ? '<div class="cimg"><img src="' + esc(im) + '" alt="" loading="lazy"></div>' : "") +
        '<div class="cbody"><div class="ct"><span class="cn">' + esc(r.name) + '</span><span class="cy">' + esc(r.year_revealed) + "</span></div>" +
        '<div class="cm">' + esc(r.maker) + " · " + esc(r.country) + "</div>" +
        (state.dataset === "robots" ? "<div>" + eraCell(r.era) + "</div>" : "") +
        '<div class="cspecs">' + specs.map(function (s) { return "<span>" + esc(titleCase(s)) + "</span>"; }).join("") + "</div></div></div>";
    }).join("") + "</div>";
  }
  function wireSort() {
    document.querySelectorAll("table.cat thead th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.k;
        if (state.sort.key === k) state.sort.dir *= -1;
        else state.sort = { key: k, dir: k === "name" ? 1 : -1 };
        writeHash(); renderCatalog();
      });
    });
  }
  function wireRowClicks() {
    document.querySelectorAll("#v-catalog [data-id]").forEach(function (el) {
      el.addEventListener("click", function () { openDetail(el.dataset.id); });
    });
  }

  /* ---------- detail panel ---------- */
  function wirePanel() {
    $("scrim").addEventListener("click", function () { closeDetail(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDetail(); });
  }
  function findEntry(id) { return D.robotById[id] || D.handById[id]; }

  function openDetail(id, silent) {
    var r = findEntry(id); if (!r) return;
    state.selected = id;
    if (!silent) writeHash();
    document.querySelectorAll("[data-id]").forEach(function (el) {
      el.setAttribute("aria-selected", el.dataset.id === id ? "true" : "false");
    });
    var isHand = !r.era, rows = [];
    function add(l, v) { if (v != null && v !== "") rows.push("<dt>" + l + "</dt><dd>" + v + "</dd>"); }
    add("Maker", esc(r.maker) + " (" + esc(titleCase(r.maker_type)) + ")");
    add("Country", esc(r.country));
    add("Revealed", r.year_revealed + (r.year_status_end ? " – " + r.year_status_end : ""));
    add("Status", esc(titleCase(r.status)));
    add("Openness", esc(titleCase(r.openness)));
    if (!isHand) {
      add("Era", esc(D.eraById[r.era] ? D.eraById[r.era].name : r.era));
      add("Form factor", esc(titleCase(r.form_factor)));
      add("Height", num(r.height_cm, " cm")); add("Mass", num(r.mass_kg, " kg"));
      add("Total DOF", r.dof_total != null ? r.dof_total : null);
      add("DOF detail", r.dof_breakdown ? esc(typeof r.dof_breakdown === "string" ? r.dof_breakdown : JSON.stringify(r.dof_breakdown)) : null);
      add("Actuation", r.actuation ? esc(titleCase(r.actuation)) : null);
      add("Power", r.power ? esc(titleCase(r.power)) : null);
      add("Runtime", r.runtime_h != null ? r.runtime_h + " h" : null);
      add("Payload", r.payload_kg != null ? r.payload_kg + " kg" : null);
      add("Hands", r.hands ? esc(titleCase(r.hands)) + (r.hand_ref ? ' → <a href="#" data-goto="' + esc(r.hand_ref) + '">' + esc(r.hand_ref) + "</a>" : "") : null);
      add("Price", r.price_usd != null ? "$" + r.price_usd.toLocaleString() + (r.price_note ? " (" + esc(r.price_note) + ")" : "") : null);
      add("Purpose", (r.purpose || []).map(titleCase).join(", ") || null);
    } else {
      add("Total DOF", r.dof_total != null ? r.dof_total : null);
      add("Actuated DOF", r.actuated_dof != null ? r.actuated_dof : null);
      add("Fingers", r.fingers != null ? r.fingers : null);
      add("Actuation", r.actuation ? esc(titleCase(r.actuation)) : null);
      add("Weight", r.weight_g != null ? r.weight_g + " g" : null);
      add("Grip force", r.grip_force_n != null ? r.grip_force_n + " N" : null);
      add("Tactile", r.tactile ? esc(titleCase(r.tactile)) : null);
      add("Used on", (r.used_on || []).map(function (x) { return '<a href="#" data-goto="' + esc(x) + '">' + esc(D.robotById[x] ? D.robotById[x].name : x) + "</a>"; }).join(", ") || null);
    }
    var links = (r.links || []).map(function (l) {
      return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener"><span class="lt">' + esc(l.type) + "</span> " + esc(l.title) + "</a>";
    }).join("");
    var srcs = (r.sources || []).map(function (s) {
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + "</a>";
    }).join(" · ");
    var im = imgFor(r.id);
    var full = ROOT + (isHand ? "hand/" : "robot/") + r.id + "/";

    $("panelIn").innerHTML =
      '<div class="ph"><div><h2>' + esc(r.name) + '</h2><div class="sub">' +
      (isHand ? "Robotic hand" : (D.eraById[r.era] ? esc(D.eraById[r.era].name) : "")) + " · " + esc(r.year_revealed) +
      '</div></div><button class="closebtn" id="pcls" type="button" aria-label="Close">×</button></div>' +
      (im ? '<div class="pimg"><img src="' + esc(im) + '" alt="' + esc(r.name) + '" loading="lazy"></div>' : "") +
      '<p class="summary">' + esc(r.summary) + "</p>" +
      '<dl class="specs">' + rows.join("") + "</dl>" +
      (r.notable && r.notable.length ? '<h4>Notable</h4><ul class="notable">' + r.notable.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") +
      (links ? '<h4>Links</h4><div class="linkrow">' + links + "</div>" : "") +
      (srcs ? '<h4>Sources</h4><div class="srcs">' + srcs + "</div>" : "") +
      '<a class="detail-full" href="' + full + '">Open the full page →</a>';

    $("pcls").addEventListener("click", function () { closeDetail(); });
    $("panelIn").querySelectorAll("[data-goto]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); openDetail(a.dataset.goto); });
    });
    $("panel").classList.add("open");
    $("panel").setAttribute("aria-hidden", "false");
    $("scrim").classList.add("open");
  }
  function closeDetail(silent) {
    if (!state.selected && silent) return;
    state.selected = null;
    if (!silent) writeHash();
    $("panel").classList.remove("open");
    $("panel").setAttribute("aria-hidden", "true");
    $("scrim").classList.remove("open");
    document.querySelectorAll('[data-id][aria-selected="true"]').forEach(function (el) { el.setAttribute("aria-selected", "false"); });
  }

  /* ---------- timeline: ribbon ---------- */
  function renderRibbon() {
    var host = $("ribbon"); if (!host) return;
    var SVGNS = "http://www.w3.org/2000/svg";
    var pre = D.robots.filter(function (r) { return r.year_revealed < 1970; });
    var Y0 = 1970, Y1 = 2027;
    var W = 1000, PL = 60, PR = 16, PT = 40, axisY = 210, H = 260;
    var plotW = W - PL - PR;
    function xV(yr) { return PL + ((yr - Y0) / (Y1 - Y0)) * plotW; }
    host.setAttribute("viewBox", "0 0 " + W + " " + H);
    host.innerHTML = "";
    function el(t, a, txt) { var e = document.createElementNS(SVGNS, t); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; }

    // era bands (only those with a real span on a 1970+ axis)
    ERA_ORDER.forEach(function (id) {
      var e = D.eraById[id];
      var s = Math.max(e.start == null ? Y0 : e.start, Y0);
      var en = Math.min(e.end == null ? 2027 : e.end, 2027);
      if (en - s < 1) return;
      var x0 = xV(s), x1 = xV(en);
      host.appendChild(el("rect", { x: x0, y: PT, width: (x1 - x0), height: axisY - PT, fill: eraColor(id), "fill-opacity": 0.08 }));
      host.appendChild(el("rect", { x: x0, y: axisY, width: (x1 - x0), height: 4, fill: eraColor(id) }));
      if (x1 - x0 > 46)
        host.appendChild(el("text", { x: x0 + 4, y: PT - 12, class: "r-era-label", "font-size": 9, fill: eraColor(id) }, ERA_SHORT[id].toUpperCase()));
    });
    // pre-1970 nub
    host.appendChild(el("text", { x: PL - 8, y: axisY + 4, "text-anchor": "end", "font-size": 9, fill: cssv("--ink-muted") }, "◀ " + pre.length + " pre-1970"));

    // axis ticks
    [1970, 1980, 1990, 2000, 2010, 2020, 2026].forEach(function (yr) {
      host.appendChild(el("line", { x1: xV(yr), x2: xV(yr), y1: axisY, y2: axisY + 6, stroke: cssv("--chart-axis") }));
      host.appendChild(el("text", { x: xV(yr), y: axisY + 18, "text-anchor": "middle", "font-size": 9.5, fill: cssv("--ink-muted") }, yr));
    });

    // robot dots, collision-stacked upward
    var lanes = {};
    D.robots.filter(function (r) { return r.year_revealed >= Y0; })
      .sort(function (a, b) { return a.year_revealed - b.year_revealed; })
      .forEach(function (r) {
        var col = Math.round(xV(r.year_revealed));
        var lane = lanes[col] = (lanes[col] || 0) + 1;
        var cy = axisY - 6 - (lane - 1) * 5.4;
        if (cy < PT + 4) return;
        var dot = el("rect", { x: xV(r.year_revealed) - 2, y: cy - 2, width: 4, height: 4, rx: 1, fill: eraColor(r.era), class: "r-dot" });
        dot.addEventListener("mousemove", function (ev) { HRI.charts.showTT(ev, esc(r.name) + "<br>" + r.year_revealed + " · " + esc(r.maker)); });
        dot.addEventListener("mouseleave", HRI.charts.hideTT);
        dot.addEventListener("click", function () { openDetail(r.id); });
        host.appendChild(dot);
      });

    // milestones as diamonds above the axis
    var msLane = {};
    D.milestones.forEach(function (m) {
      var yr = parseInt(String(m.date).slice(0, 4), 10);
      if (yr < Y0) return;
      var col = Math.round(xV(yr));
      var lane = msLane[col] = (msLane[col] || 0) + 1;
      var y = 20 + (lane - 1) * 9;
      var dm = el("path", { d: "M0,-4 L4,0 L0,4 L-4,0 Z", transform: "translate(" + xV(yr) + "," + y + ")", fill: cssv("--accent"), class: "r-ms" });
      dm.addEventListener("mousemove", function (ev) { HRI.charts.showTT(ev, m.date + " · " + esc(m.title)); });
      dm.addEventListener("mouseleave", HRI.charts.hideTT);
      dm.addEventListener("click", function () { go("milestones"); });
      host.appendChild(dm);
    });
  }

  /* ---------- timeline: reading list ---------- */
  function renderReading() {
    var host = $("timelinebody"); if (!host) return;
    var byEra = {};
    D.robots.forEach(function (r) { (byEra[r.era] = byEra[r.era] || []).push(r); });
    host.innerHTML = ERA_ORDER.map(function (id) {
      var e = D.eraById[id];
      var list = (byEra[id] || []).slice().sort(function (a, b) { return (a.year_revealed - b.year_revealed) || a.name.localeCompare(b.name); });
      var col = eraColor(id);
      var rng = (e.start == null ? "–" : e.start) + " – " + (e.end == null ? "now" : e.end);
      return '<div class="era-block"><div class="era-head" style="border-color:' + col + '"><h3>' + esc(e.name) +
        '</h3><span class="rng">' + rng + " · " + list.length + " robots</span></div>" +
        '<p class="esum">' + esc(e.summary) + "</p>" +
        '<div class="themes">' + (e.themes || []).map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") + "</div>" +
        list.map(function (r) {
          var im = imgFor(r.id);
          return '<div class="trow" data-id="' + esc(r.id) + '"><span class="yr">' + esc(r.year_revealed) + "</span>" +
            (im ? '<img class="tthumb" src="' + esc(im) + '" alt="" loading="lazy">' : '<span class="tslot"></span>') +
            '<span><span class="tn">' + esc(r.name) + ' <span class="tm">' + esc(r.maker) + "</span></span>" +
            '<span class="ts">' + esc((r.summary || "").split(". ")[0]) + ".</span></span></div>";
        }).join("") + "</div>";
    }).join("");
    host.querySelectorAll("[data-id]").forEach(function (el) { el.addEventListener("click", function () { openDetail(el.dataset.id); }); });
  }

  /* ---------- milestones ---------- */
  function renderMilestones() {
    var host = $("milestonebody"); if (!host) return;
    var ms = D.milestones.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    host.innerHTML = ms.map(function (m) {
      var chips = (m.robot_ids || []).map(function (id) {
        var r = D.robotById[id];
        return '<button type="button" data-goto="' + esc(id) + '">' + esc(r ? r.name : id) + "</button>";
      }).join("");
      return '<div class="ms"><div class="msd">' + esc(m.date) + '</div><div><div class="cat">' + esc(m.category) + "</div>" +
        "<h3>" + esc(m.title) + "</h3><p>" + esc(m.description) + "</p>" +
        '<p class="why"><b>Why it mattered</b> ' + esc(m.why_it_mattered) + "</p>" +
        (chips ? '<div class="rchips">' + chips + "</div>" : "") + "</div></div>";
    }).join("");
    host.querySelectorAll("[data-goto]").forEach(function (b) { b.addEventListener("click", function () { openDetail(b.dataset.goto); }); });
  }

  /* ---------- news ---------- */
  function applyCta(cta) {
    if (!cta) return;
    if (cta.dataset && cta.dataset !== state.dataset) { state.dataset = cta.dataset; state.sort = { key: "year_revealed", dir: 1 }; }
    if (cta.filters || cta.dataset) FKEYS.forEach(function (k) { if (k !== "q") state.filters[k] = ""; });
    if (cta.filters) Object.keys(cta.filters).forEach(function (k) { state.filters[k] = cta.filters[k]; });
    if (cta.sort) state.sort = { key: cta.sort, dir: (cta.sort === "name" || cta.sort === "country") ? 1 : -1 };
    state.view = VIEWS.indexOf(cta.view) >= 0 ? cta.view : "catalog";
    state.selected = null;
    writeHash(); render(); window.scrollTo(0, 0);
  }
  function renderNews() {
    var host = $("newsbody"); if (!host) return;
    var n = D.news || {};
    if (n.updated && $("news-updated")) $("news-updated").textContent = "Updated " + n.updated + ".";
    var ins = '<div class="news-sec"><h2>Insights</h2><div class="insights">' + (n.insights || []).map(function (it, i) {
      return '<div class="insight"><h3>' + esc(it.title) + "</h3><p>" + esc(it.body) + "</p>" +
        (it.cta ? '<button class="cta" type="button" data-cta="' + i + '">' + esc(it.cta.label) + " &rarr;</button>" : "") + "</div>";
    }).join("") + "</div></div>";
    var devs = (n.developments || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var dev = '<div class="news-sec"><h2>Recent developments</h2>' + devs.map(function (dv) {
      var s = (dv.sources || []).map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + "</a>"; }).join(" &middot; ");
      return '<div class="dev"><div class="dd">' + esc(dv.date) + '</div><div><h3>' + esc(dv.title) + "</h3><p>" + esc(dv.summary) + '</p><div class="dsrc">' + s + "</div></div></div>";
    }).join("") + "</div>";
    var fol = '<div class="news-sec"><h2>Follow the field</h2><div class="follow">' + (n.follow || []).map(function (f) {
      return '<a class="fitem" href="' + esc(f.url) + '" target="_blank" rel="noopener"><span class="fn">' + esc(f.name) + '</span><span class="fnote">' + esc(f.note) + "</span></a>";
    }).join("") + "</div></div>";
    host.innerHTML = ins + dev + fol;
    host.querySelectorAll("[data-cta]").forEach(function (b) {
      b.addEventListener("click", function () { applyCta((n.insights[+b.dataset.cta] || {}).cta); });
    });
  }

  /* ---------- analysis ---------- */
  function renderAnalysis() {
    var host = $("charts"); if (!host) return;
    var R = D.robots;
    var uniq = function (a) { return a.filter(function (v, i, r) { return r.indexOf(v) === i; }); };
    var stats = [
      [R.length, "robots catalogued"], [D.hands.length, "dexterous hands"],
      [uniq(R.map(function (r) { return r.country; })).length, "countries"],
      [uniq(R.map(function (r) { return r.maker; })).length, "distinct makers"],
      [R.filter(function (r) { return r.status === "commercial" || r.status === "limited-production"; }).length, "commercial / limited"],
      [R.filter(function (r) { return r.openness === "open-source" || r.openness === "partially-open"; }).length, "open or partly open"]
    ];
    $("statrow").innerHTML = stats.map(function (s) { return '<div class="stat"><div class="sv">' + s[0] + '</div><div class="sl">' + s[1] + "</div></div>"; }).join("");

    host.innerHTML = "";
    var c = HRI.charts;
    var b1 = c.box("Humanoids revealed per year", "Stacked by era. Excludes 4 pre-1970 entries.");
    b1.appendChild(c.revealedPerYear(R, {}));
    b1.appendChild(c.legendEl(ERA_ORDER.map(function (e) { return [D.eraById[e].name, eraColor(e)]; })));
    host.appendChild(b1);
    host.appendChild(c.actuationByEra(R));
    host.appendChild(c.scatter(R, "mass_kg", "Mass over time", "kg", cssv("--s1")));
    host.appendChild(c.scatter(R, "dof_total", "Total DOF over time", "DOF", cssv("--s2")));
    host.appendChild(c.priceOverTime(R));
    host.appendChild(c.byCountry(R));
  }

  /* nav links inside the app switch views without a reload */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-v]");
    if (a) { e.preventDefault(); go(a.dataset.v); }
  });
})();
