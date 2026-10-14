(() => {
"use strict";

const NS = "http://www.w3.org/2000/svg";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const css = getComputedStyle(document.documentElement);
const C = Object.fromEntries(["DF","CF","DR","CR","DF-edge","CF-edge","ink","ink-2","ink-3","steel","steel-2","steel-3",
  "modeA","modeB","wrong","good"].map(k => [k, css.getPropertyValue("--" + k).trim()]));
const HEADS = ["DF", "CF", "DR", "CR"];
const NAME = {DF:"Discrete flow", CF:"Continuous flow", DR:"Discrete regression", CR:"Continuous regression"};
const FLOW = {DF:true, CF:true};
const GRID = "#DDE3E9";
const VER = new URL(document.currentScript.src).search;   // the ?v= tag of this script, reused for the media it loads

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function txt(parent, x, y, s, attrs = {}) { const t = el("text", {x, y, ...attrs}, parent); t.textContent = s; return t; }
function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ""); }

// Hatch patterns for the two flow heads, as in the paper's figures.
function defs(svg) {
  const d = el("defs", {}, svg);
  for (const h of ["DF", "CF"]) {
    const p = el("pattern", {id: `hatch-${h}-${svg.id}`, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"}, d);
    el("rect", {width: 6, height: 6, fill: C[h]}, p);
    el("line", {x1: 0, y1: 0, x2: 0, y2: 6, stroke: "rgba(255,255,255,.55)", "stroke-width": 2.2}, p);
  }
  const w = el("pattern", {id: `hatch-wrong-${svg.id}`, width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"}, d);
  el("rect", {width: 7, height: 7, fill: "#E9A79F"}, w);
  el("line", {x1: 0, y1: 0, x2: 0, y2: 7, stroke: C.wrong, "stroke-width": 2.4}, w);
}
const fillOf = (svg, h) => FLOW[h] ? `url(#hatch-${h}-${svg.id})` : C[h];
const edgeOf = h => FLOW[h] ? C[h + "-edge"] : "none";
const lineOf = h => FLOW[h] ? C[h + "-edge"] : C[h];   // flow shades are too light for thin lines

// Bar with 4px rounded data-end, square at the baseline.
function barPath(x, y0, w, h, horizontal = false) {
  const r = Math.min(4, w / 2, Math.abs(h));
  if (h <= 0) return "";
  if (!horizontal) {
    const top = y0 - h;
    return `M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${y0}Z`;
  }
  const right = x + h;   // horizontal: baseline at x, y0 is the top edge, w is the thickness
  return `M${x},${y0}H${right - r}Q${right},${y0} ${right},${y0 + r}V${y0 + w - r}Q${right},${y0 + w} ${right - r},${y0 + w}H${x}Z`;
}
function headLabel(svg, x, y, h, anchor = "end") {
  const g = el("g", {}, svg), w = 12;
  const t = txt(g, x, y + 4.5, h, {"text-anchor": anchor, "font-size": 13.5, "font-weight": 800, fill: C.ink});
  const sx = anchor === "end" ? x - 26 - w : x;
  el("rect", {x: sx, y: y - 6, width: w, height: w, rx: 2.5, fill: fillOf(svg, h), stroke: edgeOf(h)}, g);
  if (anchor !== "end") t.setAttribute("x", x + w + 6);
  return g;
}

function onWidth(node, fn) {
  let w = node.clientWidth;
  new ResizeObserver(() => { const n = node.clientWidth; if (n !== w) { w = n; fn(); } }).observe(node);
}
function chart(svg, render) { render(); onWidth(svg.parentElement, render); }
function size(svg, H) {
  const W = Math.max(280, svg.parentElement.clientWidth - 40);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H); svg.replaceChildren(); defs(svg);
  return W;
}

// ---------- tooltip ----------
const tip = $("#tip");
function showTip(html, ev, anchor) {
  tip.innerHTML = html; tip.hidden = false;
  let x, y;
  if (ev && ev.clientX !== undefined && ev.type.startsWith("mouse")) { x = ev.clientX; y = ev.clientY; }
  else { const r = anchor.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, x - tw / 2)) + "px";
  tip.style.top = (y - th - 14 < 8 ? y + 18 : y - th - 14) + "px";
}
function hideTip() { tip.hidden = true; }
addEventListener("scroll", hideTip, {passive: true});
function hover(node, html) {
  const on = ev => showTip(html(), ev, node);
  node.addEventListener("mouseenter", on); node.addEventListener("mousemove", on); node.addEventListener("mouseleave", hideTip);
  node.addEventListener("focus", on); node.addEventListener("blur", hideTip);
}
const tipHead = h => `<b><i class="sw sw-${h}"></i>${NAME[h]}</b>`;

function tween(dur, step, done) {
  if (REDUCED || dur <= 0) { step(1); done && done(); return; }
  const t0 = performance.now();
  const f = now => { const k = Math.min(1, (now - t0) / dur); step(1 - Math.pow(1 - k, 3)); k < 1 ? requestAnimationFrame(f) : done && done(); };
  requestAnimationFrame(f);
}
function tabs(root, attr, fn) {
  const bs = $$(`[role=tab][data-${attr}]`, root);
  bs.forEach(b => b.addEventListener("click", () => { bs.forEach(x => x.setAttribute("aria-selected", String(x === b))); fn(b.dataset[attr]); }));
}

// =====================================================================
// Video: one player, two cuts
// =====================================================================
// Subtitles are a WebVTT track, so the player's captions button turns them on and off; switching cuts keeps that choice.
(function videoTabs() {
  const v = $("#player"); if (!v) return;
  tabs($("#video"), "video", name => {
    const on = v.textTracks.length ? v.textTracks[0].mode === "showing" : true;
    v.pause(); v.poster = `static/videos/${name}_poster.jpg${VER}`;
    v.querySelector("source").src = `static/videos/${name}.mp4${VER}`;
    const old = v.querySelector("track"), tr = old.cloneNode();
    tr.src = `static/videos/${name}.vtt${VER}`; tr.default = on; old.replaceWith(tr);
    v.load(); tr.track.mode = on ? "showing" : "hidden";
  });
})();

// =====================================================================
// Floating window: hovering a head card or a term plays a muted, looping clip beside it. The clips are
// rendered from the explainer animatic without subtitles, cropped to their content (see README).
// =====================================================================
const PEEK = (() => {
  const peek = $("#peek"), box = $(".peek-vid", peek), TOUCH = matchMedia("(hover: none)").matches;
  // pixel size of each clip, and its display scale (CSS px per clip px); the four heads share one scale
  const CLIPS = {DF: [1262, 784, .42], CF: [1408, 750, .42], DR: [1770, 836, .42], CR: [1426, 678, .42],
    jerk: [1844, 852, .5], resp: [1878, 876, .5]};
  const vids = Object.fromEntries(Object.entries(CLIPS).map(([k, [w, h]]) => {
    const v = document.createElement("video");
    Object.assign(v, {muted: true, loop: true, playsInline: true, preload: "none", hidden: true, width: w, height: h});
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.src = `static/videos/peek/${k.toLowerCase()}.mp4${VER}`; box.append(v); return [k, v];
  }));
  // start loading a clip once its anchor is near the viewport
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; const v = vids[e.target.dataset.peek];
    if (v.preload !== "auto") { v.preload = "auto"; v.load(); } io.unobserve(e.target);
  }), {rootMargin: "600px"});
  let open = null;   // the element whose clip is showing
  function place() {
    const [cw, , sc] = CLIPS[open.dataset.peek], r = open.getBoundingClientRect(), m = 14;
    const w = Math.min(Math.round(cw * sc) + 12, innerWidth - 2 * m);
    peek.style.width = w + "px"; const h = peek.offsetHeight;
    let x, y = r.top + r.height / 2 - h / 2;
    if (r.right + m + w <= innerWidth - m) x = r.right + m;          // beside the anchor, on whichever side has room
    else if (r.left - m - w >= m) x = r.left - m - w;
    else { x = (innerWidth - w) / 2; y = r.top - m - h >= m ? r.top - m - h : r.bottom + m; }
    peek.style.left = x + "px"; peek.style.top = Math.max(m, Math.min(innerHeight - h - m, y)) + "px";
  }
  function show(el) {
    const k = el.dataset.peek, v = vids[k];
    if (open !== el) {
      if (open) open.classList.remove("playing");
      Object.entries(vids).forEach(([j, x]) => { x.hidden = j !== k; if (j !== k) x.pause(); });
      v.currentTime = 0; open = el;
    }
    el.classList.add("playing"); place(); peek.classList.add("on");
    if (REDUCED) { v.pause(); v.currentTime = Math.max(0, (v.duration || 0) - .2); }   // the clip's final frame, still
    else v.play().catch(() => {});
  }
  function hide() {
    if (!open) return;
    open.classList.remove("playing"); peek.classList.remove("on"); vids[open.dataset.peek].pause(); open = null;
  }
  addEventListener("scroll", () => { if (open) place(); }, {passive: true});
  addEventListener("resize", () => { if (open) place(); });
  addEventListener("keydown", e => { if (e.key === "Escape") hide(); });
  if (TOUCH) document.addEventListener("click", e => { if (open && !e.target.closest("[data-peek]")) hide(); });
  function bind(el, k) {
    el.dataset.peek = k; io.observe(el);
    el.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") show(el); });
    el.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") hide(); });
    el.addEventListener("click", () => { if (TOUCH && open === el) hide(); else show(el); });
    el.addEventListener("focus", () => { if (el.matches(":focus-visible")) show(el); });
    el.addEventListener("blur", hide);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(el); } });
  }
  return {bind, TOUCH};
})();

