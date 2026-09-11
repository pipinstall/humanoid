/* The interactive explorer: catalog, timeline (ribbon + reading list),
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
    filters: { q: "", era: "", country: "", form_factor: "", openness: "", status: "", actuation: "", purpose: "" }
  };
  var writingHash = false;

  function fail(msg, err) {
    if (err && window.console) console.error(err);
    var b = $("catbody");
    if (b) b.innerHTML = '<p class="loadfail">' + msg + "</p>";
  }

  HRI.loadData().then(function (d) {
    /* Keep data failures and render failures apart — reporting a thrown
       render error as "could not load data" sends you hunting in the wrong
       place, which is exactly what happened once. */
    try {
      D = d;
      HRI.onThemeChange.push(function () { if (state.view === "analysis") renderAnalysis(); if (state.view === "timeline") renderRibbon(); });
      $("brandcount") && ($("brandcount").textContent = d.robots.length + " robots · " + d.hands.length + " hands");
      readHash();
      render();
      window.addEventListener("hashchange", function () {
        if (writingHash) { writingHash = false; return; }
        readHash(); render();
      });
    } catch (err) {
      fail("Something went wrong drawing this page. If you have used this site before, "
         + "a hard reload (⇧⌘R, or Ctrl-Shift-R) will clear a stale cached script.", err);
    }
  }).catch(function (err) {
    fail("Could not load the catalog data. Check your connection and reload.", err);
  });

  /* ---------- hash <-> state ---------- */
  function readHash() {
    var h = location.hash.replace(/^#\/?/, "");
    var qi = h.indexOf("?");
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var qs = qi >= 0 ? h.slice(qi + 1) : "";
    var seg = path.split("/");
    if ((seg[0] === "robot" || seg[0] === "hand") && seg[1]) {
      /* legacy deep link into the old slide-over — send it to the real page */
      location.replace(ROOT + seg[0] + "/" + seg[1] + "/");
      return;
    }
    if (VIEWS.indexOf(seg[0]) >= 0) state.view = seg[0];
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
    var path = state.view;
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
  }

  function go(view) { state.view = view; writeHash(); render(); window.scrollTo(0, 0); }

  /* ---------- catalog ---------- */
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
  function entryHref(id) { return ROOT + (D.handById[id] ? "hand/" : "robot/") + id + "/"; }

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
      return '<tr data-href="' + esc(entryHref(r.id)) + '">' + cols.map(function (c) {
        var v = r[c.key];
        if (c.cls === "name") {
          var im = imgFor(r.id);
          return '<td class="name">' + (im ? '<img class="thumb" src="' + esc(im) + '" alt="" loading="lazy">' : "") +
            '<a href="' + esc(entryHref(r.id)) + '">' + esc(v) + "</a></td>";
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
      return '<a class="card" href="' + esc(entryHref(r.id)) + '">' +
        (im ? '<div class="cimg"><img src="' + esc(im) + '" alt="" loading="lazy"></div>' : "") +
        '<div class="cbody"><div class="ct"><span class="cn">' + esc(r.name) + '</span><span class="cy">' + esc(r.year_revealed) + "</span></div>" +
        '<div class="cm">' + esc(r.maker) + " · " + esc(r.country) + "</div>" +
        (state.dataset === "robots" ? "<div>" + eraCell(r.era) + "</div>" : "") +
        '<div class="cspecs">' + specs.map(function (s) { return "<span>" + esc(titleCase(s)) + "</span>"; }).join("") + "</div></div></a>";
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
  /* whole table row is clickable, but the name is a real link so
     middle-click, ⌘-click and keyboard navigation all behave */
  function wireRowClicks() {
    document.querySelectorAll("#v-catalog tr[data-href]").forEach(function (tr) {
      tr.addEventListener("click", function (ev) {
        if (ev.target.closest("a")) return;
        location.href = tr.dataset.href;
      });
    });
  }

  /* ---------- entry navigation ----------
     Entries open as their own page rather than a slide-over: a real URL you
     can link, share and go Back from. Charts call HRI.openDetail. */
  HRI.openDetail = function (id) { location.href = entryHref(id); };

  /* ---------- timeline: ribbon ---------- */
  function renderRibbon() {
    var host = $("ribbon"); if (!host) return;
    var SVGNS = "http://www.w3.org/2000/svg";
    var Y0 = 1970, Y1 = 2027;
    var pre = D.robots.filter(function (r) { return r.year_revealed < Y0; });
    var shown = D.robots.filter(function (r) { return r.year_revealed >= Y0; });

    /* how tall does the tallest year get? size the ribbon to fit exactly. */
    var perYear = {};
    shown.forEach(function (r) { perYear[r.year_revealed] = (perYear[r.year_revealed] || 0) + 1; });
    var maxStack = Math.max.apply(null, Object.keys(perYear).map(function (k) { return perYear[k]; }));

    var DOT = 5, STEP = 5.8;
    var W = 1000, PL = 74, PR = 18;
    var MS_Y = 22;                          // center of the milestone lane (leaves
                                            // headroom for the count above it)
    var PT = MS_Y + 18;                     // top of the dot column area
    var plotH = Math.max(maxStack * STEP + 6, 60);
    var axisY = PT + plotH;
    var H = axisY + 44;                     // axis bar + era labels + year ticks
    var plotW = W - PL - PR;
    function xV(yr) { return PL + ((yr - Y0) / (Y1 - Y0)) * plotW; }

    host.setAttribute("viewBox", "0 0 " + W + " " + H);
    host.innerHTML = "";
    function el(t, a, txt) { var e = document.createElementNS(SVGNS, t); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; }

    /* baseline */
    host.appendChild(el("line", { x1: PL - 6, x2: W - PR, y1: axisY, y2: axisY, stroke: cssv("--chart-axis"), "stroke-width": 1 }));

    /* era spans: a color bar under the axis, label beneath it. No background
       wash — a robot sits in the era whose story it belongs to, which is not
       always its calendar year, and a tinted band would imply otherwise. */
    ERA_ORDER.forEach(function (id) {
      var e = D.eraById[id];
      var s = Math.max(e.start == null ? Y0 : e.start, Y0);
      var en = Math.min(e.end == null ? Y1 : e.end, Y1);
      if (en - s < 1) return;
      var x0 = xV(s), x1 = xV(en);
      host.appendChild(el("rect", { x: x0 + 0.5, y: axisY + 3, width: Math.max(x1 - x0 - 1, 1), height: 5, rx: 2.5, fill: eraColor(id) }));
      if (x1 - x0 > 54)
        host.appendChild(el("text", {
          x: x0 + 4, y: axisY + 21, class: "r-era-label", "font-size": 9, fill: eraColor(id)
        }, ERA_SHORT[id].toUpperCase()));
    });

    /* year ticks, below the era labels */
    [1970, 1980, 1990, 2000, 2010, 2020, 2026].forEach(function (yr) {
      host.appendChild(el("text", {
        x: xV(yr), y: axisY + 38, "text-anchor": "middle", "font-size": 9.5, fill: cssv("--ink-muted")
      }, yr));
    });

    /* the pre-1970 entries, parked off the left edge */
    if (pre.length) {
      host.appendChild(el("text", { x: PL - 12, y: axisY - 3, "text-anchor": "end", "font-size": 9.5, fill: cssv("--ink-muted") }, "◀ " + pre.length + " pre-1970"));
    }

    /* one dot per robot, stacked upward within its year */
    var lanes = {};
    shown.slice().sort(function (a, b) { return a.year_revealed - b.year_revealed; }).forEach(function (r) {
      var yr = r.year_revealed;
      var lane = lanes[yr] = (lanes[yr] || 0) + 1;
      var cy = axisY - 4 - (lane - 1) * STEP;
      var dot = el("rect", {
        x: (xV(yr) - DOT / 2).toFixed(2), y: (cy - DOT / 2).toFixed(2),
        width: DOT, height: DOT, rx: 1.5, fill: eraColor(r.era), class: "r-dot"
      });
      dot.addEventListener("mousemove", function (ev) {
        HRI.charts.showTT(ev, "<b>" + esc(r.name) + "</b><br>" + yr + " · " + esc(r.maker));
      });
      dot.addEventListener("mouseleave", HRI.charts.hideTT);
      dot.addEventListener("click", function () { location.href = entryHref(r.id); });
      host.appendChild(dot);
    });

    /* Milestones: ONE amber diamond per year in a lane at the top, tied to its
       year by a hairline running down to the top of that year's dot stack.

       Two things were wrong before. Extra milestones in the same year stacked
       *upward* at 8px a step, so 2024 — which has four — put three of them at
       y = 2, -6 and -14: one clipped in half by the viewBox edge and two drawn
       entirely outside it. And with the plot now sized to the tallest year, the
       lane sits ~250px clear of everything else, so a lone diamond up there
       read as a stray mark rather than as an event at a point on the axis. */
    var msByYear = {};
    D.milestones.forEach(function (m) {
      var yr = parseInt(String(m.date).slice(0, 4), 10);
      if (yr < Y0) return;
      (msByYear[yr] = msByYear[yr] || []).push(m);
    });

    if (Object.keys(msByYear).length)
      host.appendChild(el("text", {
        x: PL - 12, y: MS_Y + 3.5, "text-anchor": "end", "font-size": 9.5, fill: cssv("--accent")
      }, "milestones"));

    Object.keys(msByYear).forEach(function (k) {
      var yr = +k, list = msByYear[k], x = xV(yr);

      /* stop the leader line at the top of the stack, not through it */
      var n = perYear[yr] || 0;
      var stackTop = n ? axisY - 6.5 - (n - 1) * STEP : axisY - 2;
      if (stackTop - 5 > MS_Y + 7)
        host.appendChild(el("line", {
          x1: x.toFixed(2), x2: x.toFixed(2), y1: MS_Y + 7, y2: (stackTop - 5).toFixed(2),
          stroke: cssv("--accent"), "stroke-width": 1, "stroke-dasharray": "2 3",
          opacity: 0.3, class: "r-msline"
        }));

      var g = el("g", { class: "r-ms" });
      g.appendChild(el("path", {
        d: "M0,-4 L4,0 L0,4 L-4,0 Z",
        transform: "translate(" + x.toFixed(2) + "," + MS_Y + ")", fill: cssv("--accent")
      }));
      /* count sits centered ABOVE the diamond: to its right it collides with
         the next year's diamond, and consecutive years are only ~16px apart. */
      if (list.length > 1)
        g.appendChild(el("text", {
          x: x.toFixed(2), y: MS_Y - 7.5, "text-anchor": "middle",
          "font-size": 9, "font-weight": "600", fill: cssv("--accent")
        }, list.length));

      var tip = list.map(function (m) {
        return "<b>" + esc(String(m.date)) + "</b> " + esc(m.title);
      }).join("<br>");
      g.addEventListener("mousemove", function (ev) { HRI.charts.showTT(ev, tip); });
      g.addEventListener("mouseleave", HRI.charts.hideTT);
      g.addEventListener("click", function () { HRI.charts.hideTT(); openMilestoneYear(yr); });
      host.appendChild(g);
    });
  }

  /* Jump from a ribbon diamond to that year's entries in the milestones list. */
  function openMilestoneYear(yr) {
    go("milestones");
    setTimeout(function () {
      var t = document.querySelector('#milestonebody .ms[data-year="' + yr + '"]');
      if (!t) return;
      t.scrollIntoView({ block: "center" });
      t.classList.add("ms-flash");
      setTimeout(function () { t.classList.remove("ms-flash"); }, 1600);
    }, 0);
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
          return '<a class="trow" href="' + esc(entryHref(r.id)) + '"><span class="yr">' + esc(r.year_revealed) + "</span>" +
            (im ? '<img class="tthumb" src="' + esc(im) + '" alt="" loading="lazy">' : '<span class="tslot"></span>') +
            '<span><span class="tn">' + esc(r.name) + ' <span class="tm">' + esc(r.maker) + "</span></span>" +
            '<span class="ts">' + esc((r.summary || "").split(". ")[0]) + ".</span></span></a>";
        }).join("") + "</div>";
    }).join("");

  }

  /* ---------- milestones ---------- */
  function renderMilestones() {
    var host = $("milestonebody"); if (!host) return;
    var ms = D.milestones.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    host.innerHTML = ms.map(function (m) {
      var chips = (m.robot_ids || []).map(function (id) {
        var r = D.robotById[id];
        return '<a href="' + esc(entryHref(id)) + '">' + esc(r ? r.name : id) + "</a>";
      }).join("");
      return '<div class="ms" data-year="' + esc(String(m.date).slice(0, 4)) + '"><div class="msd">' +
        esc(m.date) + '</div><div><div class="cat">' + esc(m.category) + "</div>" +
        "<h3>" + esc(m.title) + "</h3><p>" + esc(m.description) + "</p>" +
        '<p class="why"><b>Why it mattered</b> ' + esc(m.why_it_mattered) + "</p>" +
        (chips ? '<div class="rchips">' + chips + "</div>" : "") + "</div></div>";
    }).join("");

  }

  /* ---------- news ---------- */
  function applyCta(cta) {
    if (!cta) return;
    if (cta.dataset && cta.dataset !== state.dataset) { state.dataset = cta.dataset; state.sort = { key: "year_revealed", dir: 1 }; }
    if (cta.filters || cta.dataset) FKEYS.forEach(function (k) { if (k !== "q") state.filters[k] = ""; });
    if (cta.filters) Object.keys(cta.filters).forEach(function (k) { state.filters[k] = cta.filters[k]; });
    if (cta.sort) state.sort = { key: cta.sort, dir: (cta.sort === "name" || cta.sort === "country") ? 1 : -1 };
    state.view = VIEWS.indexOf(cta.view) >= 0 ? cta.view : "catalog";
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
      [R.length, "robots cataloged"], [D.hands.length, "dexterous hands"],
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
