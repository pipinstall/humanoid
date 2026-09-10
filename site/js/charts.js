/* SVG chart builders. Depends on window.HRI (util.js). Sets HRI.charts. */
(function () {
  "use strict";
  var HRI = window.HRI;
  var esc = HRI.esc, titleCase = HRI.titleCase, cssv = HRI.cssv, eraColor = HRI.eraColor;
  var ERA_ORDER = HRI.ERA_ORDER, ERA_SHORT = HRI.ERA_SHORT;
  var SVGNS = "http://www.w3.org/2000/svg";
  var YMIN = 1970, YMAX = 2026;

  function tt() {
    var el = document.getElementById("tt");
    if (!el) { el = document.createElement("div"); el.id = "tt"; document.body.appendChild(el); }
    return el;
  }
  function showTT(evt, html) {
    var el = tt();
    el.innerHTML = html; el.style.opacity = "1";
    var x = evt.clientX + 14, y = evt.clientY + 14;
    if (x + 250 > innerWidth) x = evt.clientX - el.offsetWidth - 14;
    if (y + 60 > innerHeight) y = evt.clientY - el.offsetHeight - 14;
    el.style.left = x + "px"; el.style.top = y + "px";
  }
  function hideTT() { tt().style.opacity = "0"; }

  function mk(tag, attrs, txt) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (txt != null) e.textContent = txt;
    return e;
  }
  function svgEl(w, h) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", "0 0 " + w + " " + h);
    s.setAttribute("role", "img");
    return s;
  }
  function box(title, sub) {
    var d = document.createElement("div");
    d.className = "chartbox";
    d.innerHTML = "<h3>" + esc(title) + "</h3><div class=\"csub\">" + esc(sub) + "</div>";
    return d;
  }
  function legendEl(pairs) {
    var l = document.createElement("div");
    l.className = "legend";
    l.innerHTML = pairs.map(function (p) {
      return '<span><i style="background:' + p[1] + '"></i>' + esc(p[0]) + "</span>";
    }).join("");
    return l;
  }

  /* revealed per year, stacked by era. opts: {W,H,animate,big} */
  function revealedPerYear(R, opts) {
    opts = opts || {};
    var W = opts.W || 520, H = opts.H || 300;
    var PL = 34, PR = 8, PT = 12, PB = 34;
    var years = [], y;
    for (y = YMIN; y <= YMAX; y++) years.push(y);
    var data = {}, stackMax = 0;
    years.forEach(function (yr) { data[yr] = {}; ERA_ORDER.forEach(function (e) { data[yr][e] = 0; }); });
    R.forEach(function (r) {
      if (r.year_revealed >= YMIN && r.year_revealed <= YMAX) data[r.year_revealed][r.era]++;
    });
    years.forEach(function (yr) {
      var t = ERA_ORDER.reduce(function (a, e) { return a + data[yr][e]; }, 0);
      if (t > stackMax) stackMax = t;
    });
    var svg = svgEl(W, H);
    var plotW = W - PL - PR, plotH = H - PT - PB, bw = plotW / years.length;
    function yV(v) { return PT + plotH - (v / stackMax) * plotH; }
    [0, Math.ceil(stackMax / 2), stackMax].forEach(function (v) {
      svg.appendChild(mk("line", { x1: PL, x2: W - PR, y1: yV(v), y2: yV(v), stroke: cssv("--chart-grid"), "stroke-width": 1 }));
      svg.appendChild(mk("text", { x: PL - 6, y: yV(v) + 3, "text-anchor": "end", "font-size": 10, fill: cssv("--ink-muted") }, v));
    });
    years.forEach(function (yr, i) {
      var acc = 0;
      ERA_ORDER.forEach(function (e) {
        var c = data[yr][e]; if (!c) return;
        var y0 = yV(acc), y1 = yV(acc + c);
        var rect = mk("rect", {
          x: (PL + i * bw + 0.4).toFixed(2), width: Math.max(bw - 0.8, 0.8).toFixed(2),
          y: y1.toFixed(2), height: Math.max(y0 - y1 - 1, 0.6).toFixed(2), fill: eraColor(e), rx: 1
        });
        rect.addEventListener("mousemove", function (ev) {
          showTT(ev, yr + " &middot; " + HRI._data.eraById[e].name + "<br>" + c + " revealed");
        });
        rect.addEventListener("mouseleave", hideTT);
        svg.appendChild(rect);
        acc += c;
      });
    });
    [1970, 1985, 2000, 2015, 2026].forEach(function (yr) {
      var i = yr - YMIN;
      svg.appendChild(mk("text", { x: PL + i * bw + bw / 2, y: H - PB + 16, "text-anchor": "middle", "font-size": 10, fill: cssv("--ink-muted") }, yr));
    });
    return svg;
  }

  function actuationByEra(R) {
    var d = box("Actuation mix by era", "Share of robots with a stated actuation type.");
    var cats = ["electric", "hydraulic", "pneumatic", "mixed"];
    var colors = [cssv("--s1"), cssv("--s2"), cssv("--s3"), cssv("--s4")];
    var W = 520, H = 300, PL = 34, PR = 8, PT = 12, PB = 44;
    var svg = svgEl(W, H), plotW = W - PL - PR, plotH = H - PT - PB, bw = plotW / ERA_ORDER.length;
    [0, 50, 100].forEach(function (v) {
      var yy = PT + plotH - (v / 100) * plotH;
      svg.appendChild(mk("line", { x1: PL, x2: W - PR, y1: yy, y2: yy, stroke: cssv("--chart-grid"), "stroke-width": 1 }));
      svg.appendChild(mk("text", { x: PL - 6, y: yy + 3, "text-anchor": "end", "font-size": 10, fill: cssv("--ink-muted") }, v + "%"));
    });
    ERA_ORDER.forEach(function (eid, i) {
      var subset = R.filter(function (r) { return r.era === eid && r.actuation; });
      var counts = cats.map(function (c) { return subset.filter(function (r) { return r.actuation === c; }).length; });
      var tot = counts.reduce(function (a, b) { return a + b; }, 0) || 1, acc = 0;
      counts.forEach(function (c, ci) {
        if (!c) return;
        var frac = c / tot;
        var y0 = PT + plotH - acc * plotH, y1 = PT + plotH - (acc + frac) * plotH;
        var rect = mk("rect", {
          x: PL + i * bw + bw * 0.17, width: bw * 0.66,
          y: y1.toFixed(2), height: Math.max(y0 - y1 - 1, 0.6).toFixed(2), fill: colors[ci], rx: 1
        });
        rect.addEventListener("mousemove", function (ev) {
          showTT(ev, HRI._data.eraById[eid].name + "<br>" + titleCase(cats[ci]) + ": " + c + " of " + tot + " (" + Math.round(frac * 100) + "%)");
        });
        rect.addEventListener("mouseleave", hideTT);
        svg.appendChild(rect);
        acc += frac;
      });
      svg.appendChild(mk("text", { x: PL + i * bw + bw / 2, y: H - PB + 14, "text-anchor": "middle", "font-size": 9.5, fill: cssv("--ink-muted") }, ERA_SHORT[eid]));
    });
    d.appendChild(svg);
    d.appendChild(legendEl(cats.map(function (c, i) { return [titleCase(c), colors[i]]; })));
    return d;
  }

  function scatter(R, key, title, unit, color) {
    var pts = R.filter(function (r) { return r[key] != null && r.year_revealed >= YMIN; });
    var d = box(title, pts.length + " robots with a stated figure. Hover a point.");
    var W = 520, H = 300, PL = 42, PR = 12, PT = 14, PB = 30;
    var svg = svgEl(W, H), plotW = W - PL - PR, plotH = H - PT - PB;
    var vmax = Math.max.apply(null, pts.map(function (r) { return r[key]; }));
    var step = vmax > 400 ? 100 : 50;
    vmax = Math.ceil(vmax / step) * step;
    function xV(yr) { return PL + ((yr - YMIN) / (YMAX - YMIN)) * plotW; }
    function yV(v) { return PT + plotH - (v / vmax) * plotH; }
    for (var g = 0; g <= vmax; g += step) {
      svg.appendChild(mk("line", { x1: PL, x2: W - PR, y1: yV(g), y2: yV(g), stroke: cssv("--chart-grid"), "stroke-width": 1 }));
      svg.appendChild(mk("text", { x: PL - 6, y: yV(g) + 3, "text-anchor": "end", "font-size": 10, fill: cssv("--ink-muted") }, g));
    }
    [1970, 1985, 2000, 2015, 2026].forEach(function (yr) {
      svg.appendChild(mk("text", { x: xV(yr), y: H - PB + 16, "text-anchor": "middle", "font-size": 10, fill: cssv("--ink-muted") }, yr));
    });
    pts.forEach(function (r) {
      var c = mk("circle", {
        cx: xV(r.year_revealed).toFixed(2), cy: yV(r[key]).toFixed(2), r: 3.4,
        fill: color, "fill-opacity": 0.7, stroke: cssv("--surface"), "stroke-width": 1
      });
      c.style.cursor = "pointer";
      c.addEventListener("mousemove", function (ev) { showTT(ev, esc(r.name) + "<br>" + r.year_revealed + " &middot; " + r[key] + " " + unit); });
      c.addEventListener("mouseleave", hideTT);
      c.addEventListener("click", function () { if (HRI.openDetail) HRI.openDetail(r.id); });
      svg.appendChild(c);
    });
    d.appendChild(svg);
    return d;
  }

  function byCountry(R) {
    var by = {};
    R.forEach(function (r) { by[r.country] = (by[r.country] || 0) + 1; });
    var rows = Object.keys(by).map(function (k) { return [k, by[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
    var d = box("Robots by country of origin", "Top 12. Where the machine was designed and built.");
    var W = 520, rowH = 20, PT = 6, PB = 4, PL = 116, PR = 34;
    var H = PT + PB + rows.length * rowH;
    var svg = svgEl(W, H);
    var max = rows[0][1], plotW = W - PL - PR;
    rows.forEach(function (row, i) {
      var yy = PT + i * rowH;
      svg.appendChild(mk("text", { x: PL - 8, y: yy + rowH / 2 + 3, "text-anchor": "end", "font-size": 11, fill: cssv("--ink-2") }, row[0]));
      var w = (row[1] / max) * plotW;
      var rect = mk("rect", { x: PL, y: yy + 3, width: w.toFixed(1), height: rowH - 8, fill: cssv("--s1"), rx: 2 });
      rect.addEventListener("mousemove", function (ev) { showTT(ev, esc(row[0]) + "<br>" + row[1] + " robots"); });
      rect.addEventListener("mouseleave", hideTT);
      svg.appendChild(rect);
      svg.appendChild(mk("text", { x: PL + w + 6, y: yy + rowH / 2 + 3, "font-size": 10, fill: cssv("--ink-muted") }, row[1]));
    });
    d.appendChild(svg);
    return d;
  }

  function priceOverTime(R) {
    var pts = R.filter(function (r) { return r.price_usd != null; });
    var d = box("Advertised price over time", pts.length + " robots with a public price. Log scale (USD).");
    var W = 520, H = 300, PL = 52, PR = 12, PT = 14, PB = 30;
    var svg = svgEl(W, H), plotW = W - PL - PR, plotH = H - PT - PB;
    var lmin = 3, lmax = 6; /* $1k .. $1M */
    function xV(yr) { return PL + ((yr - 2015) / (YMAX - 2015)) * plotW; }
    function yV(v) { return PT + plotH - ((Math.log10(v) - lmin) / (lmax - lmin)) * plotH; }
    [1000, 10000, 100000, 1000000].forEach(function (g) {
      svg.appendChild(mk("line", { x1: PL, x2: W - PR, y1: yV(g), y2: yV(g), stroke: cssv("--chart-grid"), "stroke-width": 1 }));
      svg.appendChild(mk("text", { x: PL - 6, y: yV(g) + 3, "text-anchor": "end", "font-size": 10, fill: cssv("--ink-muted") }, "$" + (g >= 1e6 ? "1M" : (g / 1000) + "k")));
    });
    [2016, 2020, 2024, 2026].forEach(function (yr) {
      svg.appendChild(mk("text", { x: xV(yr), y: H - PB + 16, "text-anchor": "middle", "font-size": 10, fill: cssv("--ink-muted") }, yr));
    });
    pts.forEach(function (r) {
      var c = mk("circle", {
        cx: xV(r.year_revealed).toFixed(2), cy: yV(r.price_usd).toFixed(2), r: 3.8,
        fill: cssv("--s2"), "fill-opacity": 0.75, stroke: cssv("--surface"), "stroke-width": 1
      });
      c.style.cursor = "pointer";
      c.addEventListener("mousemove", function (ev) { showTT(ev, esc(r.name) + "<br>" + r.year_revealed + " &middot; $" + r.price_usd.toLocaleString()); });
      c.addEventListener("mouseleave", hideTT);
      c.addEventListener("click", function () { if (HRI.openDetail) HRI.openDetail(r.id); });
      svg.appendChild(c);
    });
    d.appendChild(svg);
    return d;
  }

  HRI.charts = {
    revealedPerYear: revealedPerYear, actuationByEra: actuationByEra, scatter: scatter,
    byCountry: byCountry, priceOverTime: priceOverTime, legendEl: legendEl, box: box,
    showTT: showTT, hideTT: hideTT
  };
})();