// =====================================================================
// Four heads: each card shows its head's glyph from the explainer video's head map (scene 3 of
// one-model-paper/video/video_demo.html), and hovering it plays that head's part of the map in the
// floating window. The glyph values are schematic.
// =====================================================================
(function heads() {
  const cards = $$(".heads li[data-head]"); if (!cards.length) return;
  const LW = 300, LH = 180, N = 6, M = 6;   // canvas units; positions per chunk and bins per position shown
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
  const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return `rgb(${p.map((v, k) => Math.round(lerp(v, q[k], t))).join(",")})`; };
  const vMean = c => .5 + .27 * Math.sin(2.1 * Math.PI * c / (N - 1) + .6);

  // One-pass heads draw one card; iterative heads keep two earlier steps stacked behind the front card.
  const CARD = {w: 240, h: 140}, DX = 24, DY = 16;
  const SINGLE = {x: (LW - CARD.w) / 2, y: (LH - CARD.h) / 2, ...CARD};
  const stacked = k => ({x: 4 + k * DX, y: LH - 4 - CARD.h - k * DY, ...CARD});

  function card(ctx, b) {
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 10); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
  }
  function ball(ctx, x, y, r, fill, stroke = C.ink) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = stroke; ctx.stroke();
  }
  // One value bar per number, with end caps.
  function bars(ctx, b, alpha = 1) {
    const top = b.y + .16 * b.h, bot = b.y + .84 * b.h, X = c => b.x + (c + .5) / N * b.w, Y = v => bot - v * (bot - top), cap = .12 * b.w / N;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
    for (let c = 0; c < N; c++) { const x = X(c); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot);
      ctx.moveTo(x - cap, top); ctx.lineTo(x + cap, top); ctx.moveTo(x - cap, bot); ctx.lineTo(x + cap, bot); ctx.stroke(); }
    ctx.restore(); return {X, Y, r: Math.min(10, .28 * b.w / N)};
  }
  function grid(b) {
    const pad = .08 * Math.min(b.w, b.h), cw = (b.w - 2 * pad) / N, ch = (b.h - 2 * pad) / M;
    return {sq: Math.min(cw, ch) * .78, X: c => b.x + pad + (c + .5) * cw, Y: r => b.y + pad + (r + .5) * ch};
  }
  function square(ctx, G, c, r) { ctx.beginPath(); ctx.roundRect(G.X(c) - G.sq / 2, G.Y(r) - G.sq / 2, G.sq, G.sq, 3); }
  // Bin probabilities per position; odd positions carry a second, weaker mode.
  function binProbs(c) {
    const best = Math.round((1 - vMean(c)) * (M - 1)), alt = Math.round((1 - clamp(vMean(c) + .38)) * (M - 1)), p = [];
    for (let r = 0; r < M; r++) p.push(Math.exp(-.5 * ((r - best) / .7) ** 2) + (c % 2 ? .5 * Math.exp(-.5 * ((r - alt) / .6) ** 2) : 0) + .03);
    const mx = Math.max(...p); return {p: p.map(v => v / mx), best};
  }
  // Discrete flow: every position always holds a token, and positions land on their final token at steps 1 to 5.
  const DF_ROW = (() => {
    const order = [...Array(N).keys()].sort((a, b) => hash(a, 7) - hash(b, 7)), land = [];
    order.forEach((c, r) => { land[c] = 1 + Math.min(4, Math.floor(r / N * 5)); });
    return (c, step) => { const target = binProbs(c).best;
      return step >= land[c] ? target : (target + 2 + Math.floor(hash(c, 5) * (M - 3))) % M; };
  })();

  const GLYPH = {
    CR(ctx) {
      card(ctx, SINGLE); const L = bars(ctx, SINGLE);
      for (let c = 0; c < N; c++) ball(ctx, L.X(c), L.Y(vMean(c)), L.r, C.CR);
    },
    CF(ctx) {   // back to front: noise, halfway, the chunk
      const noise = c => hash(c + 3, 13);
      [0, .5, 1].forEach((tau, j) => {
        const front = j === 2, bb = stacked(2 - j); ctx.save(); if (!front) ctx.globalAlpha = .6; card(ctx, bb);
        const L = bars(ctx, bb, front ? 1 : .7);
        for (let c = 0; c < N; c++) ball(ctx, L.X(c), L.Y(lerp(noise(c), vMean(c), tau)), L.r,
          front ? C.CF : mix(C.CF, "#FFFFFF", .4), front ? C.ink : "#8A949E");
        ctx.restore();
      });
    },
    DR(ctx) {   // shade = probability, thick ring = argmax
      const G = grid(SINGLE); card(ctx, SINGLE);
      for (let c = 0; c < N; c++) { const {p, best} = binProbs(c);
        for (let r = 0; r < M; r++) { square(ctx, G, c, r); ctx.fillStyle = mix("#FFFFFF", C.DR, .85 * p[r]); ctx.fill();
          ctx.lineWidth = r === best ? 3.2 : 1.6; ctx.strokeStyle = C.ink; ctx.stroke(); } }
    },
    DF(ctx) {   // back to front: steps 1, 3 and 5
      [1, 3, 5].forEach((step, j) => {
        const front = j === 2, bb = stacked(2 - j), G = grid(bb); ctx.save(); if (!front) ctx.globalAlpha = .55; card(ctx, bb);
        for (let c = 0; c < N; c++) for (let r = 0; r < M; r++) {
          square(ctx, G, c, r); ctx.fillStyle = r === DF_ROW(c, step) ? (front ? C.DF : mix(C.DF, "#FFFFFF", .45)) : "#FFFFFF";
          ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = C.ink; ctx.stroke();
        }
        ctx.restore();
      });
    },
  };

  cards.forEach(li => {
    const h = li.dataset.head, cv = $("canvas", li), ctx = cv.getContext("2d");
    $(".glyph-cap", li).textContent = PEEK.TOUCH ? "▶ Tap to watch" : "▶ Hover to watch";
    function draw() {
      const d = devicePixelRatio || 1, w = Math.round(cv.clientWidth * d), hh = Math.round(cv.clientHeight * d);
      if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
      ctx.setTransform(w / LW, 0, 0, hh / LH, 0, 0); ctx.clearRect(0, 0, LW, LH); GLYPH[h](ctx);
    }
    PEEK.bind(li, h); draw(); onWidth(li, draw);
  });
})();

