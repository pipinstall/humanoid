/* The network view. Two layouts of the same catalog, drawn on one canvas:
     3D cloud — the hierarchy index → era → maker → robot (or pulled onto a
                ring of reveal years), orbit / zoom / fly-to camera;
     2D map   — robots placed beside the robots they most resemble, with
                density contours.
   Force layouts are computed here, seeded so they come out the same on every
   load. Canvas 2D, no dependencies. Depends on util.js. */
(function () {
  "use strict";
  var HRI = window.HRI;
  var esc = HRI.esc, titleCase = HRI.titleCase, cssv = HRI.cssv;
  var ERA_ORDER = HRI.ERA_ORDER;
  var ROOT = window.HRI_ROOT || "";
  var $ = function (id) { return document.getElementById(id); };

  var REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var TYPE_ORDER = { root: 0, era: 1, maker: 2, robot: 3, year: 4 };
  var TYPE_NAME = { root: "Index", era: "Era", maker: "Maker", robot: "Robot", year: "Year" };
  var LEGEND = ["root", "era", "maker", "robot", "year"];
  /* world-space radius per type; makers also grow with their robot count */
  var RADIUS = { root: 8, era: 5.2, maker: 2.6, robot: 2.2, year: 1.9 };
  var PHOTO_R = 5;

  var C = {};   // colors, read from tokens.css
  var G = { nodes: [], byId: {}, links: [], anchors: [], years: [], R: 300 };
  var S = {
    view: "cloud", group: "hierarchy", ff: "", y0: 0, y1: 0,
    sel: null, hover: null, preview: null, q: "",
    muted: false, onscreen: true, lastInput: 0
  };
  var D = null;

  /* ---------- seeded randomness: the same layout on every load ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ffName(v) { return titleCase(String(v).replace(/-/g, " ")); }

  /* ================= graph ================= */

  function addNode(id, type, name, data) {
    var n = {
      id: id, type: type, name: name, data: data || null,
      parents: [], children: [], links: [],
      x: 0, y: 0, z: 0, a: 1, vis: true,
      sx: 0, sy: 0, sr: 0, da: 0, depth: 0
    };
    G.nodes.push(n); G.byId[id] = n;
    return n;
  }
  function addLink(p, c) {
    var r = rng(hash(p.id + ">" + c.id));
    /* a fixed random direction per link bends it into a 3D curve */
    var u = r() * 2 - 1, th = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
    var l = { s: p, t: c, ox: q * Math.cos(th), oy: q * Math.sin(th), oz: u };
    G.links.push(l); p.children.push(c); c.parents.push(p); p.links.push(l); c.links.push(l);
    return l;
  }

  function buildGraph(d) {
    var robots = d.robots.slice().sort(function (a, b) {
      return a.year_revealed - b.year_revealed || String(a.name).localeCompare(b.name);
    });
    var root = addNode("root", "root", "Humanoid Robot Index");
    root.hay = "";
    ERA_ORDER.forEach(function (eid) {
      var e = d.eraById[eid];
      if (!e) return;
      var n = addNode("era/" + eid, "era", e.name, e);
      n.hay = (e.summary || "").toLowerCase();
      addLink(root, n);
    });
    var makers = {};
    robots.forEach(function (r) {
      var m = makers[r.maker];
      if (!m) {
        m = makers[r.maker] = addNode("maker/" + slug(r.maker), "maker", r.maker,
          { country: r.country, maker_type: r.maker_type, robots: [], eras: {} });
        m.hay = (r.country || "").toLowerCase();
      }
      m.data.robots.push(r);
      if (!m.data.eras[r.era]) {
        m.data.eras[r.era] = true;
        var en = G.byId["era/" + r.era];
        if (en) addLink(en, m);
      }
      var n = addNode("robot/" + r.id, "robot", r.name, r);
      n.year = r.year_revealed;
      n.photo = (d.images || {})[r.id] || null;
      n.hay = [r.maker, r.country, r.summary].join(" ").toLowerCase();
      addLink(m, n);
    });
    G.nodes.forEach(function (n) {
      if (n.type === "maker") {
        var ys = n.data.robots.map(function (r) { return r.year_revealed; });
        n.yMin = Math.min.apply(null, ys); n.yMax = Math.max.apply(null, ys);
        n.rad = RADIUS.maker + 0.6 * Math.sqrt(n.data.robots.length);
      } else {
        n.rad = RADIUS[n.type];
      }
    });
    var ys = {};
    robots.forEach(function (r) { ys[r.year_revealed] = (ys[r.year_revealed] || 0) + 1; });
    G.years = Object.keys(ys).map(Number).sort(function (a, b) { return a - b; });
    G.robots = G.nodes.filter(function (n) { return n.type === "robot"; });
  }

  /* ================= force layout =================
     The d3-force model (velocity Verlet, cooling alpha, link bias by degree,
     n-body charge) — plain O(n²) charge, fine at a few hundred nodes. */
  function simulate(ns, ls, o) {
    var n = ns.length, dim = o.dim || 3, iters = o.iters || 300;
    var X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n);
    var VX = new Float64Array(n), VY = new Float64Array(n), VZ = new Float64Array(n);
    var Q = new Float64Array(n), F = new Uint8Array(n), idx = new Map();
    ns.forEach(function (d, i) {
      idx.set(d, i); X[i] = d.x; Y[i] = d.y; Z[i] = dim === 3 ? d.z : 0;
      Q[i] = o.charge(d); F[i] = d.fixed ? 1 : 0;
    });
    var cnt = new Float64Array(n);
    var L = ls.map(function (l) {
      var a = idx.get(l.s), b = idx.get(l.t);
      cnt[a]++; cnt[b]++;
      return { a: a, b: b, d: l.d, k: l.k };
    });
    L.forEach(function (l) {
      l.bias = cnt[l.a] / (cnt[l.a] + cnt[l.b]);
      if (l.k == null) l.k = 1 / Math.min(cnt[l.a], cnt[l.b]);
    });
    var alpha = 1, decay = 1 - Math.pow(0.001, 1 / iters), vd = 0.6, grav = o.gravity || 0;
    for (var it = 0; it < iters; it++) {
      alpha += -alpha * decay;
      for (var j = 0; j < L.length; j++) {
        var l = L[j], s = l.a, t = l.b;
        var dx = X[t] + VX[t] - X[s] - VX[s], dy = Y[t] + VY[t] - Y[s] - VY[s];
        var dz = dim === 3 ? Z[t] + VZ[t] - Z[s] - VZ[s] : 0;
        var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        var f = (len - l.d) / len * alpha * l.k;
        dx *= f; dy *= f; dz *= f;
        VX[t] -= dx * l.bias; VY[t] -= dy * l.bias; VZ[t] -= dz * l.bias;
        VX[s] += dx * (1 - l.bias); VY[s] += dy * (1 - l.bias); VZ[s] += dz * (1 - l.bias);
      }
      for (var a = 0; a < n; a++) {
        for (var b = a + 1; b < n; b++) {
          var ex = X[b] - X[a], ey = Y[b] - Y[a], ez = dim === 3 ? Z[b] - Z[a] : 0;
          var d2 = ex * ex + ey * ey + ez * ez;
          if (d2 < 1) d2 = 1;
          var wa = Q[b] * alpha / d2, wb = Q[a] * alpha / d2;
          VX[a] += ex * wa; VY[a] += ey * wa; VZ[a] += ez * wa;
          VX[b] -= ex * wb; VY[b] -= ey * wb; VZ[b] -= ez * wb;
        }
      }
      for (var i = 0; i < n; i++) {
        if (F[i]) { VX[i] = VY[i] = VZ[i] = 0; continue; }
        if (grav) { VX[i] -= X[i] * grav * alpha; VY[i] -= Y[i] * grav * alpha; VZ[i] -= Z[i] * grav * alpha; }
        X[i] += (VX[i] *= vd); Y[i] += (VY[i] *= vd);
        if (dim === 3) Z[i] += (VZ[i] *= vd);
      }
    }
    ns.forEach(function (d, i) { d.x = X[i]; d.y = Y[i]; d.z = dim === 3 ? Z[i] : 0; });
  }

  function layoutHierarchy() {
    var r = rng(7), eras = G.nodes.filter(function (n) { return n.type === "era"; });
    var tmp = G.nodes.map(function (n) { return { ref: n, x: 0, y: 0, z: 0, fixed: n.type === "root" }; });
    var by = new Map(); tmp.forEach(function (t) { by.set(t.ref, t); });
    /* eras are pinned on a tilted ring around the index, clockwise in
       chronological order from the top, set back by their size so the big
       bursts get room; everything else starts near its parent */
    eras.forEach(function (e, i) {
      var size = G.robots.filter(function (n) { return n.data.era === e.data.id; }).length;
      var th = -Math.PI / 2 + i / eras.length * Math.PI * 2, rr = 95 + 10 * Math.sqrt(size);
      var t = by.get(e);
      t.x = Math.cos(th) * rr; t.y = Math.sin(th) * rr; t.z = (i % 2 ? 1 : -1) * rr * 0.3; t.fixed = true;
    });
    ["maker", "robot"].forEach(function (type) {
      tmp.forEach(function (t) {
        if (t.ref.type !== type) return;
        var ps = t.ref.parents.map(function (p) { return by.get(p); }), k = ps.length;
        ps.forEach(function (p) { t.x += p.x / k; t.y += p.y / k; t.z += p.z / k; });
        var sp = type === "maker" ? 40 : 14;
        t.x += (r() - 0.5) * sp; t.y += (r() - 0.5) * sp; t.z += (r() - 0.5) * sp;
      });
    });
    var LEN = { era: 150, maker: 50, robot: 19 };
    var ls = G.links.map(function (l) {
      return { s: by.get(l.s), t: by.get(l.t), d: LEN[l.t.type] + (l.t.type === "maker" ? l.t.rad * 2 : 0) };
    });
    var Q = { root: -320, era: -320, maker: -60, robot: -22 };
    simulate(tmp, ls, { dim: 3, iters: 320, charge: function (t) { return Q[t.ref.type]; } });
    /* frame on the 95th-percentile radius so one far-flung node can't shrink the view */
    var rs = tmp.map(function (t) {
      t.ref.hx = t.x; t.ref.hy = t.y; t.ref.hz = t.z;
      return Math.sqrt(t.x * t.x + t.y * t.y + t.z * t.z);
    }).sort(function (a, b) { return a - b; });
    G.R = rs[Math.floor(rs.length * 0.95)] || 300;
  }

  function layoutYears() {
    var R = G.R * 1.08, ny = G.years.length;
    G.anchors = G.years.map(function (y, i) {
      /* a ring facing the default camera, earliest year at the top-left */
      var th = -Math.PI * 0.62 + i / ny * Math.PI * 2;
      var count = G.robots.filter(function (n) { return n.year === y; }).length;
      return {
        id: "year/" + y, type: "year", name: String(y), year: y, count: count,
        x: Math.cos(th) * R, y: Math.sin(th) * R, z: 0, gx: Math.cos(th) * R, gy: Math.sin(th) * R, gz: 0,
        rad: RADIUS.year, a: 1, vis: true, sx: 0, sy: 0, sr: 0, da: 0, depth: 0, parents: [], children: [], links: []
      };
    });
    var aBy = {}; G.anchors.forEach(function (a) { aBy[a.year] = a; });
    var tmp = G.nodes.map(function (n) {
      return { ref: n, x: n.hx * 0.7, y: n.hy * 0.7, z: n.hz * 0.7, fixed: n.type === "root" };
    });
    var by = new Map(); tmp.forEach(function (t) { by.set(t.ref, t); });
    var at = G.anchors.map(function (a) { return { ref: a, x: a.x, y: a.y, z: 0, fixed: true }; });
    var ls = G.links.map(function (l) {
      return { s: by.get(l.s), t: by.get(l.t), d: l.t.type === "robot" ? 18 : 40, k: 0.06 };
    });
    G.robots.forEach(function (n, i) {
      ls.push({ s: at[G.anchors.indexOf(aBy[n.year])], t: by.get(n), d: 10, k: 0.35 });
    });
    var Q = { root: -60, era: -60, maker: -22, robot: -12, year: 0 };
    simulate(tmp.concat(at), ls, { dim: 3, iters: 300, charge: function (t) { return Q[t.ref.type]; } });
    tmp.forEach(function (t) { t.ref.gx = t.x; t.ref.gy = t.y; t.ref.gz = t.z * 0.5; });
  }

  /* 2D similarity map: cosine similarity over weighted attributes plus year
     proximity; each robot links to its nearest neighbours, a 2D force layout
     turns that neighbour graph into islands. */
  function features(r) {
    var f = {};
    f["ff:" + r.form_factor] = 3;
    f["era:" + r.era] = 1.4;
    var ps = r.purpose || [];
    ps.forEach(function (p) { f["p:" + p] = 1.3 / Math.sqrt(ps.length); });
    if (r.actuation) f["act:" + r.actuation] = 0.8;
    f["open:" + r.openness] = 0.7;
    f["mt:" + r.maker_type] = 0.6;
    if (r.hands) f["hands:" + r.hands] = 0.6;
    if (r.power) f["pow:" + r.power] = 0.4;
    f["st:" + r.status] = 0.4;
    f["mk:" + r.maker] = 1.1;
    f["c:" + r.country] = 0.6;
    var nn = 0;
    for (var k in f) nn += f[k] * f[k];
    return { f: f, n: Math.sqrt(nn) };
  }
  function similarity(a, b, ya, yb) {
    var dot = 0;
    for (var k in a.f) if (b.f[k]) dot += a.f[k] * b.f[k];
    return dot / (a.n * b.n) + 0.25 * Math.exp(-Math.abs(ya - yb) / 5);
  }

  function layoutMap() {
    var rs = G.robots, n = rs.length, r = rng(11), K = 5;
    var fv = rs.map(function (x) { return features(x.data); });
    var seen = {}, ls = [];
    rs.forEach(function (x, i) {
      var sims = [];
      for (var j = 0; j < n; j++) if (j !== i) sims.push([similarity(fv[i], fv[j], x.year, rs[j].year), j]);
      sims.sort(function (p, q) { return q[0] - p[0]; });
      x.similar = sims.slice(0, K).map(function (p) { return rs[p[1]]; });
      x.similar.forEach(function (y) {
        var key = i < rs.indexOf(y) ? x.id + "|" + y.id : y.id + "|" + x.id;
        if (!seen[key]) { seen[key] = 1; ls.push({ s: x, t: y }); }
      });
    });
    var tmp = rs.map(function (x) {
      var th = r() * Math.PI * 2, rad = 60 + r() * 140;
      return { ref: x, x: Math.cos(th) * rad, y: Math.sin(th) * rad, z: 0 };
    });
    var by = new Map(); tmp.forEach(function (t) { by.set(t.ref, t); });
    simulate(tmp, ls.map(function (l) { return { s: by.get(l.s), t: by.get(l.t), d: 15 }; }),
      { dim: 2, iters: 420, gravity: 0.035, charge: function () { return -26; } });
    tmp.forEach(function (t) { t.ref.mx = t.x; t.ref.my = t.y; });
    /* category labels sit at the densest member of each form factor */
    var groups = {};
    rs.forEach(function (x) { (groups[x.data.form_factor] = groups[x.data.form_factor] || []).push(x); });
    G.mapLabels = Object.keys(groups).map(function (ff) {
      var m = groups[ff], best = m[0], bd = -1;
      m.forEach(function (a) {
        var dsum = 0;
        m.forEach(function (b) { var dx = a.mx - b.mx, dy = a.my - b.my; dsum += Math.exp(-(dx * dx + dy * dy) / 1800); });
        if (dsum > bd) { bd = dsum; best = a; }
      });
      return { ff: ff, name: ffName(ff).toUpperCase(), x: best.mx, y: best.my - 16 };
    });
    G.mapReady = true;
  }

  /* density contours: Gaussian KDE on a grid, then marching squares */
  function buildContours() {
    var pts = G.robots.filter(function (n) { return n.vis; });
    G.contour = null;
    if (!pts.length) return;
    var sig = 15, pad = sig * 3.5;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (n) {
      x0 = Math.min(x0, n.mx); y0 = Math.min(y0, n.my); x1 = Math.max(x1, n.mx); y1 = Math.max(y1, n.my);
    });
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    var cs = 3, nx = Math.ceil((x1 - x0) / cs) + 1, ny = Math.ceil((y1 - y0) / cs) + 1;
    var grid = new Float32Array(nx * ny), rc = Math.ceil(sig * 3 / cs), max = 0;
    pts.forEach(function (n) {
      var gx = (n.mx - x0) / cs, gy = (n.my - y0) / cs;
      var ix = Math.round(gx), iy = Math.round(gy);
      for (var j = Math.max(0, iy - rc); j <= Math.min(ny - 1, iy + rc); j++) {
        for (var i = Math.max(0, ix - rc); i <= Math.min(nx - 1, ix + rc); i++) {
          var dx = (i - gx) * cs, dy = (j - gy) * cs;
          grid[j * nx + i] += Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig));
        }
      }
    });
    for (var k = 0; k < grid.length; k++) if (grid[k] > max) max = grid[k];
    var levels = [];
    for (var lv = 0; lv < 9; lv++) levels.push(max * (0.05 + lv * 0.105));
    var paths = levels.map(function (iso) {
      var p = new Path2D();
      for (var j = 0; j < ny - 1; j++) {
        for (var i = 0; i < nx - 1; i++) {
          var a = grid[j * nx + i], b = grid[j * nx + i + 1], c = grid[(j + 1) * nx + i + 1], d = grid[(j + 1) * nx + i];
          var code = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
          if (code === 0 || code === 15) continue;
          var X = x0 + i * cs, Y = y0 + j * cs;
          var top = [X + cs * (iso - a) / (b - a), Y], right = [X + cs, Y + cs * (iso - b) / (c - b)];
          var bottom = [X + cs * (iso - d) / (c - d), Y + cs], left = [X, Y + cs * (iso - a) / (d - a)];
          var segs = MS[code];
          for (var s = 0; s < segs.length; s += 2) {
            var e1 = [top, right, bottom, left][segs[s]], e2 = [top, right, bottom, left][segs[s + 1]];
            p.moveTo(e1[0], e1[1]); p.lineTo(e2[0], e2[1]);
          }
        }
      }
      return p;
    });
    G.contour = paths;
  }
  /* marching-squares edge pairs (0 top, 1 right, 2 bottom, 3 left), corners a b c d = 8 4 2 1 */
  var MS = {
    1: [3, 2], 2: [2, 1], 3: [3, 1], 4: [0, 1], 5: [3, 0, 2, 1], 6: [0, 2], 7: [3, 0],
    8: [3, 0], 9: [0, 2], 10: [0, 1, 3, 2], 11: [0, 1], 12: [3, 1], 13: [2, 1], 14: [3, 2]
  };

  /* ================= canvas / camera ================= */

  var cv, ctx, W = 0, H = 0, DPR = 1;
  /* oy lifts the picture when the details card covers the lower stage (phones) */
  var cam = { yaw: 0.35, pitch: -0.18, dist: 700, tx: 0, ty: 0, tz: 0, oy: 0 };
  var camT = { yaw: 0.35, pitch: -0.18, dist: 700, tx: 0, ty: 0, tz: 0, oy: 0 };
  var view = { x: 0, y: 0, k: 1, oy: 0 }, viewT = { x: 0, y: 0, k: 1, oy: 0 };
  var morph = null;   // position transition between cloud layouts
  var fade = { v: 1, to: 1, after: null };

  function focal() { return Math.min(W, H) * 1.05; }
  function homeDist() { return G.R * focal() / (Math.min(W, H) * 0.47); }

  function resetCamera(instant) {
    camT.yaw = 0.35; camT.pitch = -0.18; camT.dist = homeDist() * (S.group === "year" ? 1.2 : 1);
    camT.tx = camT.ty = camT.tz = 0;
    if (G.mapReady) fitMap();
    if (instant) { copy(camT, cam); copy(viewT, view); }
    kick();
  }
  function copy(a, b) { for (var k in a) b[k] = a[k]; }
  function fitMap() {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    G.robots.forEach(function (n) {
      x0 = Math.min(x0, n.mx); y0 = Math.min(y0, n.my); x1 = Math.max(x1, n.mx); y1 = Math.max(y1, n.my);
    });
    viewT.x = (x0 + x1) / 2; viewT.y = (y0 + y1) / 2;
    viewT.k = Math.min(W / (x1 - x0 + 90), H / (y1 - y0 + 90));
  }

  function resize() {
    var r = cv.parentNode.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var first = !W;
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    if (first) resetCamera(true);
    kick();
  }

  /* world → screen for the 3D cloud */
  var P = { cy: 1, sy: 0, cp: 1, sp: 0, f: 1 };
  function prep() {
    P.cy = Math.cos(cam.yaw); P.sy = Math.sin(cam.yaw);
    P.cp = Math.cos(cam.pitch); P.sp = Math.sin(cam.pitch); P.f = focal();
  }
  function proj(x, y, z, out) {
    x -= cam.tx; y -= cam.ty; z -= cam.tz;
    var x1 = x * P.cy - z * P.sy, z1 = x * P.sy + z * P.cy;
    var y2 = y * P.cp - z1 * P.sp, z2 = y * P.sp + z1 * P.cp;
    var depth = cam.dist - z2;
    if (depth < 8) { out.ok = false; return out; }
    var s = P.f / depth;
    out.x = W / 2 + x1 * s; out.y = H / 2 - cam.oy + y2 * s; out.s = s; out.depth = depth; out.ok = true;
    return out;
  }
  function fog(depth) {
    var t = clamp((cam.dist + G.R - depth) / (2 * G.R), 0, 1);
    return 0.3 + 0.7 * Math.pow(t, 1.25);
  }

  /* ================= state → visibility / focus ================= */

  function applyFilters() {
    var lo = G.years[S.y0], hi = G.years[S.y1];
    G.nodes.forEach(function (n) { if (n.type !== "robot") n.vis = n.type === "root"; });
    G.robots.forEach(function (n) {
      n.vis = n.year >= lo && n.year <= hi && (!S.ff || n.data.form_factor === S.ff);
      if (n.vis) n.parents.forEach(function (m) {
        m.vis = true;
        G.byId["era/" + n.data.era].vis = true;
      });
    });
    G.anchors.forEach(function (a) { a.vis = a.year >= lo && a.year <= hi; });
    if (S.sel && !S.sel.vis) closeCard();
    if (G.mapReady) buildContours();
    if (S.q) runSearch();
    updateFocus();
    kick();
  }

  var focus = null;   // { nodes:Set, links:Set, strong:bool }
  function focusOf(n) {
    var ns = new Set([n]), ls = new Set();
    if (n.type === "year") {
      G.robots.forEach(function (r) {
        if (r.year !== n.year || !r.vis) return;
        ns.add(r); r.links.forEach(function (l) { if (l.t === r) { ns.add(l.s); ls.add(l); } });
      });
      return { nodes: ns, links: ls };
    }
    if (S.view === "map" && n.type === "robot") {
      (n.similar || []).forEach(function (m) { ns.add(m); });
      return { nodes: ns, links: ls };
    }
    /* up to the index; a robot climbs only through its own era */
    var up = [n];
    while (up.length) {
      var c = up.pop();
      c.links.forEach(function (l) {
        if (l.t !== c) return;
        if (n.type === "robot" && l.s.type === "era" && l.s.data.id !== n.data.era) return;
        ls.add(l);
        if (!ns.has(l.s)) { ns.add(l.s); up.push(l.s); }
      });
    }
    n.links.forEach(function (l) { if (l.s === n && l.t.vis) { ls.add(l); ns.add(l.t); } });
    return { nodes: ns, links: ls };
  }
  function updateFocus() {
    var f = S.sel || S.preview;
    focus = f ? focusOf(f) : null;
    if (focus) focus.strong = !!S.sel;
  }

  /* ================= drawing ================= */

  var tmpP = { x: 0, y: 0, s: 0, depth: 0, ok: false }, tmpC = { x: 0, y: 0, s: 0, depth: 0, ok: false };

  function rgba(hex, a) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var v = parseInt(h, 16);
    return "rgba(" + (v >> 16 & 255) + "," + (v >> 8 & 255) + "," + (v & 255) + "," + a.toFixed(3) + ")";
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.stage;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = fade.v;
    if (S.view === "map") drawMap(); else drawCloud();
    ctx.globalAlpha = 1;
  }

  function dimOf(n) {
    if (!focus) return 1;
    if (focus.nodes.has(n)) return 1;
    return focus.strong ? 0.1 : 0.32;
  }

  function drawCloud() {
    prep();
    var list = G.nodes, i, n;
    var yearMode = S.group === "year";
    for (i = 0; i < list.length; i++) {
      n = list[i];
      proj(n.x, n.y, n.z, tmpP);
      n.ok = tmpP.ok; n.sx = tmpP.x; n.sy = tmpP.y; n.depth = tmpP.depth;
      n.sr = Math.max(0.9, n.rad * tmpP.s); n.fog = tmpP.ok ? fog(tmpP.depth) : 0;
      n.da = n.ok ? n.a * n.fog * dimOf(n) : 0;
    }
    if (yearMode || morph) {
      G.anchors.forEach(function (a) {
        proj(a.x, a.y, a.z, tmpP);
        a.ok = tmpP.ok; a.sx = tmpP.x; a.sy = tmpP.y; a.depth = tmpP.depth;
        a.sr = Math.max(1.4, a.rad * tmpP.s);
        a.da = a.ok ? a.a * (a.vis ? 0.9 : 0.25) * (focus && !focus.nodes.has(a) ? (focus.strong ? 0.3 : 0.6) : 1) : 0;
      });
    }

    /* links: curved, coloured by the parent's type */
    ctx.lineCap = "round";
    var hov = S.hover;
    for (i = 0; i < G.links.length; i++) {
      var l = G.links[i], s = l.s, t = l.t;
      if (!s.ok || !t.ok) continue;
      var base = Math.min(s.a, t.a) * Math.min(s.fog, t.fog);
      if (base < 0.01) continue;
      var hot = (focus && focus.links.has(l)) || (hov && (s === hov || t === hov));
      var al = hot ? 0.95 * base : base * (focus ? (focus.strong ? 0.06 : 0.16) : s.type === "root" ? 0.8 : 0.5);
      if (al < 0.006) continue;
      var dx = t.x - s.x, dy = t.y - s.y, dz = t.z - s.z;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.24;
      proj((s.x + t.x) / 2 + l.ox * len, (s.y + t.y) / 2 + l.oy * len, (s.z + t.z) / 2 + l.oz * len, tmpC);
      ctx.strokeStyle = rgba(C[s.type], al);
      ctx.lineWidth = (hot ? 1.3 : 0.85) * (s.type === "root" ? 1.35 : 1);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      if (tmpC.ok) ctx.quadraticCurveTo(tmpC.x, tmpC.y, t.sx, t.sy);
      else ctx.lineTo(t.sx, t.sy);
      ctx.stroke();
    }

    /* nodes far → near */
    var order = list.filter(function (q) { return q.ok && q.da > 0.01; });
    if (yearMode || morph) order = order.concat(G.anchors.filter(function (a) { return a.ok && a.da > 0.01; }));
    order.sort(function (a, b) { return b.depth - a.depth; });
    order.forEach(function (n) { drawNode(n, n.photo ? n.sr * PHOTO_R / n.rad : 0); });
    drawLabels(order);
  }

  /* pr: on-screen radius for the photo thumbnail, 0 to draw a plain dot */
  function drawNode(n, pr) {
    var img = pr >= 3.4 && n.da > 0.25 ? thumb(n) : null;
    ctx.globalAlpha = fade.v * clamp(n.da, 0, 1);
    if (img) {
      var r = pr;
      ctx.save();
      ctx.beginPath(); ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2); ctx.clip();
      var iw = img.naturalWidth, ih = img.naturalHeight, side = Math.min(iw, ih);
      ctx.drawImage(img, (iw - side) / 2, (ih - side) * 0.22, side, side, n.sx - r, n.sy - r, r * 2, r * 2);
      ctx.restore();
      ctx.strokeStyle = C.robot; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2); ctx.stroke();
      n.hitR = r;
    } else {
      ctx.fillStyle = C[n.type];
      ctx.beginPath(); ctx.arc(n.sx, n.sy, n.sr, 0, Math.PI * 2); ctx.fill();
      n.hitR = n.sr;
    }
    if (n === S.sel || n === S.hover) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(n.sx, n.sy, n.hitR + 3.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = fade.v;
  }

  /* labels by priority, skipping any that would overlap one already placed */
  function drawLabels(order) {
    var cands = [];
    order.forEach(function (n) {
      var p = 0, inF = focus && focus.nodes.has(n);
      if (n === S.sel || n === S.hover) p = 100;
      else if (n.type === "root") p = 90;
      else if (n.type === "era") p = 80;
      else if (n.type === "year") p = 75;
      else if (inF) p = 60;
      else if (n.type === "maker" && n.data.robots.length >= 3) p = 30 + n.data.robots.length;
      else if (n.type === "maker" && n.sr > 3.4) p = 20;
      else if (n.type === "robot" && n.sr > 3.4) p = 10;
      if (p && n.da > 0.12) cands.push({ n: n, p: p, d: n.depth });
    });
    cands.sort(function (a, b) { return b.p - a.p || a.d - b.d; });
    var placed = [];
    ctx.textBaseline = "alphabetic";
    cands.forEach(function (c) {
      var n = c.n, big = n.type === "year";
      ctx.font = big ? "500 10px " + C.mono : "600 9.5px " + C.display;
      if ("letterSpacing" in ctx) ctx.letterSpacing = big ? "0.5px" : "1.6px";
      var txt = n.type === "year" ? n.name : n.name.toUpperCase();
      if (!n._tw || n._tf !== ctx.font) { n._tw = ctx.measureText(txt).width; n._tf = ctx.font; }
      var r = n.hitR || n.sr, x = n.sx + r + 4, y = n.sy - r - 3;
      if (n.type === "year") { x = n.sx - n._tw / 2; y = n.sy - r - 6; }
      var box = [x - 2, y - 10, x + n._tw + 2, y + 3];
      for (var i = 0; i < placed.length; i++) {
        var b = placed[i];
        if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) return;
      }
      placed.push(box);
      var hi = c.p >= 60 && n.type !== "year";
      ctx.globalAlpha = fade.v * clamp(n.da * (hi ? 1.25 : 0.95), 0, 1);
      ctx.fillStyle = hi ? C.ink : C.ink2;
      ctx.fillText(txt, x, y);
    });
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.globalAlpha = fade.v;
  }

  function drawMap() {
    var k = view.k, ox = W / 2 - view.x * k, oy = H / 2 - view.oy - view.y * k;
    if (G.contour) {
      ctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * ox, DPR * oy);
      ctx.lineWidth = 0.9 / k;
      G.contour.forEach(function (p, i) {
        ctx.strokeStyle = rgba(C.contour, (0.22 + i * 0.035) * (focus && focus.strong ? 0.5 : 1));
        ctx.stroke(p);
      });
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    var rs = G.robots, sel = S.sel && S.sel.type === "robot" ? S.sel : null;
    rs.forEach(function (n) {
      n.ok = true; n.sx = ox + n.mx * k; n.sy = oy + n.my * k; n.depth = 0; n.fog = 1;
      n.sr = clamp(1.9 * Math.sqrt(k), 1.4, 5); n.da = n.a * dimOf(n);
    });
    if (sel && sel.vis) {
      ctx.strokeStyle = rgba(C.robot, 0.7); ctx.lineWidth = 1;
      sel.similar.forEach(function (m) {
        if (!m.vis) return;
        ctx.beginPath(); ctx.moveTo(sel.sx, sel.sy); ctx.lineTo(m.sx, m.sy); ctx.stroke();
      });
    }
    var order = rs.filter(function (n) { return n.da > 0.01; });
    var pr = k >= 1.5 ? clamp(2.6 * k, 5, 12) : 0;
    order.forEach(function (n) { drawNode(n, n.photo ? pr : 0); });
    /* category labels, then robot labels when zoomed in or in focus */
    ctx.font = "600 10.5px " + C.display;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
    ctx.fillStyle = C.ink2;
    (G.mapLabels || []).forEach(function (L) {
      if (S.ff && S.ff !== L.ff) return;
      var w = ctx.measureText(L.name).width;
      ctx.globalAlpha = fade.v * (focus && focus.strong ? 0.3 : 0.75);
      ctx.fillText(L.name, ox + L.x * k - w / 2, oy + L.y * k);
    });
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.globalAlpha = fade.v;
    drawLabels(order);
  }

  /* lazily load the committed robot photos as node thumbnails */
  var IMG = {}, loading = 0;
  function thumb(n) {
    var t = IMG[n.photo];
    if (!t) {
      if (loading >= 3) return null;
      t = IMG[n.photo] = { ok: false };
      loading++;
      var im = new Image();
      im.decoding = "async";
      im.onload = function () { t.ok = true; loading--; kick(); };
      im.onerror = function () { t.bad = true; loading--; };
      im.src = ROOT + "img/" + n.photo;
      t.img = im;
    }
    return t.ok ? t.img : null;
  }

  /* ================= animation loop ================= */

  var raf = 0, last = 0;
  function kick() { if (!raf && cv) raf = requestAnimationFrame(frame); }
  function frame(ts) {
    raf = 0;
    var dt = last ? Math.min(64, ts - last) : 16; last = ts;
    var moving = step(dt);
    draw();
    if (moving) kick(); else last = 0;
  }
  function ease(a, b, f) { return a + (b - a) * f; }
  function step(dt) {
    var moving = false, f = REDUCED ? 1 : 1 - Math.pow(0.86, dt / 16);
    /* idle drift, like a slow turntable */
    var idle = performance.now() - S.lastInput > 9000;
    if (S.view === "cloud" && !REDUCED && idle && !S.sel && !S.hover && !S.preview && S.onscreen && !document.hidden) {
      camT.yaw += 0.00011 * dt; moving = true;
    }
    for (var k in camT) {
      var d = camT[k] - cam[k];
      if (Math.abs(d) > 1e-4 * (k === "dist" ? 100 : 1)) { cam[k] = ease(cam[k], camT[k], f); moving = true; }
      else cam[k] = camT[k];
    }
    for (var v in viewT) {
      var e = viewT[v] - view[v];
      if (Math.abs(e) > 1e-4) { view[v] = ease(view[v], viewT[v], f); moving = true; }
      else view[v] = viewT[v];
    }
    if (morph) {
      morph.t = REDUCED ? 1 : Math.min(1, morph.t + dt / 1100);
      var tt = morph.t < 0.5 ? 4 * morph.t * morph.t * morph.t : 1 - Math.pow(-2 * morph.t + 2, 3) / 2;
      G.nodes.forEach(function (n) {
        n.x = ease(n.fx0, morph.to ? n.gx : n.hx, tt);
        n.y = ease(n.fy0, morph.to ? n.gy : n.hy, tt);
        n.z = ease(n.fz0, morph.to ? n.gz : n.hz, tt);
      });
      G.anchors.forEach(function (a) { a.a = morph.to ? tt : 1 - tt; });
      if (morph.t >= 1) morph = null; else moving = true;
    }
    var fa = REDUCED ? 1 : 1 - Math.pow(0.82, dt / 16);
    G.nodes.forEach(function (n) {
      var target = n.vis ? 1 : 0;
      if (Math.abs(n.a - target) > 0.01) { n.a = ease(n.a, target, fa); moving = true; } else n.a = target;
    });
    if (fade.v !== fade.to) {
      fade.v = REDUCED ? fade.to : clamp(fade.v + (fade.to > fade.v ? 1 : -1) * dt / 170, 0, 1);
      if (fade.v === fade.to && fade.after) { var cb = fade.after; fade.after = null; cb(); }
      moving = true;
    }
    return moving;
  }

  /* ================= picking / pointer ================= */

  function pick(px, py) {
    var best = null, bd = Infinity;
    var pool = S.view === "map" ? G.robots : G.nodes;
    if (S.view === "cloud" && S.group === "year" && !morph) pool = pool.concat(G.anchors);
    for (var i = 0; i < pool.length; i++) {
      var n = pool[i];
      if (!n.ok || n.da < 0.12 || !n.vis) continue;
      var dx = n.sx - px, dy = n.sy - py, d = Math.sqrt(dx * dx + dy * dy);
      var r = Math.max((n.hitR || n.sr) + 3, 7);
      if (d <= r && d - (n.hitR || n.sr) < bd) { bd = d - (n.hitR || n.sr); best = n; }
    }
    return best;
  }

  var ptrs = new Map(), drag = null;
  function local(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function onDown(e) {
    S.lastInput = performance.now();
    audioInit();
    cv.setPointerCapture(e.pointerId);
    var p = local(e);
    ptrs.set(e.pointerId, p);
    if (ptrs.size === 1) {
      drag = { x: p.x, y: p.y, x0: p.x, y0: p.y, moved: false, pan: e.shiftKey || e.button === 2, type: e.pointerType };
    } else if (ptrs.size === 2) {
      var a = Array.from(ptrs.values());
      drag = { pinch: true, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2, moved: true };
    }
  }
  function onMove(e) {
    var p = local(e);
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
    if (!drag) {
      if (e.pointerType === "touch") return;
      setHover(pick(p.x, p.y), p);
      return;
    }
    S.lastInput = performance.now();
    if (drag.pinch) {
      if (ptrs.size < 2) return;
      var a = Array.from(ptrs.values());
      var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      zoomBy(drag.d / (d || 1), mx, my);
      panBy(mx - drag.mx, my - drag.my);
      drag.d = d; drag.mx = mx; drag.my = my;
      return;
    }
    var dx = p.x - drag.x, dy = p.y - drag.y;
    if (!drag.moved && Math.hypot(p.x - drag.x0, p.y - drag.y0) > 4) { drag.moved = true; setHover(null); }
    if (!drag.moved) return;
    drag.x = p.x; drag.y = p.y;
    if (S.view === "map" || drag.pan) panBy(dx, dy);
    else {
      cam.yaw = camT.yaw = camT.yaw + dx * 0.0055;
      cam.pitch = camT.pitch = clamp(camT.pitch + dy * 0.0055, -1.45, 1.45);
      kick();
    }
  }
  function onUp(e) {
    var p = local(e);
    ptrs.delete(e.pointerId);
    if (drag && !drag.moved && !drag.pinch) {
      var n = pick(p.x, p.y);
      if (n) select(n, true);
    }
    if (ptrs.size === 0) drag = null;
    else if (drag && drag.pinch) {
      var rest = Array.from(ptrs.values())[0];
      drag = { x: rest.x, y: rest.y, x0: rest.x, y0: rest.y, moved: true };
    }
  }
  function panBy(dx, dy) {
    if (S.view === "map") {
      view.x = viewT.x = viewT.x - dx / view.k;
      view.y = viewT.y = viewT.y - dy / view.k;
    } else {
      prep();
      var s = P.f / cam.dist;
      var rx = P.cy, rz = -P.sy, ux = -P.sp * P.sy, uy = P.cp, uz = -P.sp * P.cy;
      camT.tx -= (rx * dx + ux * dy) / s; camT.ty -= uy * dy / s; camT.tz -= (rz * dx + uz * dy) / s;
      cam.tx = camT.tx; cam.ty = camT.ty; cam.tz = camT.tz;
    }
    kick();
  }
  function zoomBy(factor, px, py) {
    if (S.view === "map") {
      var k1 = clamp(view.k / factor, 0.25, 14), cy = H / 2 - view.oy;
      var wx = view.x + (px - W / 2) / view.k, wy = view.y + (py - cy) / view.k;
      view.k = viewT.k = k1;
      view.x = viewT.x = wx - (px - W / 2) / k1;
      view.y = viewT.y = wy - (py - cy) / k1;
    } else {
      camT.dist = clamp(camT.dist * factor, 30, homeDist() * 4);
    }
    kick();
  }
  function onWheel(e) {
    e.preventDefault();
    S.lastInput = performance.now();
    var p = local(e), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomBy(Math.exp(clamp(dy, -120, 120) * 0.0015), p.x, p.y);
  }

  /* ================= hover / tooltip ================= */

  function setHover(n, p) {
    if (n === S.hover) { if (n && p) placeTip(p); return; }
    S.hover = n;
    cv.style.cursor = n ? "pointer" : "";
    var tip = $("netTip");
    if (!n) { tip.hidden = true; kick(); return; }
    tip.innerHTML = '<span class="tn">' + esc(n.name) + '</span><span class="tt">' + esc(TYPE_NAME[n.type]) +
      (n.type === "robot" ? " · " + n.year : "") + "</span>";
    tip.hidden = false;
    if (p) placeTip(p);
    blip(n.type);
    kick();
  }
  function placeTip(p) {
    var tip = $("netTip"), w = tip.offsetWidth, h = tip.offsetHeight;
    var x = p.x + 16, y = p.y + 14;
    if (x + w > W - 8) x = p.x - w - 12;
    if (y + h > H - 8) y = p.y - h - 10;
    tip.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  /* ================= selection / card ================= */

  function select(n, fromCanvas) {
    if (!n) return;
    S.sel = n; S.preview = null;
    updateFocus();
    renderCard(n);
    flyTo(n);
    chime(n.type);
    writeHash();
    if (fromCanvas) setHover(null);
    kick();
  }
  function closeCard() {
    S.sel = null; S.preview = null;
    updateFocus();
    $("netCard").hidden = true;
    liftForCard();
    writeHash();
    kick();
  }
  function flyTo(n) {
    if (S.view === "map") {
      if (n.type !== "robot") return;
      viewT.x = n.mx; viewT.y = n.my; viewT.k = Math.max(view.k, 2.4);
      return;
    }
    var pts = focus ? Array.from(focus.nodes) : [n], rad = 0;
    pts.forEach(function (m) {
      var dx = m.x - n.x, dy = m.y - n.y, dz = m.z - n.z;
      rad = Math.max(rad, Math.sqrt(dx * dx + dy * dy + dz * dz));
    });
    if (n.type === "root") { camT.tx = camT.ty = camT.tz = 0; camT.dist = homeDist(); return; }
    /* centre between the node and its focus so the path to the index stays in view */
    var cx = 0, cy = 0, cz = 0;
    pts.forEach(function (m) { cx += m.x; cy += m.y; cz += m.z; });
    cx /= pts.length; cy /= pts.length; cz /= pts.length;
    camT.tx = (n.x * 2 + cx) / 3; camT.ty = (n.y * 2 + cy) / 3; camT.tz = (n.z * 2 + cz) / 3;
    camT.dist = clamp(rad * 2.1, 90, homeDist() * 1.1);
  }

  function rowBtn(n, extra) {
    return '<button type="button" class="nc-row" data-id="' + esc(n.id) + '"><i style="background:' + C[n.type] + '"></i>' +
      '<span>' + esc(n.name) + '</span><em>' + esc(extra || "") + "</em></button>";
  }
  function renderCard(n) {
    var card = $("netCard"), h = "", d = n.data;
    h += '<button type="button" class="nc-x" id="ncX" aria-label="Close details">×</button>';
    h += '<h2 class="nc-name">' + esc(n.name) + "</h2>";
    if (n.type === "robot") {
      h += '<p class="nc-meta">Year: ' + n.year + (d.year_status_end ? "–" + d.year_status_end : "") + "</p>";
      h += '<p class="nc-type">Robot · ' + esc(d.maker) + " · " + esc(d.country) + "</p>";
      if (n.photo) h += '<img class="nc-img" src="' + esc(ROOT + "img/" + n.photo) + '" alt="' + esc(n.name) + '" loading="lazy">';
      h += '<p class="nc-sum">' + esc(trim(d.summary, 300)) + "</p>";
      h += '<p class="nc-facts">' + [ffName(d.form_factor), d.actuation && ffName(d.actuation), ffName(d.status)]
        .filter(Boolean).map(esc).join(" · ") + "</p>";
      if (S.view === "map" && n.similar) {
        h += '<p class="nc-sub">Most alike in the index</p><div class="nc-list">' +
          n.similar.map(function (m) { return rowBtn(m, String(m.year)); }).join("") + "</div>";
      }
      h += '<a class="nc-go" href="' + ROOT + "robot/" + esc(d.id) + '/">→ open the robot page</a>';
    } else if (n.type === "maker") {
      h += '<p class="nc-meta">Year: ' + n.yMin + (n.yMax !== n.yMin ? "–" + n.yMax : "") + "</p>";
      h += '<p class="nc-type">Maker · ' + esc(d.country) + " · " + esc(ffName(d.maker_type)) + "</p>";
      h += '<p class="nc-sub">' + d.robots.length + (d.robots.length === 1 ? " robot" : " robots") + " in the index</p>";
      h += '<div class="nc-list">' + n.children.map(function (c) { return rowBtn(c, String(c.year)); }).join("") + "</div>";
      h += '<a class="nc-go" href="' + ROOT + "explore/#/catalog?q=" + encodeURIComponent(n.name) + '">→ see them in the catalog</a>';
    } else if (n.type === "era") {
      var cnt = G.robots.filter(function (r) { return r.data.era === d.id; }).length;
      h += '<p class="nc-meta">Year: ' + (d.start == null ? "…" : d.start) + "–" + (d.end == null ? "now" : d.end) + "</p>";
      h += '<p class="nc-type">Era · ' + cnt + " robots · " + n.children.length + " makers</p>";
      h += '<p class="nc-sum">' + esc(trim(d.summary, 360)) + "</p>";
      h += '<a class="nc-go" href="' + ROOT + 'explore/#/timeline">→ read the era in the timeline</a>';
    } else if (n.type === "year") {
      var rs = G.robots.filter(function (r) { return r.year === n.year && r.vis; });
      h += '<p class="nc-type">Year · ' + rs.length + (rs.length === 1 ? " robot" : " robots") + " revealed</p>";
      h += '<div class="nc-list">' + rs.map(function (r) { return rowBtn(r, r.data.maker); }).join("") + "</div>";
    } else {
      h += '<p class="nc-type">Index</p>';
      h += '<p class="nc-sum">' + G.robots.length + " robots from " +
        G.nodes.filter(function (m) { return m.type === "maker"; }).length + " makers across " +
        G.nodes.filter(function (m) { return m.type === "era"; }).length + " eras, " +
        G.years[0] + "–" + G.years[G.years.length - 1] + ".</p>";
      h += '<a class="nc-go" href="' + (ROOT || "./") + '">→ back to the index home</a>';
    }
    card.innerHTML = h;
    card.hidden = false;
    card.scrollTop = 0;
    liftForCard();
  }
  function liftForCard() {
    var narrow = window.matchMedia && matchMedia("(max-width: 760px)").matches;
    camT.oy = viewT.oy = narrow && !$("netCard").hidden ? H * 0.26 : 0;
    kick();
  }
  function trim(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s; }

  /* ================= sidebar: years, filter, group, search ================= */

  function setupControls() {
    var y0 = $("yMin"), y1 = $("yMax"), last = G.years.length - 1;
    y0.max = y1.max = String(last);
    S.y0 = 0; S.y1 = last;
    y0.value = "0"; y1.value = String(last);
    function onRange(e) {
      var a = +y0.value, b = +y1.value;
      if (a > b) { if (e && e.target === y0) { y0.value = String(b); a = b; } else { y1.value = String(a); b = a; } }
      S.y0 = a; S.y1 = b;
      paintRange();
      applyFilters();
    }
    y0.addEventListener("input", onRange);
    y1.addEventListener("input", onRange);
    paintRange();

    var ffs = {};
    G.robots.forEach(function (n) { ffs[n.data.form_factor] = (ffs[n.data.form_factor] || 0) + 1; });
    var fl = $("ddFilterList");
    fl.innerHTML = opt("", "All", G.robots.length, true) + Object.keys(ffs).sort(function (a, b) { return ffs[b] - ffs[a]; })
      .map(function (k) { return opt(k, ffName(k), ffs[k], false); }).join("");
    fl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-v]");
      if (!b) return;
      S.ff = b.getAttribute("data-v");
      $("ffLabel").textContent = S.ff ? ffName(S.ff) : "All";
      markOpts(fl, S.ff);
      closeDD();
      applyFilters();
    });
    var gl = $("ddGroupList");
    gl.innerHTML = opt("hierarchy", "Hierarchy", null, true) + opt("year", "Year", null, false);
    gl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-v]");
      if (!b) return;
      closeDD();
      setGroup(b.getAttribute("data-v"));
    });
    Array.prototype.forEach.call(document.querySelectorAll(".net-dd-btn"), function (btn) {
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        closeDD();
        if (!open) { btn.setAttribute("aria-expanded", "true"); $(btn.getAttribute("aria-controls")).hidden = false; }
      });
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".net-dd")) closeDD(); });

    clearFilters = function () {
      S.ff = ""; $("ffLabel").textContent = "All"; markOpts(fl, "");
      y0.value = "0"; y1.value = String(last); S.y0 = 0; S.y1 = last; paintRange();
      applyFilters();
    };
    $("netClear").addEventListener("click", function () {
      $("netQ").value = ""; runSearch();
      closeCard();
      clearFilters();
    });

    var q = $("netQ"), t = 0;
    q.addEventListener("input", function () { clearTimeout(t); t = setTimeout(runSearch, 90); });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var f = $("netResults").querySelector(".nr"); if (f) f.click(); }
      if (e.key === "Escape") { q.value = ""; runSearch(); }
    });
    $("netQx").addEventListener("click", function () { q.value = ""; runSearch(); q.focus(); });
    var res = $("netResults");
    res.addEventListener("click", function (e) {
      var b = e.target.closest(".nr"), n = b && G.byId[b.getAttribute("data-id")];
      if (!n) return;
      audioInit();
      /* a result the filters hide: lift the filters rather than select something invisible */
      if (!n.vis) { clearFilters(); runSearch(); }
      select(n);
    });
    res.addEventListener("mouseover", function (e) { previewFrom(e.target.closest(".nr")); });
    res.addEventListener("focusin", function (e) { previewFrom(e.target.closest(".nr")); });
    res.addEventListener("mouseleave", function () { previewFrom(null); });
    res.addEventListener("focusout", function () { previewFrom(null); });

    $("netCtlToggle").addEventListener("click", function () {
      var b = $("netCtlToggle"), open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      $("netApp").classList.toggle("ctl-open", open);
    });
  }
  function opt(v, label, n, on) {
    return '<button type="button" data-v="' + esc(v) + '" aria-pressed="' + on + '">' + esc(label) +
      (n != null ? "<em>" + n + "</em>" : "") + "</button>";
  }
  function markOpts(list, v) {
    Array.prototype.forEach.call(list.querySelectorAll("button[data-v]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === v));
    });
  }
  function closeDD() {
    Array.prototype.forEach.call(document.querySelectorAll(".net-dd-btn"), function (b) {
      b.setAttribute("aria-expanded", "false"); $(b.getAttribute("aria-controls")).hidden = true;
    });
  }
  function paintRange() {
    var last = G.years.length - 1 || 1;
    $("netRange").style.setProperty("--a", (S.y0 / last * 100) + "%");
    $("netRange").style.setProperty("--b", (S.y1 / last * 100) + "%");
    $("yMinL").textContent = G.years[S.y0];
    $("yMaxL").textContent = G.years[S.y1];
    $("yMin").setAttribute("aria-valuetext", String(G.years[S.y0]));
    $("yMax").setAttribute("aria-valuetext", String(G.years[S.y1]));
  }
  var clearFilters = function () {};
  function previewFrom(b) {
    var n = b ? G.byId[b.getAttribute("data-id")] : null;
    if (n && !n.vis) n = null;
    if (S.sel || n === S.preview) return;
    S.preview = n;
    updateFocus();
    kick();
  }

  function runSearch() {
    var raw = $("netQ").value.trim(), q = raw.toLowerCase(), res = $("netResults");
    $("netQx").hidden = !raw;
    S.q = q;
    if (!q) { res.innerHTML = ""; res.classList.remove("on"); previewFrom(null); return; }
    var pool = S.view === "map" ? G.robots : G.nodes, out = [];
    pool.forEach(function (n) {
      if (n.type === "root") return;
      var nm = n.name.toLowerCase();
      var sc = nm.indexOf(q) === 0 ? 3 : nm.indexOf(q) >= 0 ? 2 : (n.hay && n.hay.indexOf(q) >= 0) ? 1 : 0;
      if (sc) out.push({ n: n, s: sc });
    });
    out.sort(function (a, b) {
      return b.s - a.s || TYPE_ORDER[a.n.type] - TYPE_ORDER[b.n.type] || a.n.name.localeCompare(b.n.name);
    });
    var shown = out.slice(0, 40);
    res.innerHTML = shown.length ? shown.map(function (o) {
      var n = o.n, snip = n.type === "robot" ? n.data.maker + " · " + n.year + " — " + n.data.summary
        : n.type === "maker" ? n.data.country + " · " + n.data.robots.length + " robots" : n.data.summary;
      return '<button type="button" class="nr' + (n.vis ? "" : " off") + '" data-id="' + esc(n.id) + '"' +
        (n.vis ? "" : ' title="Hidden by the current filters — click to clear them"') + '><i style="background:' + C[n.type] + '"></i>' +
        '<span class="nr-n">' + esc(n.name) + ' <em>/' + esc(TYPE_NAME[n.type]) + "</em></span>" +
        '<span class="nr-s">' + esc(trim(snip, 90)) + "</span></button>";
    }).join("") + (out.length > shown.length ? '<p class="nr-more">' + (out.length - shown.length) + " more — refine the search</p>" : "")
      : '<p class="nr-more">Nothing matches “' + esc(raw) + "”.</p>";
    res.classList.add("on");
    res.scrollTop = 0;
  }

  /* ================= view & grouping ================= */

  function setView(v, instant) {
    if (v === S.view && !instant) return;
    var go = function () {
      S.view = v;
      if (v === "map" && !G.mapReady) { layoutMap(); buildContours(); fitMap(); copy(viewT, view); }
      $("vCloud").setAttribute("aria-pressed", String(v === "cloud"));
      $("vMap").setAttribute("aria-pressed", String(v === "map"));
      $("netApp").classList.toggle("is-map", v === "map");
      if (S.sel && v === "map" && S.sel.type !== "robot") closeCard();
      if (S.sel) { updateFocus(); renderCard(S.sel); flyTo(S.sel); }
      else updateFocus();
      runSearch();
      writeHash();
      fade.to = 1;
      kick();
    };
    if (instant || REDUCED) { go(); return; }
    fade.to = 0; fade.after = go; kick();
  }

  function setGroup(g) {
    if (g === S.group) return;
    if (g === "year" && !G.anchors.length) layoutYears();
    S.group = g;
    $("grpLabel").textContent = g === "year" ? "Year" : "Hierarchy";
    markOpts($("ddGroupList"), g);
    G.nodes.forEach(function (n) { n.fx0 = n.x; n.fy0 = n.y; n.fz0 = n.z; });
    morph = { t: 0, to: g === "year" };
    if (S.sel && S.sel.type === "year" && g !== "year") closeCard();
    camT.dist = homeDist() * (g === "year" ? 1.2 : 1);
    camT.tx = camT.ty = camT.tz = 0;
    camT.pitch = g === "year" ? -0.05 : -0.18;
    camT.yaw = Math.round(camT.yaw / (Math.PI * 2)) * Math.PI * 2 + (g === "year" ? 0 : 0.35);
    kick();
  }

  /* ================= hash: #/3d, #/2d, #/3d/robot/<id> ================= */

  function writeHash() {
    var h = "#/" + (S.view === "map" ? "2d" : "3d");
    if (S.sel && S.sel.type !== "root" && S.sel.type !== "year") h += "/" + S.sel.id;
    if (location.hash !== h) {
      try { history.replaceState(null, "", h); } catch (e) { location.hash = h; }
    }
  }
  function readHash() {
    var seg = location.hash.replace(/^#\/?/, "").split("/");
    var v = seg[0] === "2d" ? "map" : "cloud";
    var id = seg.slice(1).join("/");
    return { view: v, node: id ? G.byId[decodeURIComponent(id)] : null };
  }

  /* ================= sound: soft sine blips, off with the mute button ================= */

  var AC = null, lastBlip = 0;
  var PITCH = { root: 220, era: 330, maker: 440, robot: 587, year: 392 };
  function audioInit() {
    if (AC || S.muted) return;
    var A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    try { AC = new A(); } catch (e) { AC = null; }
  }
  function tone(freq, at, dur, vol) {
    if (!AC || S.muted) return;
    if (AC.state === "suspended") AC.resume();
    var t0 = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function blip(type) {
    var now = performance.now();
    if (now - lastBlip < 70) return;
    lastBlip = now;
    tone(PITCH[type] || 440, 0, 0.22, 0.018);
  }
  function chime(type) {
    var f = PITCH[type] || 440;
    tone(f, 0, 0.6, 0.035); tone(f * 1.5, 0.07, 0.7, 0.022);
  }
  function setMuted(m) {
    S.muted = m;
    var b = $("netMute");
    b.setAttribute("aria-pressed", String(m));
    b.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
    b.title = m ? "Unmute sound" : "Mute sound";
    try { localStorage.setItem("hri-net-mute", m ? "1" : "0"); } catch (e) {}
  }

  /* ================= boot ================= */

  function readColors() {
    C.stage = cssv("--net-stage") || "#050607";
    C.ink = cssv("--net-ink") || "#eceef0";
    C.ink2 = cssv("--net-ink-2") || "#9aa1a8";
    C.contour = cssv("--net-contour") || "#d9dde1";
    C.root = cssv("--net-root") || "#7fa0c9";
    C.era = cssv("--net-era") || "#6fa6a8";
    C.maker = cssv("--net-maker") || "#c98572";
    C.robot = cssv("--net-robot") || "#e7c27f";
    C.year = cssv("--net-year") || "#9aa0a6";
    C.display = cssv("--font-display") || "system-ui, sans-serif";
    C.mono = cssv("--font-mono") || "ui-monospace, monospace";
  }

  function legend() {
    $("netLegend").innerHTML = LEGEND.map(function (t) {
      return '<div class="lg-i" data-t="' + t + '"><span>' + esc(TYPE_NAME[t]) + '</span><i style="background:' + C[t] + '"></i></div>';
    }).join("");
  }

  function fitApp() {
    var head = document.querySelector(".site-head");
    var h = head ? head.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--net-head", Math.round(h) + "px");
  }

  function start(d) {
    D = d;
    readColors();
    buildGraph(d);
    layoutHierarchy();
    G.nodes.forEach(function (n) { n.x = n.hx; n.y = n.hy; n.z = n.hz; });
    cv = $("netCanvas");
    ctx = cv.getContext("2d");
    legend();
    setupControls();
    fitApp();
    try { setMuted(localStorage.getItem("hri-net-mute") === "1"); } catch (e) { setMuted(false); }

    resize();
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(cv.parentNode);
    else window.addEventListener("resize", resize);
    window.addEventListener("resize", fitApp);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { S.onscreen = es[0].isIntersecting; if (S.onscreen) kick(); })
        .observe(cv.parentNode);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });

    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", function (e) { ptrs.delete(e.pointerId); if (!ptrs.size) drag = null; });
    cv.addEventListener("pointerleave", function (e) { if (!drag && e.pointerType !== "touch") setHover(null); });
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    cv.addEventListener("dblclick", function (e) {
      var p = local(e);
      if (!pick(p.x, p.y)) closeCard();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("netInfoPanel").hidden) { toggleInfo(false); return; }
      if (S.sel) closeCard();
    });

    $("netCard").addEventListener("click", function (e) {
      if (e.target.closest("#ncX")) { closeCard(); return; }
      var b = e.target.closest(".nc-row");
      if (b) select(G.byId[b.getAttribute("data-id")]);
    });
    $("vCloud").addEventListener("click", function () { setView("cloud"); });
    $("vMap").addEventListener("click", function () { setView("map"); });
    $("netHome").addEventListener("click", function () { resetCamera(false); });
    $("netMute").addEventListener("click", function () { setMuted(!S.muted); if (!S.muted) { audioInit(); blip("robot"); } });
    $("netInfo").addEventListener("click", function () { toggleInfo($("netInfoPanel").hidden); });

    var h = readHash();
    setView(h.view, true);
    if (h.node) select(h.node);
    applyFilters();
    $("netLoading").hidden = true;
    S.lastInput = performance.now() - 6000;
    kick();
  }
  function toggleInfo(open) {
    $("netInfoPanel").hidden = !open;
    $("netInfo").setAttribute("aria-expanded", String(open));
  }

  HRI.loadData().then(function (d) {
    try { start(d); }
    catch (err) {
      if (window.console) console.error(err);
      $("netLoading").textContent = "Something went wrong drawing the network. A hard reload (⇧⌘R, or Ctrl-Shift-R) clears a stale cached script.";
    }
  }).catch(function (err) {
    if (window.console) console.error(err);
    $("netLoading").textContent = "Could not load the catalog data. Check your connection and reload.";
  });
})();