// =====================================================================
// Success-rate chart (data behind paper Figure 1)
// =====================================================================
const SUCCESS = {"robomimic":{"Can":{"cfg0":{"DF":[100.0,99.0,100.0],"CF":[100.0,99.0,100.0],"DR":[87.5,83.8,90.4],"CR":[100.0,99.0,100.0]}},"Square":{"cfg0":{"DF":[90.6,87.3,93.1],"CF":[98.4,96.6,99.3],"DR":[90.6,87.3,93.1],"CR":[81.2,77.1,84.8]}},"Tool Hang":{"cfg0":{"DF":[87.0,83.3,90.0],"CF":[85.0,81.1,88.2],"DR":[15.6,12.4,19.6],"CR":[12.5,9.6,16.2]}},"Transport":{"cfg0":{"DF":[66.0,61.2,70.5],"CF":[63.0,58.1,67.7],"DR":[46.9,42.0,51.8],"CR":[28.1,23.9,32.8]}}},"vla":{"RoboCasa\natomic, seen":{"cfg0":{"DF":[78.0,73.3,82.6],"CF":[76.9,73.1,80.6],"DR":[55.4,53.7,57.1],"CR":[63.0,57.6,68.4]},"cfg2":{"DF":[75.4,72.2,78.6],"CF":[78.1,76.8,79.5],"DR":[75.9,73.6,78.2]}},"RoboCasa\ncomposite, seen":{"cfg0":{"DF":[38.5,34.6,42.5],"CF":[37.7,36.6,38.8],"DR":[10.4,8.4,12.4],"CR":[23.1,20.6,25.6]},"cfg2":{"DF":[41.2,37.8,44.7],"CF":[37.3,35.3,39.2],"DR":[33.1,29.2,37.0]}},"RoboCasa\ncomposite, unseen":{"cfg0":{"DF":[37.3,33.5,41.1],"CF":[36.9,31.4,42.3],"DR":[11.9,9.6,14.1],"CR":[27.3,23.2,31.4]},"cfg2":{"DF":[42.3,37.2,47.3],"CF":[39.4,37.1,41.6],"DR":[35.2,32.3,38.2]}},"LIBERO\nObject":{"cfg0":{"DF":[95.6,93.1,97.2],"CF":[96.5,94.2,97.9],"DR":[67.0,62.2,71.5],"CR":[89.5,86.1,92.2]},"cfg2":{"DF":[97.0,94.8,98.3],"CF":[94.6,91.8,96.4],"DR":[92.5,89.4,94.7]}},"LIBERO-10":{"cfg0":{"DF":[78.1,73.7,81.9],"CF":[80.9,76.7,84.5],"DR":[55.0,50.0,59.9],"CR":[73.7,69.1,77.8]},"cfg2":{"DF":[79.2,74.9,82.9],"CF":[79.3,75.0,83.0],"DR":[76.2,71.7,80.2]}}},"real":{"Throw bottles\ninto bins":{"cfg0":{"CF":[90.0],"DF":[90.0],"DR":[80.0],"CR":[60.0]}},"Open\npen cap":{"cfg0":{"CF":[70.0],"DF":[70.0],"DR":[40.0],"CR":[40.0]}},"Turn\nmug up":{"cfg0":{"CF":[70.0],"DF":[80.0],"DR":[50.0],"CR":[30.0]}}}};
const NOTES = {
  robomimic: "Trained from scratch, no pretrained backbone. Discrete regression beats continuous regression on Square, Tool Hang and Transport. Error bars: 68% intervals.",
  vla_cfg2: "With guidance, discrete regression beats continuous regression on all five benchmarks. Continuous regression has no guidance. Dashed outlines show the other setting.",
  vla_cfg0: "Without guidance, discrete regression falls behind. Switch to CFG 2 to see what guidance does (Finding 2). Dashed outlines show the other setting.",
  real: "Real-robot success per head and task, as in paper Figure 1."
};

(function successChart() {
  const svg = $("#success-svg"), card = $("#success"); if (!svg) return;
  const seg = $("#cfg-seg"), note = $("#success-note"), table = $("#success-table");
  let set = "robomimic", cfg = "cfg2", shown = null;

  function values(s, c) {
    return Object.entries(SUCCESS[s]).map(([g, d]) => ({g, bars: HEADS.map(h => {
      const cur = (d[c] && d[c][h]) || d.cfg0[h];
      const alt = s === "vla" && h !== "CR" ? d[c === "cfg2" ? "cfg0" : "cfg2"][h] : null;
      return {h, v: cur[0], lo: cur[1], hi: cur[2], alt: alt ? alt[0] : null, noCfg: s === "vla" && h === "CR"};
    })}));
  }
  function render(k = 1, from = null) {
    const W = size(svg, 1), small = W < 560;
    const H = small ? 290 : 330, M = {l: 40, r: 6, t: 12, b: small ? 60 : 52};
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("height", H);
    const data = values(set, cfg), PW = W - M.l - M.r, PH = H - M.t - M.b, y0 = M.t + PH, Y = v => y0 - v / 100 * PH;
    const g = el("g", {class: "grid"}, svg), ax = el("g", {class: "axis"}, svg);
    [0, 25, 50, 75, 100].forEach(v => {
      if (v) el("line", {x1: M.l, x2: M.l + PW, y1: Y(v), y2: Y(v)}, g);
      txt(ax, M.l - 8, Y(v) + 4, v + (v === 100 ? "%" : ""), {"text-anchor": "end"});
    });
    const gw = PW / data.length, bw = Math.min(small ? 18 : 30, (gw * 0.78 - 6) / 4), gap = 2;
    data.forEach((grp, gi) => {
      const cx = M.l + gw * (gi + .5), x0 = cx - (4 * bw + 3 * gap) / 2;
      grp.g.split("\n").forEach((line, li) => txt(svg, cx, y0 + 20 + li * 16, line, {"text-anchor": "middle", class: li && set !== "real" ? "gsub" : "glabel", "font-size": small ? 12 : undefined}));
      grp.bars.forEach((b, bi) => {
        const x = x0 + bi * (bw + gap), prev = from ? from[gi].bars[bi].v : b.v, v = prev + (b.v - prev) * k;
        if (b.alt != null) el("path", {d: barPath(x + .75, y0, bw - 1.5, y0 - Y(b.alt)), fill: "none", stroke: C["ink-3"], "stroke-width": 1.2, "stroke-dasharray": "3 2.5", opacity: .8}, svg);
        const bar = el("path", {d: barPath(x, y0, bw, y0 - Y(v)), fill: fillOf(svg, b.h), stroke: edgeOf(b.h), "stroke-width": 1, class: "bar"}, svg);
        const hasIv = b.lo != null && !(b.lo === b.v && b.hi === b.v);
        if (hasIv && k === 1) { const ex = x + bw / 2; el("path", {d: `M${ex},${Y(b.lo)}V${Y(b.hi)}M${ex - 3},${Y(b.lo)}h6M${ex - 3},${Y(b.hi)}h6`, class: "err", fill: "none"}, svg); }
        const hit = el("rect", {x: x - gap / 2, y: M.t, width: bw + gap, height: PH, fill: "transparent", tabindex: 0, role: "img", "aria-label": `${NAME[b.h]}, ${grp.g.replace("\n", " ")}: ${fmt(b.v)}%`}, svg);
        const on = ev => {
          svg.classList.add("dim"); bar.classList.add("hot");
          const iv = hasIv ? `<br>interval ${fmt(b.lo)} to ${fmt(b.hi)}%` : "";
          const extra = b.noCfg ? "<br>no guidance for this head" : (b.alt != null ? `<br>${cfg === "cfg2" ? "CFG 0" : "CFG 2"}: ${fmt(b.alt)}%` : "");
          showTip(`${tipHead(b.h)}${grp.g.replace("\n", " ")}: <b style="display:inline">${fmt(b.v)}%</b>${iv}${extra}`, ev, hit);
        };
        const off = () => { svg.classList.remove("dim"); bar.classList.remove("hot"); hideTip(); };
        hit.addEventListener("mouseenter", on); hit.addEventListener("mousemove", on); hit.addEventListener("mouseleave", off);
        hit.addEventListener("focus", on); hit.addEventListener("blur", off);
      });
    });
    el("line", {x1: M.l, x2: M.l + PW, y1: y0, y2: y0, class: "base"}, svg);
    shown = data;
  }
  function renderTable() {
    const data = values(set, cfg);
    table.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Benchmark</th>${HEADS.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
      data.map(d => `<tr><td>${d.g.replace("\n", " ")}</td>${d.bars.map(b => `<td>${fmt(b.v)}%</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function update(animate) {
    seg.hidden = set !== "vla";
    note.textContent = set === "vla" ? NOTES["vla_" + cfg] : NOTES[set];
    const before = shown;
    if (animate && before && before.length === Object.keys(SUCCESS[set]).length) tween(380, k => render(k, before), () => render(1));
    else render(1);
    renderTable();
  }
  tabs(card, "set", s => { set = s; update(false); });
  $$("button[data-cfg]", seg).forEach(b => b.addEventListener("click", () => {
    $$("button[data-cfg]", seg).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    cfg = b.dataset.cfg; update(true);
  }));
  update(false);
  onWidth(svg.parentElement, () => render(1));
})();

// =====================================================================
// Rollouts: five recorded real-robot trials per head, plus RoboCasa
// =====================================================================
// 1 = success, 0 = failure, in recording order
const TRIALS = {"bottle":{"DF":[1,1,0,1,1],"CF":[1,1,0,1,1],"DR":[0,1,1,1,1],"CR":[0,0,1,1,1]},"pen_cap":{"DF":[1,1,1,0,0],"CF":[1,1,1,0,0],"DR":[0,1,0,1,0],"CR":[1,1,0,0,0]},"turn_mug":{"DF":[1,0,1,1,1],"CF":[1,1,0,1,1],"DR":[1,0,1,1,0],"CR":[0,1,1,0,0]}};
const ROBOCASA = {DF: [53.9, "Mug to coffee machine"], CF: [52.3, "Close the fridge"], DR: [50.2, "Egg into the pan"], CR: [38.8, "Fish into the cabinet"]};
const chipHTML = h => `<span class="chip${FLOW[h] ? " chip-flow" : ""}" style="--c:var(--${h})">${h}</span>`;

(function rollouts() {
  const card = $("#rollouts"); if (!card) return;
  const grid = $("#grid"), note = $("#rollout-note");
  let visible = false;
  const io = new IntersectionObserver(es => es.forEach(e => {
    visible = e.isIntersecting;
    $$("video", grid).forEach(v => { if (visible && !REDUCED) v.play().catch(() => {}); else v.pause(); });
  }), {threshold: 0.2});
  io.observe(grid);
  const play = v => { if (visible && !REDUCED) v.play().catch(() => {}); };

  function makeVideo() {
    const v = document.createElement("video");
    Object.assign(v, {muted: true, loop: true, playsInline: true, preload: "metadata", controls: REDUCED});
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    return v;
  }
  function speedMark() {
    const s = document.createElement("span"); s.className = "speed"; s.textContent = "2×";
    s.setAttribute("aria-label", "2 times speed"); return s;
  }
  function real(task) {
    grid.className = "grid4"; grid.replaceChildren();
    HEADS.forEach(h => {
      const outcomes = TRIALS[task][h], wins = outcomes.reduce((a, b) => a + b, 0);
      const cell = document.createElement("div"); cell.className = "cell";
      const clip = document.createElement("div"); clip.className = "clip";
      const v = makeVideo(); v.setAttribute("aria-label", `${NAME[h]}, ${task.replace("_", " ")}`);
      const tag = document.createElement("div"); tag.className = "tag"; tag.innerHTML = `${chipHTML(h)}${wins}/5 <small>succeeded</small>`;
      const badge = document.createElement("span"); badge.className = "badge";
      clip.append(v, tag, speedMark(), badge);
      const row = document.createElement("div"); row.className = "trials"; row.innerHTML = "<span>Trial</span>";
      const btns = outcomes.map((ok, i) => {
        const b = document.createElement("button"); b.type = "button"; b.className = ok ? "ok" : "no"; b.textContent = i + 1;
        b.setAttribute("aria-label", `Trial ${i + 1}, ${ok ? "success" : "failure"}`);
        b.addEventListener("click", () => pick(i)); row.append(b); return b;
      });
      function pick(i) {
        btns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
        badge.className = "badge " + (outcomes[i] ? "ok" : "no");
        badge.textContent = `Trial ${i + 1}: ${outcomes[i] ? "success" : "failure"}`;
        v.src = `static/videos/real/${task}_${h.toLowerCase()}_${i + 1}.mp4`; play(v);
      }
      pick(Math.max(0, outcomes.indexOf(1)));
      cell.append(clip, row); grid.append(cell);
    });
    note.textContent = "Five recorded trials per head, top camera. Green trials succeeded and red ones failed; pick a trial under each clip.";
  }
  function sim() {
    grid.className = "grid4 sim"; grid.replaceChildren();
    HEADS.forEach(h => {
      const clip = document.createElement("div"); clip.className = "clip";
      const v = makeVideo(); v.src = `static/videos/robocasa/${h.toLowerCase()}.mp4`; v.setAttribute("aria-label", `${NAME[h]}, RoboCasa`);
      const tag = document.createElement("div"); tag.className = "tag"; tag.innerHTML = `${chipHTML(h)}${ROBOCASA[h][0]}%`;
      const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = ROBOCASA[h][1];
      clip.append(v, tag, speedMark(), badge); grid.append(clip); play(v);
    });
    note.textContent = "One successful RoboCasa rollout per head. The number is the head's pooled RoboCasa success (DF, CF and DR with guidance).";
  }
  tabs(card, "task", t => t === "robocasa" ? sim() : real(t));
  real("bottle");
})();

// =====================================================================
// Ratio-to-expert row charts: jerk ratio (log scale) and state responsiveness
// =====================================================================
function ratioChart(svg, {rows, log, domain, ticks, tipFmt}) {
  chart(svg, () => {
    const rh = 40, top = 24, H = top + rows.length * rh + 30, W = size(svg, H);
    const L = 64, R = W - 56, f = log ? Math.log10 : (v => v);
    const X = v => L + (f(v) - f(domain[0])) / (f(domain[1]) - f(domain[0])) * (R - L);
    const bottom = top + rows.length * rh;
    ticks.forEach(v => {
      el("line", {x1: X(v), x2: X(v), y1: v === 1 ? top - 4 : top, y2: bottom, stroke: v === 1 ? C.ink : GRID, "stroke-width": v === 1 ? 1.5 : 1, "stroke-dasharray": v === 1 ? "4 3" : null}, svg);
      txt(svg, X(v), bottom + 17, String(v), {"text-anchor": "middle", "font-size": 12.5, fill: v === 1 ? C.ink : C["ink-3"], "font-weight": v === 1 ? 700 : 500});
    });
    txt(svg, X(1), top - 8, "expert", {"text-anchor": "middle", "font-size": 12.5, "font-weight": 800, fill: C.ink});
    rows.forEach(([h, m, lo, hi], i) => {
      const y = top + i * rh + rh / 2;
      headLabel(svg, L - 12, y, h);
      if (lo != null) el("line", {x1: X(lo), x2: X(hi), y1: y, y2: y, stroke: lineOf(h), "stroke-width": 6, "stroke-linecap": "round", opacity: .45}, svg);
      else el("line", {x1: X(domain[0]), x2: X(m), y1: y, y2: y, stroke: lineOf(h), "stroke-width": 2.5}, svg);
      el("circle", {cx: X(m), cy: y, r: 7, fill: fillOf(svg, h), stroke: FLOW[h] ? C[h + "-edge"] : "#fff", "stroke-width": 1.8}, svg);
      txt(svg, R + 12, y + 5, m.toFixed(2), {"font-size": 14, "font-weight": 800, fill: C.ink});
      const hit = el("rect", {x: L, y: y - rh / 2, width: R - L, height: rh, fill: "transparent", tabindex: 0}, svg);
      hover(hit, () => tipHead(h) + tipFmt(m, lo, hi));
    });
  });
}
(function why() {
  const j = $("#jerk-svg"), r = $("#resp-svg");
  // RoboCasa held-out chunks, no guidance, flow heads at 10 steps: [median, q25, q75]
  if (j) ratioChart(j, {log: true, domain: [0.03, 2], ticks: [0.03, 0.1, 0.3, 1],
    rows: [["DF", .501, .351, .724], ["CF", .345, .220, .527], ["DR", .740, .427, 1.209], ["CR", .070, .041, .118]],
    tipFmt: (m, lo, hi) => `median ${m.toFixed(2)}<br>middle half ${lo.toFixed(2)} to ${hi.toFixed(2)}`});
  // paper Figure 3: median chunk shift divided by the expert's
  if (r) ratioChart(r, {log: false, domain: [0, 1.1], ticks: [0, 0.25, 0.5, 0.75, 1],
    rows: [["DF", .70], ["CF", .63], ["DR", .94], ["CR", .58]],
    tipFmt: m => `responds ${Math.round(m * 100)}% as much as the expert`});
})();

// Terms: hovering one plays its definition from the explainer in the floating window
$$(".term[data-term]").forEach(t => PEEK.bind(t, t.dataset.term));

// =====================================================================
// Push-T scenes, drawn like the explainer video (data: window.PT, the Push-T state of paper Figure 5)
// =====================================================================
const PTC = {A: C.modeA, B: C.modeB, red: css.getPropertyValue("--switch").trim(), other: css.getPropertyValue("--other").trim()};
const clamp01 = v => Math.max(0, Math.min(1, v));
const pts = a => a.map(p => p.join(",")).join(" ");

// Scene in Push-T pixel coordinates: shaded sides of the mirror line, target, block, A/B labels.
function ptScene(svg, notes) {
  const P = window.PT, X = 20, Y = 110, W = 380;
  const d = el("defs", {}, svg), cp = el("clipPath", {id: svg.id + "-clip"}, d);
  el("rect", {x: X, y: Y, width: W, height: W, rx: 7}, cp);
  const body = el("g", {"clip-path": `url(#${svg.id}-clip)`}, svg);
  el("rect", {x: X, y: Y, width: W, height: W, fill: "#F4F6F8"}, body);
  const [a0, a1] = P.axis, dl = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), ux = (a1[0] - a0[0]) / dl, uy = (a1[1] - a0[1]) / dl;
  const sg = Math.sign((300 - a0[0]) * -uy + (400 - a0[1]) * ux), nx = -uy * sg, ny = ux * sg, F = 900;
  const L0 = [a0[0] - ux * F, a0[1] - uy * F], L1 = [a1[0] + ux * F, a1[1] + uy * F];
  [[-1, PTC.A], [1, PTC.B]].forEach(([s, c]) => el("polygon", {points: pts([L0, L1, [L1[0] + s * nx * F, L1[1] + s * ny * F], [L0[0] + s * nx * F, L0[1] + s * ny * F]]), fill: c, opacity: .18}, body));
  el("line", {x1: L0[0], y1: L0[1], x2: L1[0], y2: L1[1], stroke: C["ink-3"], "stroke-width": 1.2, "stroke-dasharray": "4.4 4.4"}, body);
  P.goal.forEach(g => el("polygon", {points: pts(g), fill: "#E5F0E3", stroke: "#9BC298", "stroke-width": 1.1}, body));
  P.block.forEach(g => el("polygon", {points: pts(g), fill: "#D5D5CF", stroke: "#94948C", "stroke-width": 1.1}, body));
  const layer = el("g", {}, body);
  el("rect", {x: X, y: Y, width: W, height: W, rx: 7, fill: "none", stroke: C["steel-2"], "stroke-width": .8}, svg);
  txt(svg, 72, 289, "A", {"font-size": 22, "font-weight": 800, fill: PTC.A});
  txt(svg, 269, 403, "B", {"font-size": 22, "font-weight": 800, fill: PTC.B});
  if (notes) {
    txt(svg, 330, 196, "mirror line", {"font-size": 10.5, fill: C["ink-3"], "text-anchor": "middle", transform: "rotate(-45 330 196)"});
    txt(svg, 291, 294, "target", {"font-size": 11, "font-weight": 800, fill: "#5E8A55"});
    txt(svg, 150, 444, "T block", {"font-size": 11, "font-weight": 800, fill: C["ink-2"]});
  }
  const top = el("g", {}, svg);
  el("circle", {cx: P.agent[0], cy: P.agent[1], r: 8, fill: C.ink}, top);
  if (notes) txt(top, P.agent[0] + 12, P.agent[1] - 9, "pusher", {"font-size": 11, "font-weight": 800, fill: C.ink});
  return {layer, top};
}

// A route revealed up to u steps; a step split at the mirror line is revealed part by part.
function ptRoute(parent, segs, w) {
  const under = segs.map(() => el("line", {stroke: "#fff", "stroke-width": w + 2.2, "stroke-linecap": "round"}, parent));
  const over = segs.map(s => el("line", {stroke: s[2], "stroke-width": w, "stroke-linecap": "round"}, parent));
  const last = segs[segs.length - 1], end = el("circle", {cx: last[1][0], cy: last[1][1], r: 4, fill: last[2]}, parent);
  const steps = Math.max(...segs.map(s => s[3])) + 1;
  return u => {
    segs.forEach(([q0, q1, , s, t0, t1], k) => {
      const f = clamp01(u - s), on = f > t0, g = on ? (t1 > t0 ? Math.min(1, (f - t0) / (t1 - t0)) : 1) : 0;
      const x2 = q0[0] + (q1[0] - q0[0]) * g, y2 = q0[1] + (q1[1] - q0[1]) * g;
      [under[k], over[k]].forEach(l => { l.setAttribute("x1", q0[0]); l.setAttribute("y1", q0[1]); l.setAttribute("x2", x2); l.setAttribute("y2", y2); l.style.display = on ? "" : "none"; });
    });
    end.style.display = u >= steps ? "" : "none";
  };
}

// Play once when the card scrolls into view; Replay/scrub after that.
function autoplay(card, play) {
  if (REDUCED) return;
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); play(); } }, {threshold: .45});
  io.observe(card);
}

(function ptSwitch() {
  const card = $("#pt-switch"); if (!card || !window.PT) return;
  const P = window.PT, svg = $("#pt-scene"), prob = $("#pt-prob"), scrub = $("[data-scrub]", card);
  const {layer} = ptScene(svg, true);
  const drawA = ptRoute(layer, P.routes.A, 2.3), drawB = ptRoute(layer, P.routes.B, 2.3);
  const drGroup = el("g", {}, layer), drawDR = ptRoute(drGroup, P.routes.DR, 3.1);
  const sw = P.routes.DR.find(s => s[2] === "#C84532"), mx = (sw[0][0] + sw[1][0]) / 2, my = (sw[0][1] + sw[1][1]) / 2;
  const mark = el("g", {}, svg);
  el("circle", {cx: mx, cy: my, r: 16, fill: "none", stroke: PTC.red, "stroke-width": 1.6}, mark);
  txt(mark, mx + 21, my + 4, "switch", {"font-size": 12.5, "font-weight": 800, fill: PTC.red});

  // probability of each mode along the chunk
  const gx = h => 52 + h / 15 * 528, gy = v => 214 - v * 190;
  [0, .5, 1].forEach(v => {
    el("line", {x1: gx(0), x2: gx(15), y1: gy(v), y2: gy(v), stroke: v ? "#E3E8ED" : C["steel-3"]}, prob);
    txt(prob, gx(0) - 10, gy(v) + 5, v ? Math.round(v * 100) + "%" : "0", {"text-anchor": "end", "font-size": 14, fill: C["ink-3"]});
  });
  [0, 7, 9, 15].forEach(h => txt(prob, gx(h), gy(0) + 22, h, {"text-anchor": "middle", "font-size": 14, fill: C["ink-3"]}));
  txt(prob, gx(15), gy(0) + 44, "step in the chunk", {"text-anchor": "end", "font-size": 14, fill: C["ink-3"]});
  const bd = P.domA.indexOf(1) - .5;
  el("line", {x1: gx(bd), x2: gx(bd), y1: gy(1), y2: gy(0), stroke: "#7B858D", "stroke-width": 1.6, "stroke-dasharray": "6 5"}, prob);
  el("polyline", {points: pts(P.probA.map((v, h) => [gx(h), gy(1 - v)])), fill: "none", stroke: PTC.B, "stroke-width": 3.5, "stroke-linejoin": "round"}, prob);
  el("polyline", {points: pts(P.probA.map((v, h) => [gx(h), gy(v)])), fill: "none", stroke: PTC.A, "stroke-width": 3.5, "stroke-linejoin": "round"}, prob);
  txt(prob, gx(3), gy(.5) + 10, "B", {"text-anchor": "middle", "font-size": 30, "font-weight": 800, fill: PTC.B});
  txt(prob, gx(11.5), gy(.5) + 10, "A", {"text-anchor": "middle", "font-size": 30, "font-weight": 800, fill: PTC.A});
  const cursor = el("line", {y1: gy(1) - 6, y2: gy(0), stroke: C.DR, "stroke-width": 3}, prob);
  P.probA.forEach((v, h) => {
    const hit = el("rect", {x: gx(h) - 17, y: gy(1), width: 34, height: gy(0) - gy(1), fill: "transparent", tabindex: 0}, prob);
    hover(hit, () => `<b>Step ${h}</b>mode A ${Math.round(v * 100)}%, mode B ${Math.round((1 - v) * 100)}%`);
  });

  const beats = $$("[data-at]", card);
  function set(u) {
    drawA(16); drawB(16); drawDR(u);
    mark.style.display = u >= 10 ? "" : "none";
    const cur = u > 0 && u < 16 ? Math.min(15, Math.floor(u)) : -1;
    cursor.style.display = cur >= 0 ? "" : "none";
    if (cur >= 0) { cursor.setAttribute("x1", gx(cur)); cursor.setAttribute("x2", gx(cur)); }
    beats.forEach(b => b.classList.toggle("off", u < +b.dataset.at));
    scrub.value = u;
  }
  let raf = 0;
  function play() {
    cancelAnimationFrame(raf);
    const t0 = performance.now(), dur = 5200;
    const f = now => { const u = 16 * clamp01((now - t0) / dur); set(u); if (u < 16) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
  }
  scrub.addEventListener("input", () => { cancelAnimationFrame(raf); set(+scrub.value); });
  $("[data-play]", card).addEventListener("click", play);
  set(REDUCED ? 16 : 0);
  if (REDUCED) set(16); else autoplay(card, play);
})();

// Discrete flow commits a few tokens per round, each seeing the ones already chosen; one early odd pick is revised.
const DF_ROUNDS = [[2, 13, 9], [0, 5, 11, 15], [3, 7, 12], [1, 6, 10, 14], [4, 8]];   // chips that commit in rounds 1..5
const DF_ODD = 9, DF_FLIP = 3;                                                     // chip 9 first picks A, then flips to B in round 3
(function consensus() {
  const card = $("#pt-consensus"); if (!card || !window.PT) return;
  const P = window.PT, svg = $("#cs-scene"), chips = $("#cs-chips"), note = $("#cs-note");
  const {layer} = ptScene(svg, false);
  const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
  const RB = Array.from({length: 16}, (_, h) => P.routes.B.find(s => s[3] === h && s[5] === 1)[1]), RA = P.chunk;
  const RND = Array.from({length: 16}, (_, h) => [70 + 300 * hash(h, 3), 160 + 300 * hash(h, 5)]);
  const chipsAt = r => { const st = Array(16).fill(null); DF_ROUNDS.slice(0, r).forEach(ks => ks.forEach(k => { st[k] = "B"; })); if (r >= 1 && r < DF_FLIP) st[DF_ODD] = "A"; return st; };
  const colorOf = c => c === "A" ? PTC.A : c === "B" ? PTC.B : PTC.other;

  const drG = el("g", {}, layer); ptRoute(drG, P.routes.DR, 3.1)(16);
  const dfG = el("g", {}, layer);
  const cx = h => h * 36 + 3;
  const NOTES = ["Dark chips are random tokens, in neither mode.", "New picks see the tokens chosen so far.", "New picks see the tokens chosen so far.",
    "The odd A pick is revised to match its neighbors.", "The rest follow the majority.", "All 16 agree: one route on side B."];
  let round = 0;
  function set(r) {
    round = r;
    $$(".rounds button", card).forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.r === r)));
    drG.setAttribute("opacity", r > 0 ? .2 : 1);
    const st = chipsAt(r), path = [P.agent, ...st.map((c, h) => c === "B" ? RB[h] : c === "A" ? RA[h] : RND[h])];
    dfG.replaceChildren();
    if (r === 5) el("polyline", {points: pts(path), fill: "none", stroke: C["DF-edge"], "stroke-width": 4.6, "stroke-linejoin": "round", "stroke-linecap": "round"}, dfG);
    el("polyline", {points: pts(path), fill: "none", stroke: r === 5 ? C.DF : "rgba(30,41,53,.55)", "stroke-width": r === 5 ? 3.2 : 1.6, "stroke-linejoin": "round", "stroke-linecap": "round"}, dfG);
    path.slice(1).forEach((p, h) => el("circle", {cx: p[0], cy: p[1], r: r === 5 ? 3 : 2.6, fill: colorOf(st[h]), stroke: "#FAFBFC", "stroke-width": .8}, dfG));
    // chips
    chips.replaceChildren();
    txt(chips, 0, 16, "Discrete regression: one pass", {"font-size": 15, "font-weight": 800, fill: C.ink});
    P.domA.forEach((a, h) => el("rect", {x: cx(h), y: 26, width: 30, height: 30, rx: 5, fill: a ? PTC.A : PTC.B}, chips));
    txt(chips, 0, 76, "every token votes alone, so the chunk switches sides", {"font-size": 14, "font-weight": 700, fill: PTC.red});
    txt(chips, 0, 112, r === 0 ? "Discrete flow: starts from random tokens" : `Discrete flow: round ${r} of 5`, {"font-size": 15, "font-weight": 800, fill: C.ink});
    const fresh = r > 0 ? DF_ROUNDS[r - 1] : [];
    st.forEach((c, h) => {
      const flip = r === DF_FLIP && h === DF_ODD, ring = flip ? "flip" : fresh.includes(h) ? "new" : null;
      el("rect", {x: cx(h), y: 148, width: 30, height: 30, rx: 5, fill: colorOf(c)}, chips);
      if (ring) el("rect", {x: cx(h) - 3, y: 145, width: 36, height: 36, rx: 7, fill: "none", stroke: flip ? PTC.red : C.ink, "stroke-width": flip ? 3.2 : 2.2}, chips);
    });
    // each new pick sees the nearest tokens already chosen
    if (r > 0 && r < 5) {
      const prev = chipsAt(r - 1);
      fresh.forEach(h => [-1, 1].forEach(dd => {
        let q = h + dd; while (q >= 0 && q < 16 && !prev[q]) q += dd;
        if (q < 0 || q >= 16) return;
        el("path", {d: `M${cx(q) + 15},145 Q${(cx(q) + cx(h)) / 2 + 15},124 ${cx(h) + 15},145`, fill: "none", stroke: C["ink-2"], "stroke-width": 1.5}, chips);
      }));
    }
    note.textContent = NOTES[r];
    note.className = "cs-note" + (r === DF_FLIP ? " flip" : r === 5 ? " done" : "");
  }
  let timer = 0;
  function play() {
    clearInterval(timer); set(0);
    timer = setInterval(() => { if (round >= 5) { clearInterval(timer); return; } set(round + 1); }, 1100);
  }
  $$(".rounds button", card).forEach(b => b.addEventListener("click", () => { clearInterval(timer); set(+b.dataset.r); }));
  $("[data-play]", card).addEventListener("click", play);
  set(REDUCED ? 5 : 0);
  autoplay(card, play);
})();

// =====================================================================
// Factorization toy: product of two correct marginals
// =====================================================================
(function factorToy() {
  const svg = $("#factor-svg"); if (!svg) return;
  const range = $("#q"), out = $("#q-out"), big = $("#wrong-mass");
  defs(svg);
  const G = {x: 140, y: 92, s: 270}, cs = G.s / 2, BM = 46, root = el("g", {}, svg);
  function draw() {
    const q = +range.value / 100, p = [q, 1 - q], lab = ["A", "B"];
    root.replaceChildren();
    txt(root, G.x + G.s / 2, 14, "token 1 picks x: p(x)", {"text-anchor": "middle", "font-size": 13, fill: C["ink-2"], "font-weight": 700});
    txt(root, 16, G.y + G.s / 2, "token 2 picks y: p(y)", {"text-anchor": "middle", "font-size": 13, fill: C["ink-2"], "font-weight": 700, transform: `rotate(-90 16 ${G.y + G.s / 2})`});
    [0, 1].forEach(i => {
      const h = BM * p[i], bx = G.x + cs * i + cs / 2 - 22;
      el("path", {d: barPath(bx, G.y - 10, 44, h), fill: C.DR}, root);
      txt(root, bx + 22, G.y - 16 - h, (p[i] * 100).toFixed(1) + "%", {"text-anchor": "middle", "font-size": 12.5, fill: C.ink, "font-weight": 700});
      // p(y) bars grow leftward from the grid edge: mirror a rightward bar about that edge
      const w = BM * p[i], by = G.y + cs * i + cs / 2 - 22, ex = G.x - 10;
      el("path", {d: barPath(ex, by, 44, w, true), fill: C.DR, transform: `translate(${2 * ex},0) scale(-1,1)`}, root);
      txt(root, ex - w - 6, by + 26, (p[i] * 100).toFixed(1) + "%", {"text-anchor": "end", "font-size": 12.5, fill: C.ink, "font-weight": 700});
      txt(root, G.x + cs * i + cs / 2, G.y + G.s + 20, `x of mode ${lab[i]}`, {"text-anchor": "middle", "font-size": 12.5, fill: i ? C.modeB : C.modeA, "font-weight": 700});
    });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const m = p[c] * p[r], valid = r === c, x = G.x + c * cs, y = G.y + r * cs;
      el("rect", {x, y, width: cs, height: cs, fill: valid ? "#fff" : "#FBEFED", stroke: C["steel-3"]}, root);
      // square area is proportional to the cell's probability mass; leave a strip at the bottom for the label
      const side = Math.sqrt(m) * (cs - 36), cy = y + (cs - 22) / 2 + 2;
      el("rect", {x: x + (cs - side) / 2, y: cy - side / 2, width: side, height: side, rx: 3,
        fill: valid ? (r ? C.modeB : C.modeA) : `url(#hatch-wrong-${svg.id})`, stroke: valid ? "none" : C.wrong}, root);
      const inside = side > 56;
      txt(root, x + cs / 2, inside ? cy + 6 : y + 22, (m * 100).toFixed(m < .1 ? 2 : 1) + "%", {"text-anchor": "middle", "font-size": 17, "font-weight": 800,
        fill: inside ? "#fff" : (valid ? C.ink : C.wrong)});
      txt(root, x + cs / 2, y + cs - 9, valid ? `mode ${lab[r]}: valid` : "mixed: invalid", {"text-anchor": "middle", "font-size": 12.5, "font-weight": 700, fill: valid ? C["ink-2"] : C.wrong});
    }
    out.textContent = (q * 100).toFixed(1) + "%";
    big.textContent = (2 * q * (1 - q) * 100).toFixed(1) + "%";
  }
  range.addEventListener("input", draw);
  $$("[data-q]").forEach(b => b.addEventListener("click", () => {
    const a = +range.value, t = +b.dataset.q;
    tween(420, k => { range.value = a + (t - a) * k; draw(); });
  }));
  draw();
})();

// =====================================================================
// Fix 1: RoboCasa pooled success, with the guidance gain for DR
// =====================================================================
(function fixes() {
  const svg = $("#fixes-svg"); if (!svg) return;
  chart(svg, () => {
    const rows = [["DF", 53.9], ["CF", 52.3], ["DR", 50.2, 25.8], ["CR", 38.8]];
    const rh = 40, top = 6, H = top + rows.length * rh + 26, W = size(svg, H), small = W < 420;
    const L = 64, R = W - 52, X = v => L + v / 60 * (R - L), bottom = top + rows.length * rh;
    [0, 20, 40, 60].forEach(v => {
      el("line", {x1: X(v), x2: X(v), y1: top, y2: bottom, stroke: GRID}, svg);
      txt(svg, X(v), bottom + 18, v + "%", {"text-anchor": "middle", "font-size": 12.5, fill: C["ink-3"]});
    });
    rows.forEach(([h, v, v0], i) => {
      const y = top + i * rh + 8, t = 24;
      headLabel(svg, L - 12, y + t / 2, h);
      if (v0 != null) {
        // stacked: the unguided result, then the gain from guidance in a lighter tint of the same head color
        el("path", {d: barPath(L, y, t, X(v) - L, true), fill: "#E7B787", stroke: C.DR, "stroke-width": 1}, svg);
        el("rect", {x: L, y, width: X(v0) - L, height: t, fill: C.DR}, svg);
        txt(svg, X(v0) - 7, y + 17, small ? `${v0}%` : `CFG 0: ${v0}%`, {"text-anchor": "end", "font-size": 12.5, "font-weight": 700, fill: "#fff"});
        if (!small) txt(svg, X(v0) + 8, y + 17, `+${(v - v0).toFixed(1)}`, {"font-size": 12.5, "font-weight": 800, fill: "#5E2F05"});
      } else el("path", {d: barPath(L, y, t, X(v) - L, true), fill: fillOf(svg, h), stroke: edgeOf(h), "stroke-width": 1}, svg);
      txt(svg, X(v) + 8, y + 17, `${v}%`, {"font-size": 14, "font-weight": 800, fill: C.ink});
      const hit = el("rect", {x: L, y: y - 8, width: R - L, height: rh, fill: "transparent", tabindex: 0}, svg);
      hover(hit, () => tipHead(h) + (v0 != null ? `CFG 0: ${v0}%<br>CFG 2: ${v}%` : `${v}%${h === "CR" ? " (no guidance)" : " with CFG 2"}`));
    });
    el("line", {x1: L, x2: L, y1: top, y2: bottom, class: "base"}, svg);
  });
})();

// =====================================================================
// Fix 2: mixed-mode tokens per chunk vs. discrete flow refinement steps
// =====================================================================
(function nfe() {
  const svg = $("#nfe-svg"); if (!svg) return;
  const pts = [[1, 3.615], [2, 4.941], [5, 1.502], [10, 0.570], [20, 0.218]], dr = 3.007;
  chart(svg, () => {
    const H = 214, W = size(svg, H), L = 40, R = W - 14, T = 12, B = H - 40;
    const X = n => L + Math.log(n) / Math.log(20) * (R - L), Y = v => B - v / 5.5 * (B - T);
    [0, 1, 2, 3, 4, 5].forEach(v => { el("line", {x1: L, x2: R, y1: Y(v), y2: Y(v), stroke: GRID}, svg); txt(svg, L - 8, Y(v) + 4, v, {"text-anchor": "end", "font-size": 12.5, fill: C["ink-3"]}); });
    pts.forEach(([n]) => txt(svg, X(n), B + 18, n, {"text-anchor": "middle", "font-size": 12.5, fill: C["ink-3"]}));
    txt(svg, (L + R) / 2, H - 4, "discrete flow refinement steps", {"text-anchor": "middle", "font-size": 12.5, fill: C["ink-2"], "font-weight": 700});
    el("line", {x1: L, x2: R, y1: Y(dr), y2: Y(dr), stroke: C.DR, "stroke-width": 2, "stroke-dasharray": "6 4"}, svg);
    txt(svg, R, Y(dr) - 7, "DR, one pass: 3.01", {"text-anchor": "end", "font-size": 12.5, "font-weight": 800, fill: C.DR});
    el("path", {d: "M" + pts.map(([n, v]) => `${X(n)},${Y(v)}`).join("L"), fill: "none", stroke: C["DF-edge"], "stroke-width": 2.2}, svg);
    pts.forEach(([n, v]) => {
      el("circle", {cx: X(n), cy: Y(v), r: 5.5, fill: C.DF, stroke: C["DF-edge"], "stroke-width": 1.8}, svg);
      const hit = el("circle", {cx: X(n), cy: Y(v), r: 14, fill: "transparent", tabindex: 0}, svg);
      hover(hit, () => `${tipHead("DF")}${n} step${n > 1 ? "s" : ""}: ${v.toFixed(2)} mixed-mode tokens`);
    });
    txt(svg, X(10) + 9, Y(0.57) - 10, "5.28× fewer", {"font-size": 12.5, "font-weight": 800, fill: C.ink});
  });
})();

// =====================================================================
// Finding 3: tokenizers and bin-embedding similarity
// =====================================================================
(function tok() {
  const svg = $("#tok-svg"); if (!svg) return;
  // [representation, pooled success %, head, note], from the arXiv paper: tab:autoregression (uniform-bin DF and AR),
  // Section 5 (metric path) and tab:tokenizer-control (nFSQ, FAST, RVQ)
  const rows = [["Uniform bins", 53.9, "DF", "CFG 2; 52.3% without guidance"], ["Metric path", 52.8, "DF"], ["nFSQ", 52.4, "DF", "CFG 2, 5 steps"],
    ["Uniform bins", 48.3, "AR", "CFG 2; 42.8% without guidance"], ["FAST", 48.2, "AR", "CFG 2"],
    ["FAST", 46.2, "DF", "CFG 2, 20 steps"], ["RVQ", 38.2, "DF", "CFG 2, 50 steps"]];
  const AR = "#8C4511", HEAD = {DF: "Discrete flow", AR: "Autoregressive"};
  chart(svg, () => {
    const rh = 34, top = 4, H = top + rows.length * rh + 24, W = size(svg, H);
    const L = 128, R = W - 52, X = v => L + v / 60 * (R - L), bottom = top + rows.length * rh;
    [0, 20, 40, 60].forEach(v => {
      el("line", {x1: X(v), x2: X(v), y1: top, y2: bottom, stroke: GRID}, svg);
      txt(svg, X(v), bottom + 17, v + "%", {"text-anchor": "middle", "font-size": 12.5, fill: C["ink-3"]});
    });
    rows.forEach(([label, v, head, note], i) => {
      const y = top + i * rh + 6, t = 22, best = i === 0;
      const lab = txt(svg, L - 10, y + 16, "", {"text-anchor": "end", "font-size": 13.5, fill: C.ink});
      el("tspan", {"font-weight": best ? 800 : 500}, lab).textContent = label;
      el("tspan", {dx: 5, "font-size": 11.5, "font-weight": 800, fill: head === "AR" ? AR : C["DF-edge"]}, lab).textContent = head;
      el("path", {d: barPath(L, y, t, X(v) - L, true), fill: head === "AR" ? AR : fillOf(svg, "DF"),
        stroke: head === "AR" ? "none" : C["DF-edge"], "stroke-width": best ? 2 : 1}, svg);
      txt(svg, X(v) + 7, y + 16, v + "%", {"font-size": 14, "font-weight": best ? 800 : 700, fill: C.ink});
      const hit = el("rect", {x: 0, y: y - 6, width: W, height: rh, fill: "transparent", tabindex: 0}, svg);
      hover(hit, () => `<b>${HEAD[head]}, ${label.toLowerCase().replace("nfsq", "nFSQ").replace("fast", "FAST").replace("rvq", "RVQ")}</b>${v}% pooled success${note ? `<br>${note}` : ""}`);
    });
    el("line", {x1: L, x2: L, y1: top, y2: bottom, class: "base"}, svg);
  });
})();
(function cos() {
  const svg = $("#cos-svg"); if (!svg) return;
  // median occupied-centered cosine between output embeddings at bin separation 1..72
  const D = {"DR":[0.3588,0.3033,0.3224,0.2641,0.244,0.2347,0.2058,0.1871,0.1731,0.1568,0.1396,0.1258,0.1136,0.1005,0.0924,0.0859,0.0722,0.065,0.0602,0.0534,0.0444,0.0408,0.0369,0.0297,0.023,0.0188,0.015,0.0112,0.0072,0.0029,-0.0002,-0.0012,-0.0066,-0.0098,-0.0113,-0.0197,-0.0205,-0.0204,-0.0209,-0.0227,-0.022,-0.0254,-0.0281,-0.0278,-0.0325,-0.0349,-0.0384,-0.0352,-0.0373,-0.04,-0.0399,-0.0402,-0.0468,-0.0459,-0.0445,-0.0465,-0.045,-0.0475,-0.0516,-0.0507,-0.0494,-0.0526,-0.0526,-0.0518,-0.0536,-0.0573,-0.0555,-0.0547,-0.0562,-0.0553,-0.0561,-0.057],"DF":[0.4033,0.2823,0.2535,0.2071,0.1824,0.173,0.1518,0.1353,0.1217,0.1103,0.0987,0.0932,0.0864,0.0777,0.0715,0.0651,0.0607,0.054,0.0503,0.0451,0.0386,0.0357,0.0352,0.0283,0.0251,0.0222,0.0176,0.0135,0.0129,0.0076,0.008,0.0041,0.0011,-0.0043,-0.0007,-0.0031,-0.0101,-0.0076,-0.0128,-0.0131,-0.0145,-0.0171,-0.0186,-0.0231,-0.0213,-0.0238,-0.0223,-0.0241,-0.0257,-0.0286,-0.0294,-0.0313,-0.0328,-0.0348,-0.0355,-0.0367,-0.0357,-0.0389,-0.0395,-0.042,-0.0425,-0.0442,-0.0416,-0.0443,-0.0427,-0.0461,-0.0461,-0.0442,-0.044,-0.044,-0.0443,-0.0487]};
  chart(svg, () => {
    const H = 214, W = size(svg, H), L = 44, R = W - 14, T = 12, B = H - 40;
    const X = k => L + Math.log(k) / Math.log(72) * (R - L), Y = v => B - (v + 0.07) / 0.49 * (B - T);
    [0, 0.1, 0.2, 0.3, 0.4].forEach(v => {
      el("line", {x1: L, x2: R, y1: Y(v), y2: Y(v), stroke: v === 0 ? C["ink-3"] : GRID, "stroke-width": v === 0 ? 1.2 : 1}, svg);
      txt(svg, L - 8, Y(v) + 4, v.toFixed(1), {"text-anchor": "end", "font-size": 12.5, fill: C["ink-3"]});
    });
    [1, 2, 4, 8, 16, 32, 64].forEach(k => txt(svg, X(k), B + 18, k, {"text-anchor": "middle", "font-size": 12.5, fill: C["ink-3"]}));
    txt(svg, (L + R) / 2, H - 4, "bins apart", {"text-anchor": "middle", "font-size": 12.5, fill: C["ink-2"], "font-weight": 700});
    const path = h => "M" + D[h].map((v, i) => `${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join("L");
    el("path", {d: path("DF"), fill: "none", stroke: C["DF-edge"], "stroke-width": 2.2, "stroke-dasharray": "6 3"}, svg);
    el("path", {d: path("DR"), fill: "none", stroke: C.DR, "stroke-width": 2.2}, svg);
    headLabel(svg, R - 92, T + 10, "DR", "start");
    headLabel(svg, R - 44, T + 10, "DF", "start");
    // crosshair tooltip
    const cross = el("line", {y1: T, y2: B, stroke: C["ink-3"], "stroke-width": 1, opacity: 0}, svg);
    const dots = ["DR", "DF"].map(h => el("circle", {r: 4.5, fill: h === "DR" ? C.DR : C.DF, stroke: h === "DR" ? "#fff" : C["DF-edge"], "stroke-width": 1.5, opacity: 0}, svg));
    const hit = el("rect", {x: L, y: T, width: R - L, height: B - T, fill: "transparent"}, svg);
    hit.addEventListener("mousemove", ev => {
      const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width);
      const k = Math.max(1, Math.min(72, Math.round(Math.exp((x - L) / (R - L) * Math.log(72)))));
      cross.setAttribute("x1", X(k)); cross.setAttribute("x2", X(k)); cross.setAttribute("opacity", .6);
      ["DR", "DF"].forEach((h, i) => { dots[i].setAttribute("cx", X(k)); dots[i].setAttribute("cy", Y(D[h][k - 1])); dots[i].setAttribute("opacity", 1); });
      showTip(`<b>${k} bin${k > 1 ? "s" : ""} apart</b>DR ${D.DR[k - 1].toFixed(2)}, DF ${D.DF[k - 1].toFixed(2)}`, ev, hit);
    });
    hit.addEventListener("mouseleave", () => { hideTip(); cross.setAttribute("opacity", 0); dots.forEach(d => d.setAttribute("opacity", 0)); });
  });
})();

// =====================================================================
// Lightbox, copy
// =====================================================================
const lb = $("#lightbox");
$$(".teaser img").forEach(img => {
  img.tabIndex = 0;
  const open = () => { const i = $("img", lb); i.src = img.currentSrc || img.src; i.alt = img.alt; lb.showModal(); };
  img.addEventListener("click", open);
  img.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
});
lb.addEventListener("click", () => lb.close());

$$("[data-copy]").forEach(b => b.addEventListener("click", async () => {
  const t = $(b.dataset.copy).innerText;
  try { await navigator.clipboard.writeText(t); b.textContent = "Copied"; } catch { b.textContent = "Select and copy"; }
  setTimeout(() => { b.textContent = "Copy"; }, 1600);
}));
})();
