import React, { useState, useMemo, useEffect, useRef } from "react";

/* ============================================================
   ELIOGRAFO STUDIO — progettazione di array di specchi
   Motore ottico identico al tool Python (verifica incrociata).
   Convenzioni: x = destra, y = avanti (proiezione), z = su.
   ============================================================ */

/* ---------- vettori ---------- */
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => Math.hypot(a[0], a[1], a[2]),
  unit: (a) => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; },
};
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/* ---------- font 5x7 (identico a textraster.py) ---------- */
const FONT = {
 A:["01110","10001","10001","11111","10001","10001","10001"],B:["11110","10001","10001","11110","10001","10001","11110"],
 C:["01110","10001","10000","10000","10000","10001","01110"],D:["11100","10010","10001","10001","10001","10010","11100"],
 E:["11111","10000","10000","11110","10000","10000","11111"],F:["11111","10000","10000","11110","10000","10000","10000"],
 G:["01110","10001","10000","10111","10001","10001","01111"],H:["10001","10001","10001","11111","10001","10001","10001"],
 I:["01110","00100","00100","00100","00100","00100","01110"],J:["00111","00010","00010","00010","00010","10010","01100"],
 K:["10001","10010","10100","11000","10100","10010","10001"],L:["10000","10000","10000","10000","10000","10000","11111"],
 M:["10001","11011","10101","10101","10001","10001","10001"],N:["10001","11001","10101","10011","10001","10001","10001"],
 O:["01110","10001","10001","10001","10001","10001","01110"],P:["11110","10001","10001","11110","10000","10000","10000"],
 Q:["01110","10001","10001","10001","10101","10010","01101"],R:["11110","10001","10001","11110","10100","10010","10001"],
 S:["01111","10000","10000","01110","00001","00001","11110"],T:["11111","00100","00100","00100","00100","00100","00100"],
 U:["10001","10001","10001","10001","10001","10001","01110"],V:["10001","10001","10001","10001","10001","01010","00100"],
 W:["10001","10001","10001","10101","10101","11011","10001"],X:["10001","10001","01010","00100","01010","10001","10001"],
 Y:["10001","10001","01010","00100","00100","00100","00100"],Z:["11111","00001","00010","00100","01000","10000","11111"],
 "0":["01110","10001","10011","10101","11001","10001","01110"],"1":["00100","01100","00100","00100","00100","00100","01110"],
 "2":["01110","10001","00001","00110","01000","10000","11111"],"3":["11111","00010","00100","00010","00001","10001","01110"],
 "4":["00010","00110","01010","10010","11111","00010","00010"],"5":["11111","10000","11110","00001","00001","10001","01110"],
 "6":["00110","01000","10000","11110","10001","10001","01110"],"7":["11111","00001","00010","00100","01000","01000","01000"],
 "8":["01110","10001","10001","01110","10001","10001","01110"],"9":["01110","10001","10001","01111","00001","00010","01100"],
 "?":["01110","10001","00001","00010","00100","00000","00100"],"!":["00100","00100","00100","00100","00100","00000","00100"],
 ".":["00000","00000","00000","00000","00000","00100","00100"],",":["00000","00000","00000","00000","00110","00100","01000"],
 "-":["00000","00000","00000","11111","00000","00000","00000"],"'":["00100","00100","01000","00000","00000","00000","00000"],
 ":":["00000","00100","00100","00000","00100","00100","00000"],"+":["00000","00100","00100","11111","00100","00100","00000"],
 "♥":["00000","01010","11111","11111","01110","00100","00000"]," ":["00000","00000","00000","00000","00000","00000","00000"],
};

function rasterize(text, pitch) {
  const lines = text.toUpperCase().split("\n");
  const pts = [], unknown = new Set(), lineH = 9, totalH = lines.length * lineH - 2;
  lines.forEach((line, li) => {
    const width = line.length ? line.length * 6 - 1 : 0;
    const yTop = totalH / 2 - li * lineH;
    [...line].forEach((ch, ci) => {
      const g = FONT[ch];
      if (!g) { unknown.add(ch); return; }
      const x0 = -width / 2 + ci * 6;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++)
        if (g[r][c] === "1") pts.push([(x0 + c) * pitch, (yTop - r) * pitch]);
    });
  });
  return { pts, unknown: [...unknown] };
}

/* ---------- griglie e matching (identici a matching.py) ---------- */
function hexGrid(radius, spacing) {
  const pts = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius), r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++)
      pts.push([spacing * (q + r / 2), spacing * (Math.sqrt(3) / 2) * r]);
  }
  return pts;
}
function squareGrid(cols, rows, spacing) {
  const pts = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
    pts.push([(i - (cols - 1) / 2) * spacing, (j - (rows - 1) / 2) * spacing]);
  return pts;
}
function ringsOf(points) {
  const c = points.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]).map(v => v / points.length);
  const d = points.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]));
  const order = points.map((_, i) => i).sort((a, b) => d[a] - d[b]);
  const rings = []; let cur = [order[0]], last = d[order[0]];
  for (const i of order.slice(1)) {
    if (d[i] - last > 1e-6 * (1 + d[i])) { rings.push(cur); cur = [i]; } else cur.push(i);
    last = d[i];
  }
  rings.push(cur);
  return { rings, center: c };
}
function match(mirrors, targets) {
  const nM = mirrors.length, nT = targets.length;
  if (nT === 0) return { error: "No dots: empty text or unknown characters." };
  if (nT > nM) return { error: `Needs ${nT} mirrors but the grid has ${nM}.`, need: nT };
  const reps = Math.ceil(nM / nT);
  const tExt = [], tIdx = [];
  for (let k = 0; k < reps; k++) for (let i = 0; i < nT && tExt.length < nM; i++) { tExt.push(targets[i]); tIdx.push(i); }
  const { rings, center: mc } = ringsOf(mirrors);
  const tc = tExt.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]).map(v => v / tExt.length);
  const tOrder = tExt.map((_, i) => i).sort((a, b) =>
    Math.hypot(tExt[a][0] - tc[0], tExt[a][1] - tc[1]) - Math.hypot(tExt[b][0] - tc[0], tExt[b][1] - tc[1]));
  const assign = new Array(nM); let cursor = 0;
  for (const ring of rings) {
    const chunk = tOrder.slice(cursor, cursor + ring.length); cursor += ring.length;
    const mAng = ring.map(i => Math.atan2(mirrors[i][0] - mc[0], -(mirrors[i][1] - mc[1])));
    const tAng = chunk.map(i => Math.atan2(tExt[i][0] - tc[0], -(tExt[i][1] - tc[1])));
    const rs = ring.map((v, k) => [v, mAng[k]]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const cs = chunk.map((v, k) => [v, tAng[k]]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    rs.forEach((mi, k) => { assign[mi] = tIdx[cs[k]]; });
  }
  return { assign };
}

/* ---------- posizione solare NOAA (identica a solar.py) ---------- */
function airMass(elevDeg) {
  // Kasten & Young (1989): massa d'aria ottica in funzione dell'altezza solare apparente
  const g = Math.max(0.5, elevDeg);
  return 1 / (Math.sin(g * D2R) + 0.50572 * Math.pow(g + 6.07995, -1.6364));
}
function sunDirectLux(elevDeg) {
  // illuminanza diretta normale in cielo sereno: 133 klx attenuati con AM (esponente empirico 0.678)
  if (elevDeg <= 0) return 0;
  return 133000 * Math.pow(0.7, Math.pow(airMass(elevDeg), 0.678));
}
function slopeBlurRad(slopeMrad) {
  // errore di pendenza sigma sullo specchio -> il raggio riflesso devia di 2*sigma;
  // angolo pieno equivalente (contenimento 1-sigma della direzione): 4*sigma
  return 4 * (slopeMrad || 0) / 1000;
}
function solarDivergence(dateLocal) {
  // diametro angolare apparente del disco solare (rad, angolo pieno)
  // R(AU) = 1.00014 - 0.01671 cos g - 0.00014 cos 2g,  g = anomalia media (perielio ~3 gen)
  const d = new Date(dateLocal || Date.now());
  const N = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  const g = 2 * Math.PI * (N - 3) / 365.25;
  const R = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  return 0.009310 / R;   // 0.5246 (afelio) ... 0.5425 (perielio) gradi
}
function solarPosition(dateUTC, lat, lon) {
  const start = Date.UTC(dateUTC.getUTCFullYear(), 0, 0);
  const doy = Math.floor((dateUTC.getTime() - start) / 86400000);
  const hour = dateUTC.getUTCHours() + dateUTC.getUTCMinutes() / 60 + dateUTC.getUTCSeconds() / 3600;
  const g = 2 * Math.PI / 365 * (doy - 1 + (hour - 12) / 24);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hour * 60 + eqt + 4 * lon;
  const ha = (tst / 4 - 180) * D2R, latR = lat * D2R;
  let cz = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha);
  cz = Math.max(-1, Math.min(1, cz));
  const zen = Math.acos(cz), elev = 90 - zen * R2D;
  if (Math.sin(zen) < 1e-9) return { elev, az: 180 };
  let ca = (Math.sin(latR) * cz - Math.sin(decl)) / (Math.cos(latR) * Math.sin(zen));
  ca = Math.max(-1, Math.min(1, ca));
  const theta = Math.acos(ca) * R2D;
  const az = ((Math.sin(ha) <= 0 ? 180 - theta : 180 + theta) % 360 + 360) % 360;
  return { elev, az };
}

/* ---------- ottica (identica a optics.py) ---------- */
const sunDirection = (e, a) => [Math.cos(e * D2R) * Math.sin(a * D2R), -Math.cos(e * D2R) * Math.cos(a * D2R), Math.sin(e * D2R)];
const BUILD = "2026-08-15 11:06 UTC";
function nowLocalISO() {
  const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function targetHeight(tiltDeg, planeH, ceilH) {
  // 0° pavimento (z=0) · 90° parete (z=planeH) · >90° superficie sopra la testa (z=ceilH)
  return tiltDeg <= 90 ? planeH * Math.sin(tiltDeg * D2R) : (ceilH ?? 2.7);
}
function planeFrame(dist, tilt, center, centerH, ceilH) {
  const t = tilt * D2R;
  const nV = [0, -Math.sin(t), Math.cos(t)];
  const ph = centerH === undefined ? center[2] : centerH;
  const P0 = [center[0], center[1] + dist, targetHeight(tilt, ph, ceilH)];
  const up = [0, 0, 1];
  const sRaw = V.sub(up, V.mul(nV, V.dot(up, nV)));
  const s = V.norm(sRaw) > 1e-9 ? V.unit(sRaw) : [0, 1, 0];
  // guardando in SU la manualita' si inverte: sul soffitto il testo va specchiato
  // affinche' resti leggibile a chi sta sotto (l'errore "?EM YRRAM" di Bartlett)
  const r0 = V.unit(V.cross(s, nV));
  const r = tilt > 90 ? V.mul(r0, -1) : r0;
  return { P0, nV, r, s };
}
function intersectPlane(o, dir, P0, n) {
  const d = V.unit(dir), den = V.dot(d, n);
  if (Math.abs(den) < 1e-9) return null;
  const t = V.dot(V.sub(P0, o), n) / den;
  if (t <= 0) return null;
  return { hit: V.add(o, V.mul(d, t)), t };
}
const deviceFrame = (tilt) => {
  const g = tilt * D2R;
  const X = [1, 0, 0], Z = [0, Math.sin(g), Math.cos(g)];
  return { X, Y: V.cross(Z, X), Z };
};

/* ---------- calcolo completo ---------- */
function compute(st) {
  const warn = [], info = {};
  // sorgente
  let light;
  if (st.lightMode === "lamp") {
    light = { mode: "lamp", lamp: { position_m: [st.lampX, st.lampY, st.lampZ], diameter_m: st.lampD / 100 } };
  } else if (st.lightMode === "sunAuto") {
    const utcMs = new Date(st.dateLocal + ":00").getTime() - st.tzOffset * 3600000;
    const { elev, az } = solarPosition(new Date(utcMs), st.lat, st.lon);
    info.sunElev = elev; info.sunAzNorth = az;
    if (elev <= 0) warn.push({ lvl: "err", msg: `The sun is below the horizon (${elev.toFixed(1)}°) at that date and time.` });
    const rel = ((az - st.projAz) % 360 + 360) % 360 - 180;
    info.sunAzRel = rel;
    light = { mode: "sun", sun: { elevation_deg: elev, azimuth_rel_deg: rel } };
  } else {
    light = { mode: "sun", sun: { elevation_deg: st.sunElev, azimuth_rel_deg: st.sunAzRel } };
  }
  const SDIV = light.mode === "sun" ? solarDivergence(st.dateLocal) : 0.0093;
  const SBLUR = slopeBlurRad(st.slopeMrad);
  const SDIVE = Math.sqrt(SDIV * SDIV + SBLUR * SBLUR);
  // testo → bersagli
  const { pts: t2d, unknown } = rasterize(st.text, st.pitch / 100);
  if (unknown.length) warn.push({ lvl: "warn", msg: `Characters not in the font, skipped: ${unknown.join(" ")}` });
  // griglia
  const spacing = st.mirrorW + st.gap;
  const offsets = st.shape === "hex" ? hexGrid(st.hexR, spacing) : squareGrid(st.cols, st.rows, spacing);
  const m = match(offsets, t2d);
  if (m.error) { warn.push({ lvl: "err", msg: m.error + (m.need ? ` Enlarge the grid or shorten the text.` : "") }); }
  info.nMirrors = offsets.length; info.nPoints = t2d.length;
  if (t2d.length && offsets.length > t2d.length)
    info.dup = `${offsets.length} mirrors on ${t2d.length} dots: ~${(offsets.length / t2d.length).toFixed(1)}× brightness per dot`;

  const center = [st.devX || 0, 0, st.devZ];
  const pf = planeFrame(st.dist, st.planeTilt, center, st.planeH, st.ceilH);
  const t3d = t2d.map(([a, b]) => V.add(pf.P0, V.add(V.mul(pf.r, st.flipH ? -a : a), V.mul(pf.s, st.flipV ? -b : b))));

  const toLight = (mp) => light.mode === "sun"
    ? sunDirection(light.sun.elevation_deg, light.sun.azimuth_rel_deg)
    : V.unit(V.sub(light.lamp.position_m, mp));

  const buildRows = (devTilt) => {
    const { X, Y, Z } = deviceFrame(devTilt);
    return offsets.map(([a, b], i) => {
      const mp = V.add(center, V.add(V.mul(X, a / 1000), V.mul(Y, b / 1000)));
      const tp = m.assign ? t3d[m.assign[i]] : pf.P0;
      const v = toLight(mp);
      const nW = V.unit(V.add(v, V.unit(V.sub(tp, mp))));
      const nL = [V.dot(nW, X), V.dot(nW, Y), V.dot(nW, Z)];
      const ray = V.sub(V.mul(v, -1), V.mul(nW, 2 * V.dot(V.mul(v, -1), nW)));
      const ix = intersectPlane(mp, ray, pf.P0, pf.nV);
      const path = ix ? ix.t : st.dist;
      let spotR;
      if (light.mode === "sun") spotR = 0.5 * (st.mirrorW / 1000 + SDIVE * path);
      else {
        const L = V.norm(V.sub(light.lamp.position_m, mp));
        spotR = 0.5 * ((st.mirrorW / 1000) * (L + path) / L + light.lamp.diameter_m * path / L);
      }
      const cosA = ix ? Math.abs(V.dot(V.unit(ray), pf.nV)) : 1;
      return { mp, tp, nW, nL, a, b, ray, path, spotR, i,
        vDotZ: V.dot(v, Z), tDotZ: V.dot(V.unit(V.sub(tp, mp)), Z),
        tilt: Math.acos(Math.min(1, Math.abs(nL[2]))) * R2D,
        inc: Math.acos(Math.max(-1, Math.min(1, V.dot(v, nW)))) * R2D,
        elong: 1 / Math.max(0.15, cosA), valid: !!ix };
    });
  };

  let devTilt = st.devTiltAuto ? 0 : st.devTilt;
  let rows = buildRows(devTilt);
  if (st.devTiltAuto && rows.length) {
    const mean = rows.reduce((s, r) => V.add(s, r.nW), [0, 0, 0]);
    devTilt = Math.atan2(mean[1], mean[2]) * R2D;
    rows = buildRows(devTilt);
  }
  info.devTilt = devTilt;
  info.maxTilt = Math.max(...rows.map(r => r.tilt), 0);
  info.maxInc = Math.max(...rows.map(r => r.inc), 0);
  /* vincolo fisico: gli specchi riflettono solo dal davanti (mai "attraverso" l'array) */
  const minVDot = rows.length ? Math.min(...rows.map(r => r.vDotZ)) : 1;
  info.backlit = minVDot <= 0.05;
  info.behind = minVDot < -0.05;
  info.maxExp = rows.length ? Math.acos(Math.max(-1, Math.min(1, minVDot))) * R2D : 0;
  if (info.behind) warn.push({ lvl: "err", msg: "Light hits the array from BEHIND: a mirror is not a window — it must face the source. Enable automatic tilt or adjust Array tilt." });
  else if (info.backlit) warn.push({ lvl: "err", msg: "Light nearly parallel to the panel: the mirrors collect almost nothing. Rotate the array toward the source (Array tilt or automatic tilt)." });
  else if (info.maxExp > 60) warn.push({ lvl: "warn", msg: `Light at ${info.maxExp.toFixed(0)}° off the array front: weak exposure. Reduce the angle (auto tilt or reposition the source).` });
  info.spotD = rows.length ? 2 * rows.reduce((s, r) => s + r.spotR, 0) / rows.length : 0;

  /* --- messa a fuoco: limite fisico e parametri consigliati --- */
  const meanPath = rows.length ? rows.reduce((s, r) => s + r.path, 0) / rows.length : st.dist;
  if (light.mode === "sun") {
    info.minSpot = SDIVE * meanPath; info.sdiv = SDIV; info.sdivEff = SDIVE;                       // limite divergenza solare (specchio→0)
    info.wRec = Math.min(60, Math.max(8, 1000 * SDIVE * meanPath));   // contributo pari specchio/divergenza
  } else {
    const L0 = V.norm(V.sub(light.lamp.position_m, center));
    info.minSpot = light.lamp.diameter_m * meanPath / L0;   // limite penombra (specchio→0)
    info.wRec = Math.min(60, Math.max(8, 1000 * light.lamp.diameter_m * meanPath / (L0 + meanPath)));
  }
  const spotRec = light.mode === "sun"
    ? info.wRec / 1000 + SDIVE * meanPath
    : (() => { const L0 = V.norm(V.sub(light.lamp.position_m, center));
        return (info.wRec / 1000) * (L0 + meanPath) / L0 + light.lamp.diameter_m * meanPath / L0; })();
  info.spotRecBase = spotRec;

  /* --- fotometria: lux sullo spot e contrasto con l'ambiente --- */
  const R_MIRROR = st.reflect ?? 0.9;
  const areaM = st.shape === "hex" ? (Math.sqrt(3) / 2) * (st.mirrorW / 1000) ** 2 : (st.mirrorW / 1000) ** 2;
  const meanInc = rows.length ? rows.reduce((s, r) => s + r.inc, 0) / rows.length : 0;
  const meanElong = rows.length ? rows.reduce((s, r) => s + r.elong, 0) / rows.length : 1;
  info.meanElong = meanElong;
  info.spotEff = info.spotD * meanElong;
  info.pitchRec = Math.min(30, Math.max(1, Math.ceil(1.5 * (info.spotRecBase || info.spotD) * meanElong * 100 * 2) / 2));
  const spotArea = Math.max(1e-9, Math.PI * (info.spotD / 2) ** 2 * meanElong);
  let E_in = null;
  if (light.mode === "sun") {
    const e = light.sun.elevation_deg;
    if (e > 0) E_in = 100000 * Math.pow(Math.sin(e * D2R), 0.7);  // stima cielo sereno
  } else {
    const L0 = V.norm(V.sub(light.lamp.position_m, center));
    const Icd = st.lampLm / (2 * Math.PI * (1 - Math.cos(st.lampBeam / 2 * D2R)));
    E_in = Icd / (L0 * L0);
  }
  if (E_in != null && info.nPoints > 0 && info.spotD > 0) {
    const dupF = Math.max(1, info.nMirrors / info.nPoints);
    info.spotLux = E_in * Math.cos(meanInc * D2R) * R_MIRROR * areaM / spotArea * dupF;
    info.contrast = info.spotLux / Math.max(0.1, st.ambient);
    if (info.contrast < 2 && light.mode === "lamp")
      warn.push({ lvl: info.contrast < 1 ? "err" : "warn",
        msg: `Contrast ${info.contrast.toFixed(1)}×: spot ${info.spotLux.toFixed(0)} lx over ambient ${st.ambient} lx. You need more lumens, a tighter beam, a darker environment or larger mirrors.` });
    if (info.contrast < 2 && light.mode === "sun")
      warn.push({ lvl: "warn",
        msg: `Contrast ${info.contrast.toFixed(1)}×: with this ambient light the text will look faint. Project onto a shaded surface.` });
  }
  if (rows.some(r => !r.valid)) warn.push({ lvl: "err", msg: "Some rays never reach the surface (surface behind the array, or rays parallel to it). Check the geometry." });
  const worstAng = Math.max(info.maxInc || 0, info.maxExp || 0);
  info.lightLossPct = Math.round(100 * (1 - Math.cos(Math.min(89, worstAng) * D2R)));
  if (!info.backlit && worstAng > 45 && info.maxInc <= 60)
    warn.push({ lvl: "warn", msg: `Wide angles (up to ${worstAng.toFixed(0)}° between light and mirrors): ~${info.lightLossPct}% of the light is lost. Reduce the angles for brighter spots.` });
  if (st.dist >= 10)
    warn.push({ lvl: "warn", msg: `Distance ${st.dist} m: the spots widen (Ø ${(info.spotD * 100).toFixed(1)} cm) and brightness falls with the square of the distance. Bring the text closer if you can.` });

  /* --- estensioni per la scena e l'osservatore --- */
  if (light.mode === "sun") { info.elevUsed = light.sun.elevation_deg; info.azRelUsed = light.sun.azimuth_rel_deg; }
  if (t2d.length) {
    const txs = t2d.map(p => p[0]), tys = t2d.map(p => p[1]);
    info.textW = Math.max(...txs) - Math.min(...txs) + info.spotD;
    info.textH = Math.max(...tys) - Math.min(...tys) + info.spotD;
  }
  info.nMirrors = offsets.length;
  info.arraySize = offsets.length
    ? (2 * Math.max(...offsets.map(o => Math.hypot(o[0], o[1]))) + st.mirrorW) / 1000 : 0.25;
  const eye = [0, -st.obsBack, st.obsH];
  const sight = V.unit(V.sub(pf.P0, eye));
  info.viewAngle = Math.asin(Math.max(0, Math.min(1, Math.abs(V.dot(sight, pf.nV))))) * R2D;
  /* the panel is a real surface: it can hide the text from the viewer */
  const Zdev = deviceFrame(devTilt).Z;
  const aC = [st.devX || 0, 0, st.devZ], aR = info.arraySize / 2 + 0.02;
  const segHitsArray = (A, B) => {
    const d = V.sub(B, A), den = V.dot(d, Zdev);
    if (Math.abs(den) < 1e-9) return false;
    const tt = V.dot(V.sub(aC, A), Zdev) / den;
    if (tt <= 1e-4 || tt >= 1 - 1e-4) return false;
    return V.norm(V.sub(V.add(A, V.mul(d, tt)), aC)) <= aR;
  };
  const occN = t3d.reduce((n, tp) => n + (segHitsArray(eye, tp) ? 1 : 0), 0);
  info.occFrac = t3d.length ? occN / t3d.length : 0;
  if (occN > 0)
    warn.push({ lvl: "err", msg: `The array is a real surface and blocks the view: ${Math.round(100 * info.occFrac)}% of the text is hidden from the viewer. Lower the array, raise it above head height, step aside or move the text farther.` });
  /* ...e il corpo dell'osservatore puo' fare ombra sulla luce che arriva da dietro */
  const srcPoint = light.mode === "lamp" ? light.lamp.position_m
    : V.add(aC, V.mul(toLight(aC), 50));
  const bodyBlocks = (() => {
    const A = srcPoint, B = aC, d = V.sub(B, A);
    if (Math.abs(d[1]) < 1e-9) return false;
    const tt = (-st.obsBack - A[1]) / d[1];
    if (tt <= 0 || tt >= 1) return false;
    const h = V.add(A, V.mul(d, tt));
    return Math.abs(h[0]) < 0.25 && h[2] > 0 && h[2] < st.obsH + 0.1;
  })();
  if (bodyBlocks)
    warn.push({ lvl: "warn", msg: "You stand between the source and the array: you would cast a shadow on it. Raise the array or step aside." });
  info.al = {
    occ: info.occFrac > 0,
    backlit: !!info.backlit,
    behind: !!info.behind,
    graze: !info.backlit && info.maxInc > 60,
    wide: !info.backlit && info.maxInc <= 60 && Math.max(info.maxInc || 0, info.maxExp || 0) > 45,
    far: st.dist >= 10,
    overlap: info.nPoints > 0 && (info.spotEff ?? info.spotD) > 1.35 * st.pitch / 100,
    body: bodyBlocks,
  };
  if (info.viewAngle < 15 && info.nPoints > 0)
    warn.push({ lvl: "warn", msg: `From the viewing spot you see the text at only ${info.viewAngle.toFixed(0)}° (heavily foreshortened): move closer to the text or raise the viewpoint.` });
  if (info.maxInc > 60) warn.push({ lvl: "err", msg: `Grazing incidence (${info.maxInc.toFixed(0)}° off normal): the mirrors capture very little light. With a low sun, aim the projection TOWARD the sun.` });
  if (info.maxTilt > 32) warn.push({ lvl: "warn", msg: `Pillars up to ${info.maxTilt.toFixed(0)}\u00b0: hard to print. Use the automatic array tilt, or move the target closer.` });
  if ((info.spotEff ?? info.spotD) > 1.35 * st.pitch / 100 && t2d.length)
    warn.push({ lvl: "warn", msg: `Spot ${(info.spotEff * 100).toFixed(1)} cm on the surface (beam Ø ${(info.spotD * 100).toFixed(1)}${info.meanElong > 1.3 ? `, stretched ×${info.meanElong.toFixed(1)} by the grazing angle` : ""}) > pitch ${st.pitch} cm: the letters smear together. ${info.meanElong > 1.3 ? "Raise the array or bring the text closer for a steeper impact, or increase the pitch." : "Increase the pitch or reduce the distance."}` });
  if (light.mode === "lamp" && st.lampY >= st.dist)
    warn.push({ lvl: "warn", msg: "The lamp is beyond the projection surface: unusual geometry, double-check the preview." });

  // tolleranza: piano spostato a dist·(1+δ)
  let tolHits = null;
  if (st.tol !== 0 && m.assign) {
    const pf2 = planeFrame(st.dist * (1 + st.tol / 100), st.planeTilt, center, st.planeH, st.ceilH);
    tolHits = rows.map(r => {
      const ix = intersectPlane(r.mp, r.ray, pf2.P0, pf2.nV);
      if (!ix) return null;
      const d = V.sub(ix.hit, pf2.P0);
      return [V.dot(d, pf2.r), V.dot(d, pf2.s)];
    });
  }
  return { rows, warn, info, t2d, pf, offsets, assign: m.assign, light, tolHits };
}

/* ---------- UI ---------- */
const PASTEL = { coral: "#F2A39C", peach: "#F5B2A1", sand: "#EDC7A0", cream: "#EBDEAA",
  lime: "#C6DA69", mint: "#B2DBB3", sage: "#ADDAC5", aqua: "#AAD9D3", sky: "#A7D9E2", rose: "#EF9394" };
const C = { bg: "#FBFBFD", panel: "#FFFFFF", line: "#E5E5EA", ink: "#1D1D1F", dim: "#86868B",
  gold: "#1D1D1F", goldFill: "#1D1D1F", steel: "#6E6E73", err: "#FF3B30", ok: "#248A3D" };
const S = {
  label: { fontSize: 12, color: C.dim, display: "block", marginBottom: 4, fontWeight: 500 },
  input: { width: "100%", background: "#FFFFFF", border: `1px solid ${C.line}`, color: C.ink, borderRadius: 6, padding: "7px 9px", fontSize: 13, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", boxSizing: "border-box" },
  row: { display: "flex", gap: 10, marginBottom: 10 },
  group: { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 14 },
  gtitle: { fontSize: 17, color: C.ink, margin: "0 0 12px", fontWeight: 600, letterSpacing: "-0.01em" },
};

function Num({ label, value, set, min, max, step = 1, unit }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={S.label}>{label}{unit ? <span style={{ color: C.steel }}> [{unit}]</span> : null}</label>
      <input type="number" style={S.input} value={value} min={min} max={max} step={step}
        onChange={e => set(parseFloat(e.target.value) || 0)} />
    </div>
  );
}
function Slider({ label, value, set, min, max, step = 1, unit, fmt }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={S.label}>{label} — <span style={{ color: C.gold, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace" }}>{fmt ? fmt(value) : value}{unit || ""}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} style={{ width: "100%", accentColor: C.gold }}
        onChange={e => set(parseFloat(e.target.value))} />
    </div>
  );
}
function Seg({ options, value, set }) {
  return (
    <div style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 7, overflow: "hidden", marginBottom: 10 }}>
      {options.map(([v, lbl]) => (
        <button key={v} onClick={() => set(v)} style={{
          flex: 1, padding: "7px 4px", fontSize: 12, cursor: "pointer", border: "none",
          background: value === v ? C.goldFill : "transparent", color: value === v ? "#FFFFFF" : C.dim, fontWeight: value === v ? 700 : 400 }}>
          {lbl}</button>
      ))}
    </div>
  );
}

const fmtLocal = (utcMs, tz) => { const loc = new Date(utcMs + tz * 3600000); const p2 = n => String(n).padStart(2, "0");
  return `${loc.getUTCFullYear()}-${p2(loc.getUTCMonth() + 1)}-${p2(loc.getUTCDate())}T${p2(loc.getUTCHours())}:${p2(loc.getUTCMinutes())}`; };
const compassName = (az) => ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(((az % 360) + 360) % 360 / 22.5) % 16];

/* ---------- ottimizzatore generico con vincoli ---------- */
const OPT_BOUNDS = { dist: [0.5, 30], devZ: [0.2, 3], planeH: [0.2, 4], lampY: [-30, -0.2], lampZ: [0.2, 12] };
function sceneEval2(st, ov, sun, I) {
  const center = [ov.devX ?? (st.devX || 0), 0, ov.devZ];
  const t = st.planeTilt * D2R;
  const P0 = [0, ov.dist, targetHeight(st.planeTilt, ov.planeH, ov.ceilH ?? st.ceilH)];
  const nV = [0, -Math.sin(t), Math.cos(t)];
  const upv = [0, 0, 1];
  const sRaw = V.sub(upv, V.mul(nV, V.dot(upv, nV)));
  const sv = V.norm(sRaw) > 1e-9 ? V.unit(sRaw) : [0, 1, 0];
  const rv0 = V.unit(V.cross(sv, nV));
  const rv = st.planeTilt > 90 ? V.mul(rv0, -1) : rv0;
  const w2 = ((I && I.textW) || 0.5) / 2, h2 = ((I && I.textH) || 0.35) / 2;
  const pts = [P0, V.add(P0, V.mul(rv, w2)), V.sub(P0, V.mul(rv, w2)),
               V.add(P0, V.mul(sv, h2)), V.sub(P0, V.mul(sv, h2))];
  const w = st.mirrorW / 1000;
  let v, E, L0 = 1;
  if (sun) {
    v = sunDirection(sun.elev, sun.azRel);
    E = sunDirectLux(sun.elev);
  } else {
    const lp = [st.lampX, ov.lampY, ov.lampZ];
    L0 = V.norm(V.sub(lp, center));
    v = V.unit(V.sub(lp, center));
    E = st.lampLm / (2 * Math.PI * (1 - Math.cos(st.lampBeam / 2 * D2R))) / (L0 * L0);
  }
  let sSpot = 0, sInc = 0, sElong = 0, sBeam = 0;
  for (const tp of pts) {
    const rDir = V.unit(V.sub(tp, center));
    const path = V.norm(V.sub(tp, center));
    const blur = slopeBlurRad(st.slopeMrad) * path;
    const beam0 = sun ? w + (I.sdiv || 0.0093) * path
                      : w * (L0 + path) / L0 + (st.lampD / 100) * path / L0;
    const beam = Math.sqrt(beam0 * beam0 + blur * blur);
    const elong = 1 / Math.max(0.15, Math.abs(V.dot(rDir, nV)));
    const n = V.unit(V.add(v, rDir));
    sInc += Math.acos(Math.max(-1, Math.min(1, V.dot(v, n)))) * R2D;
    sBeam += beam; sElong += elong; sSpot += beam * elong;
  }
  const N = pts.length;
  const spot = sSpot / N, inc = sInc / N, elong = sElong / N, beam = sBeam / N;
  const areaM = st.shape === "hex" ? Math.sqrt(3) / 2 * w * w : w * w;
  const lux = E * Math.cos(inc * D2R) * (st.reflect ?? 0.9) * areaM / (Math.PI * (beam / 2) ** 2 * elong);
  return { spot, spotBeam: beam, elong, inc, lux, contrast: lux / Math.max(0.1, st.ambient) };
}
function viewOccluded(st, I, ov) {
  const t = st.planeTilt * D2R;
  const nV = [0, -Math.sin(t), Math.cos(t)];
  const P0 = [0, ov.dist, targetHeight(st.planeTilt, ov.planeH, ov.ceilH ?? st.ceilH)];
  const up = [0, 0, 1];
  const sRaw = V.sub(up, V.mul(nV, V.dot(up, nV)));
  const sv = V.norm(sRaw) > 1e-9 ? V.unit(sRaw) : [0, 1, 0];
  const rv0 = V.unit(V.cross(sv, nV));
  const rv = st.planeTilt > 90 ? V.mul(rv0, -1) : rv0;
  const g = (I.devTilt ?? 0) * D2R;
  const Zd = [0, Math.sin(g), Math.cos(g)];
  const aC = [ov.devX ?? (st.devX || 0), 0, ov.devZ], aR = (I.arraySize || 0.3) / 2 + 0.02;
  const eye = [0, -(ov.obsBack ?? st.obsBack), (ov.obsH ?? st.obsH)];
  const w2 = (I.textW || 0.4) / 2, h2 = (I.textH || 0.3) / 2;
  const samples = [P0, V.add(P0, V.mul(sv, h2)), V.sub(P0, V.mul(sv, h2)),
                   V.add(P0, V.mul(rv, w2)), V.sub(P0, V.mul(rv, w2))];
  return samples.some(tp => {
    const d = V.sub(tp, eye), den = V.dot(d, Zd);
    if (Math.abs(den) < 1e-9) return false;
    const tt = V.dot(V.sub(aC, eye), Zd) / den;
    if (tt <= 1e-4 || tt >= 1 - 1e-4) return false;
    return V.norm(V.sub(V.add(eye, V.mul(d, tt)), aC)) <= aR;
  });
}
function optimizeScene(st, I, opts = null) {
  const isLamp = st.lightMode === "lamp";
  const cl = (x, [a, b]) => Math.max(a, Math.min(b, x));
  const base = { dist: st.dist, devZ: st.devZ, devX: st.devX || 0, planeH: st.planeH,
                 obsBack: st.obsBack, obsH: st.obsH, lampY: st.lampY, lampZ: st.lampZ, dDay: 0, dMin: 0 };
  const BOUNDS = { ...OPT_BOUNDS, obsBack: [0, 20], obsH: [0.4, 2.2], devX: [-3, 3], ceilH: [1.8, 6] };
  const timeable = st.lightMode === "sunAuto";
  const baseUtc = timeable ? new Date(st.dateLocal + ":00").getTime() - st.tzOffset * 3600000 : 0;
  const sunAt = (dDay, dMin) => {
    if (!timeable) return st.lightMode === "lamp" ? null : { elev: I.elevUsed ?? st.sunElev, azRel: I.azRelUsed ?? st.sunAzRel };
    const { elev, az } = solarPosition(new Date(baseUtc + dDay * 86400000 + dMin * 60000), st.lat, st.lon);
    return { elev, azRel: ((az - st.projAz) % 360 + 360) % 360 - 180 };
  };
  const frees = opts && opts.frees ? opts.frees.slice() : Object.keys(st.optOn).filter(k => st.optOn[k]
    && (isLamp || (k !== "lampY" && k !== "lampZ"))
    && ((st.planeTilt > 5 && st.planeTilt <= 90) || k !== "planeH")
    && (st.planeTilt > 90 || k !== "ceilH")
    && (timeable || (k !== "day" && k !== "hour")));
  const wide = !!(opts && opts.wide);
  const sun0 = sunAt(0, 0);
  if (sun0 && sun0.elev <= 0) return null;
  const cur = sceneEval2(st, base, sun0, I);
  if (!frees.length) return { cur, best: null, frees };
  const cands = [];
  const feasible = (ov, sun, e) => e.inc <= 55 && !viewOccluded(st, I, ov) && (!sun || sun.elev > 0);
  if (feasible(base, sun0, cur)) cands.push({ ov: base, e: cur, sun: sun0 });
  for (let k = 0; k < 700; k++) {
    const ov = { ...base };
    for (const f of frees) {
      if (f === "day") ov.dDay = Math.round((Math.random() * 2 - 1) * (st.optRange.day || 1));
      else if (f === "hour") ov.dMin = Math.round((Math.random() * 2 - 1) * (st.optRange.hour || 1) * 12) * 5;
      else if (wide) { const [lo, hi] = BOUNDS[f]; ov[f] = lo + Math.random() * (hi - lo); }
      else ov[f] = cl(base[f] + (Math.random() * 2 - 1) * Math.max(0.05, st.optRange[f] || 0), BOUNDS[f]);
    }
    if (isLamp) ov.lampY = Math.min(ov.lampY, ov.dist - 0.2);
    const sun = sunAt(ov.dDay, ov.dMin);
    if (sun && sun.elev <= 0) continue;
    const e = sceneEval2(st, ov, sun, I);
    if (feasible(ov, sun, e)) cands.push({ ov, e, sun });
  }
  if (!cands.length) return { cur, best: null, frees, infeasible: true };
  const rnd2 = (x, ss = 0.05) => Math.round(Math.round(x / ss) * ss * 100) / 100;
  const nameOf = { dist: "text distance", devZ: "array height", devX: "array sideways", planeH: "text height",
                   obsBack: "viewer distance", obsH: "eye height", lampY: "spotlight forward", lampZ: "spotlight height" };
  const patchOf = (ov) => {
    const patch = {}, rowsOut = [];
    for (const f of frees) {
      if (f === "day" || f === "hour") continue;
      const vv = rnd2(ov[f]);
      if (Math.abs(vv - base[f]) > 0.04) { patch[f] = vv; rowsOut.push([nameOf[f], base[f] + " m", vv + " m"]); }
    }
    if (timeable && (ov.dDay !== 0 || ov.dMin !== 0)) {
      const nd = fmtLocal(baseUtc + ov.dDay * 86400000 + ov.dMin * 60000, st.tzOffset);
      if (nd !== st.dateLocal) { patch.dateLocal = nd; rowsOut.push(["date & time", st.dateLocal.replace("T", " "), nd.replace("T", " ")]); }
    }
    return { patch, rowsOut };
  };
  /* pre-classifica con la stima rapida, poi VERIFICA i migliori con la simulazione completa */
  const score = (spot, contrast) => (contrast >= 2 ? spot : (contrast < 1 ? spot + 100 : spot + 10 - contrast));
  cands.sort((a, b) => score(a.e.spot, a.e.contrast) - score(b.e.spot, b.e.contrast));
  const seen = new Set(); const short = [];
  for (const c of cands) {
    const pp = patchOf(c.ov); const key = JSON.stringify(pp.patch);
    if (!Object.keys(pp.patch).length || seen.has(key)) continue;
    seen.add(key); short.push({ ...c, ...pp });
    if (short.length >= 5) break;
  }
  const realCur = { spot: I.spotEff ?? cur.spot, contrast: I.contrast ?? cur.contrast };
  let verified = null;
  for (const c of short) {
    let I2; try { I2 = compute({ ...st, ...c.patch }).info; } catch (err) { continue; }
    if (!I2 || !I2.spotEff || I2.backlit) continue;
    const real = { spot: I2.spotEff, contrast: I2.contrast ?? 0 };
    if (!verified || score(real.spot, real.contrast) < score(verified.real.spot, verified.real.contrast))
      verified = { c, real, needLm: (isLamp && real.contrast < 2) ? Math.ceil(st.lampLm * 2 / Math.max(0.01, real.contrast) / 100) * 100 : null };
  }
  const better = verified && (score(verified.real.spot, verified.real.contrast) < score(realCur.spot, realCur.contrast) * 0.98 - 1e-6
                              || (realCur.contrast < 2 && verified.real.contrast > realCur.contrast * 1.15));
  if (!better) return { cur: { ...cur, spot: realCur.spot, contrast: realCur.contrast }, best: null, frees };
  return { cur: { ...cur, spot: realCur.spot, contrast: realCur.contrast },
           best: { patch: verified.c.patch, rowsOut: verified.c.rowsOut,
                   e: { spot: verified.real.spot, contrast: verified.real.contrast, inc: verified.c.e.inc },
                   needLm: verified.needLm } };
}

/* ---------- scena a due viste (dall'alto + laterale) ---------- */
function fitView(pts, W, H, padPx, padW) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - padW, x1 = Math.max(...xs) + padW;
  const y0 = Math.min(...ys) - padW, y1 = Math.max(...ys) + padW;
  const sc = Math.min((W - 2 * padPx) / Math.max(0.4, x1 - x0), (H - 2 * padPx) / Math.max(0.4, y1 - y0));
  return { px: (x, y) => [padPx + (x - x0) * sc, H - padPx - (y - y0) * sc],
           inv: (X, Y) => [x0 + (X - padPx) / sc, y0 + (H - padPx - Y) / sc],
           sc, x0, x1, y0, y1 };
}
function SceneViews({ st, I, patch }) {
  const drag = useRef(null);
  const lastPt = useRef(null);
  const frozen = useRef({ top: null, side: null });  // inquadratura bloccata durante il drag
  const W = 640, H = 230, isLamp = st.lightMode === "lamp";
  const textW = I.textW || 0.4, textH = I.textH || 0.3;
  const elev = I.elevUsed ?? 30, azRel = I.azRelUsed ?? 0;
  const tR = st.planeTilt * D2R, gR = (I.devTilt ?? 0) * D2R;
  const half = (I.arraySize || 0.25) / 2;
  // etichette sempre dentro il riquadro: y clampata, ancoraggio spostato ai bordi
  const lbl = (x, y, s, col = C.dim, anchor = "middle", size = 9) => {
    const txt = String(s), w = txt.length * size * 0.6;
    let a = anchor, xx = x;
    const half = a === "middle" ? w / 2 : 0;
    if (a === "middle" && x - w / 2 < 3) { a = "start"; xx = 3; }
    else if (a === "middle" && x + w / 2 > W - 3) { a = "end"; xx = W - 3; }
    else if (a === "start" && x + w > W - 3) { a = "end"; xx = W - 3; }
    else if (a === "end" && x - w < 3) { a = "start"; xx = 3; }
    const yy = Math.max(size + 1, Math.min(H - 3, y));
    return <text x={xx} y={yy} fill={col} fontSize={size} textAnchor={a} fontFamily="monospace">{txt}</text>;
  };
  const dash = (a, b, col = "#9A9484") =>
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={col} strokeDasharray="4 3" />;
  const AL = I.al || {};
  const badge = (i, txt, col) => {
    const w2 = txt.length * 5.7 + 14;
    return (<g key={txt} style={{ pointerEvents: "none" }}>
      <rect x={6} y={6 + i * 20} width={w2} height={17} rx={8.5} fill={col} opacity="0.94" />
      <text x={6 + w2 / 2} y={18 + i * 20} fill="#FFFFFF" fontSize="9.5" textAnchor="middle" fontFamily="monospace" fontWeight="700">{txt}</text>
    </g>);
  };
  const stack = (list) => list.filter(Boolean).map((a, i) => badge(i, a.t, a.c));
  // zona occupata dalla pila di avvisi in alto a sinistra (per non nasconderci etichette sotto)
  const bw = (t) => (t ? t.length * 5.7 + 14 + 6 : 0);
  const warnTop = [(AL.graze || AL.wide) ? (AL.graze ? `\u26A0 grazing light: \u2212${I.lightLossPct}% light` : `\u26A0 wide angles: \u2212${I.lightLossPct}% light`) : null,
                   AL.overlap ? "\u26A0 spot > pitch: letters smear" : null,
                   AL.far ? "\u26A0 long distance: dim spots" : null].filter(Boolean);
  const warnSide = [AL.backlit ? "\u26A0 light from behind the array" : null,
                    AL.occ ? "\u26A0 the array hides part of the text" : null,
                    AL.shadow ? "\u26A0 your shadow covers the array" : null,
                    (AL.graze || AL.wide) ? `\u26A0 grazing light: \u2212${I.lightLossPct}%` : null,
                    AL.overlap ? "\u26A0 spot > pitch" : null].filter(Boolean);
  const bzY = (list) => list.length ? 6 + list.length * 20 + 6 : 0;
  const bzX = (list) => list.length ? Math.max(...list.map(bw)) : 0;
  // sposta l'etichetta sotto la pila di avvisi se ci finirebbe sopra
  const clearOf = (x, y, list) => (x < bzX(list) && y < bzY(list)) ? bzY(list) + 11 : y;

  /* vista dall'alto, frame stanza: scritta ferma, array mobile. u = avanti (y), v = laterale (x) */
  const RD = st.dist;
  const topPts = [[-st.obsBack - RD, 0], [-RD, 0], [0, -textW / 2], [0, textW / 2]];
  if (isLamp) topPts.push([st.lampY - RD, st.lampX]);
  const T0 = fitView(topPts, W, H, 24, 0.7);
  if (!drag.current) frozen.current.top = T0;
  const T = (drag.current && frozen.current.top) || T0;
  const tArr = T.px(-RD, st.devX || 0), tObs = T.px(-st.obsBack - RD, 0);
  const tT1 = T.px(0, -textW / 2), tT2 = T.px(0, textW / 2), tTc = T.px(0, 0);
  const pinEdge = (dirU, dirV) => {  // sole all'infinito: icona fissa al bordo, lungo la direzione
    const n = Math.hypot(dirU, dirV) || 1;
    const ux = dirU / n, uy = -dirV / n;
    const cx = W / 2, cy = H / 2, m = 22;
    let t = 1e9;
    if (ux > 1e-6) t = Math.min(t, (W - m - cx) / ux);
    if (ux < -1e-6) t = Math.min(t, (m - cx) / ux);
    if (uy > 1e-6) t = Math.min(t, (H - m - cy) / uy);
    if (uy < -1e-6) t = Math.min(t, (m - cy) / uy);
    return [cx + ux * t, cy + uy * t];
  };
  const sunTop = [-Math.cos(azRel * D2R), Math.sin(azRel * D2R)];
  const sTip = pinEdge(sunTop[0], sunTop[1]);
  const tLamp = isLamp ? T.px(st.lampY - RD, st.lampX) : null;

  /* vista laterale: u = avanti (y), v = altezza (z) */
  const P0s = [st.dist, targetHeight(st.planeTilt, st.planeH, st.ceilH)];
  const dirP = [Math.cos(tR), Math.sin(tR)];
  const plA = [P0s[0] - dirP[0] * textH / 2, P0s[1] - dirP[1] * textH / 2];
  const plB = [P0s[0] + dirP[0] * textH / 2, P0s[1] + dirP[1] * textH / 2];
  // superficie estesa (pavimento/parete): dal piede fino oltre la scritta
  const surfLen = textH / 2 + 0.6;
  let sf, sg;
  if (st.planeTilt > 90) {                      // soffitto (piano o inclinato): copre anche l'array
    const back = dirP[0] < -0.05
      ? Math.min(14, Math.max(surfLen, (-RD - 0.4 - P0s[0]) / dirP[0])) : surfLen;
    sf = [P0s[0] - dirP[0] * surfLen, P0s[1] - dirP[1] * surfLen];
    sg = [P0s[0] + dirP[0] * back, P0s[1] + dirP[1] * back];
  } else if (st.planeTilt > 3) {                // parete
    sf = [P0s[0] - dirP[0] * Math.min(surfLen, P0s[1] / Math.max(1e-6, dirP[1])), Math.max(0, P0s[1] - dirP[1] * surfLen)];
    sg = [P0s[0] + dirP[0] * surfLen, P0s[1] + dirP[1] * surfLen];
  } else {                                      // pavimento
    sf = [P0s[0] - surfLen, 0];
    sg = [P0s[0] + dirP[0] * surfLen, P0s[1] + dirP[1] * surfLen];
  }
  const hnd = [P0s[0] + dirP[0] * (surfLen + 0.15), P0s[1] + dirP[1] * (surfLen + 0.15)];
  const surfName = st.planeTilt <= 5 ? "floor" : st.planeTilt >= 175 ? "ceiling"
    : st.planeTilt > 95 ? `sloped ceiling ${st.planeTilt}°` : st.planeTilt >= 85 ? "wall" : `plane ${st.planeTilt}°`;
  const sidePts = [[-st.obsBack - RD, 0], [-st.obsBack - RD, st.obsH], [-RD, st.devZ],
    [plA[0] - RD, plA[1]], [plB[0] - RD, plB[1]], [sf[0] - RD, sf[1]], [sg[0] - RD, sg[1]], [hnd[0] - RD, hnd[1]], [0, 0]];
  if (isLamp) sidePts.push([st.lampY - RD, st.lampZ]);
  const S20 = fitView(sidePts, W, H, 24, 0.55);
  if (!drag.current) frozen.current.side = S20;
  const S2 = (drag.current && frozen.current.side) || S20;
  const sArrC = S2.px(-RD, st.devZ);
  const arrDir = [Math.cos(gR), -Math.sin(gR)];
  let sArr1 = S2.px(-RD - arrDir[0] * half, st.devZ - arrDir[1] * half);
  let sArr2 = S2.px(-RD + arrDir[0] * half, st.devZ + arrDir[1] * half);

  const sObsF = S2.px(-st.obsBack - RD, 0), sObsH = S2.px(-st.obsBack - RD, st.obsH);
  const sP0 = S2.px(P0s[0] - RD, P0s[1]), sPlA = S2.px(plA[0] - RD, plA[1]), sPlB = S2.px(plB[0] - RD, plB[1]);
  const sFloor0 = S2.px(S2.x0, 0), sFloor1 = S2.px(S2.x1, 0);
  const sunSide = [-Math.cos(elev * D2R) * Math.cos(azRel * D2R), Math.sin(elev * D2R)];
  const sSunTip = pinEdge(sunSide[0], sunSide[1]);
  const sLamp = isLamp ? S2.px(st.lampY - RD, st.lampZ) : null;
  const svgStyle = { background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 8, width: "100%", display: "block", touchAction: "none" };

  /* --- trascinamento: mappa cursore -> mondo -> parametri --- */
  const world = (e, fit) => {
    const r = e.currentTarget.getBoundingClientRect();
    const X = (e.clientX - r.left) * W / Math.max(1, r.width);
    const Y = (e.clientY - r.top) * H / Math.max(1, r.height);
    const [uu, vv] = fit.inv(X, Y);
    return [uu + st.dist, vv];   // frame stanza -> frame array
  };
  const rnd = (x, s = 0.1) => Math.round(Math.round(x / s) * s * 100) / 100;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const grab = () => ({});
  const endDrag = () => { drag.current = null; lastPt.current = null; };
  const moveTop = (e) => {
    if (!drag.current) return;
    const [u, v] = world(e, T);
    if (drag.current === "arrayT") {
      const r = e.currentTarget.getBoundingClientRect();
      const X = (e.clientX - r.left) * W / Math.max(1, r.width);
      const Y = (e.clientY - r.top) * H / Math.max(1, r.height);
      const s0 = lastPt.current;
      if (!s0) { lastPt.current = { X, Y, dist0: st.dist, lampX0: st.lampX, lampY0: st.lampY, obs0: st.obsBack, sc: T.sc }; return; }
      const du = (X - s0.X) / s0.sc, dv = -(Y - s0.Y) / s0.sc;
      const p = { dist: rnd(clamp(s0.dist0 - du, 0.5, 30)) };
      p.obsBack = rnd(clamp(s0.obs0 + (s0.dist0 - p.dist), 0, 20));            // l'osservatore resta fermo nella stanza
      if (isLamp) { p.lampX = rnd(clamp(s0.lampX0 - dv, -15, 15));
                    p.lampY = rnd(clamp(s0.lampY0 - du, -30, p.dist - 0.2)); }  // il faretto resta fermo nella stanza
      patch(p);
      return;
    }
    if (drag.current === "lampT") patch({ lampY: rnd(clamp(u, -30, st.dist - 0.2)), lampX: rnd(clamp(v, -15, 15)) });
    else if (drag.current === "text") patch({ dist: rnd(clamp(u, 0.5, 30)) });
    else if (drag.current === "obsT") patch({ obsBack: rnd(clamp(-u, 0, 20)) });
    else if (drag.current === "sunT") {
      const r0 = e.currentTarget.getBoundingClientRect();
      const dX = (e.clientX - r0.left) * W / Math.max(1, r0.width) - W / 2;
      const dV = -((e.clientY - r0.top) * H / Math.max(1, r0.height) - H / 2);
      const rel = Math.round(Math.atan2(dV, -dX) * R2D);
      if (st.lightMode === "sunManual") patch({ sunAzRel: clamp(rel, -180, 180) });
      else patch({ projAz: ((Math.round((I.sunAzNorth ?? 180) - rel - 180) % 360) + 360) % 360 });
    }
  };
  const moveSide = (e) => {
    if (!drag.current) return;
    const [u, v] = world(e, S2);
    if (drag.current === "lampS") patch({ lampY: rnd(clamp(u, -30, st.dist - 0.2)), lampZ: rnd(clamp(v, 0.2, 12)) });
    else if (drag.current === "array") patch({ devZ: rnd(clamp(v, 0.2, 3), 0.05) });
    else if (drag.current === "arrTilt") {
      let g = Math.atan2(-(v - st.devZ), u) * R2D;     // direzione locale Y = (cos g, -sin g)
      g = ((g % 360) + 360) % 360;                      // rotazione completa 0..360
      for (const sn of [0, 45, 90, 135, 180, 225, 270, 315, 360]) if (Math.abs(g - sn) <= 5) g = sn % 360;
      patch({ devTiltAuto: false, devTilt: Math.round(g) });
    }
    else if (drag.current === "obsS") patch({ obsBack: rnd(clamp(-u, 0, 20)), obsH: rnd(clamp(v, 0.5, 2.2), 0.05) });
    else if (drag.current === "planeS") {
      const p = { dist: rnd(clamp(u, 0.5, 30)) };
      if (st.planeTilt > 5 && st.planeTilt <= 90) p.planeH = rnd(clamp(v / Math.sin(tR), 0.2, 4), 0.05);
      patch(p);
    }
    else if (drag.current === "tiltS") {
      let pt = Math.round(clamp(Math.atan2(v - P0s[1], u - P0s[0]) * R2D, 0, 90));
      for (const sn of [0, 45, 90]) if (Math.abs(pt - sn) <= 5) pt = sn;   // scatto pavimento/45/parete
      patch({ planeTilt: pt });
    }
    else if (drag.current === "sunS") {
      const r0 = e.currentTarget.getBoundingClientRect();
      const dX = (e.clientX - r0.left) * W / Math.max(1, r0.width) - W / 2;
      const dV = -((e.clientY - r0.top) * H / Math.max(1, r0.height) - H / 2);
      const targetElev = clamp(Math.atan2(dV, Math.abs(dX) + 1e-6) * R2D, 1, 89);
      if (st.lightMode === "sunManual") patch({ sunElev: Math.round(targetElev) });
      else if (st.lightMode === "sunAuto") {
        // trova l'orario del giorno (stessa meta' mattina/pomeriggio) con quella elevazione
        const utc0 = new Date(st.dateLocal + ":00").getTime() - st.tzOffset * 3600000;
        const d0 = new Date(utc0);
        const dayStart = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate());
        let noonT = dayStart, noonE = -99;
        for (let m = 0; m < 1440; m += 6) {
          const { elev } = solarPosition(new Date(dayStart + m * 60000), st.lat, st.lon);
          if (elev > noonE) { noonE = elev; noonT = dayStart + m * 60000; }
        }
        const afternoon = utc0 >= noonT;
        let bestT = null, bestD = 1e9;
        for (let m = 0; m < 1440; m += 3) {
          const t0 = dayStart + m * 60000;
          if ((t0 >= noonT) !== afternoon) continue;
          const { elev } = solarPosition(new Date(t0), st.lat, st.lon);
          if (elev <= 0) continue;
          const dd = Math.abs(elev - targetElev);
          if (dd < bestD) { bestD = dd; bestT = t0; }
        }
        if (bestT != null) {
          const loc = new Date(bestT + st.tzOffset * 3600000);
          const p2 = (n) => String(n).padStart(2, "0");
          patch({ dateLocal: `${loc.getUTCFullYear()}-${p2(loc.getUTCMonth() + 1)}-${p2(loc.getUTCDate())}T${p2(loc.getUTCHours())}:${p2(loc.getUTCMinutes())}` });
        }
      }
    }
  };

  return (
    <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="Top view"
        onPointerMove={moveTop} onPointerUp={endDrag} onPointerLeave={endDrag}>
        {lbl(W - 10, 14, "TOP VIEW", "#BDB49E", "end")}
        {isLamp ? <>{dash(tLamp, tArr)}<circle cx={tLamp[0]} cy={tLamp[1]} r="6" fill="#FFD60A" stroke="#E8A93C" strokeWidth="1.5" />
          {lbl(tLamp[0], tLamp[1] - 10, `spotlight (${st.lampX}; ${st.lampY} m)`, C.gold)}
          <circle cx={tLamp[0]} cy={tLamp[1]} r="15" fill="transparent" {...grab("lampT")} /></>
          : <>{dash(sTip, tArr, "#E8A93C")}<circle cx={sTip[0]} cy={sTip[1]} r="8" fill="#FFD60A" stroke="#E8A93C" strokeWidth="2" />
          {lbl(sTip[0], clearOf(sTip[0] - 40, sTip[1] - 12, warnTop), `sun az.rel ${azRel.toFixed(0)}\u00b0`, "#C7861A")}
          <circle cx={sTip[0]} cy={sTip[1]} r="16" fill="transparent" {...grab("sunT")} /></>}
        {dash(tArr, tTc)}
        {(() => { const aw = Math.max(6, 2 * half * T.sc); return <>
          <rect x={tArr[0] - 5} y={tArr[1] - aw / 2} width="10" height={aw} fill={C.steel} rx="2" />
          {lbl(tArr[0], tArr[1] + aw / 2 + 12, `array ${(2 * half).toFixed(2)} m`, C.steel)}
        </>; })()}
        <rect x={tArr[0] - 14} y={tArr[1] - Math.max(18, half * T.sc + 6)} width="28" height={Math.max(36, 2 * half * T.sc + 12)} fill="transparent"
          onPointerDown={(e) => { e.preventDefault(); drag.current = "arrayT"; lastPt.current = null;
            const svg = e.currentTarget.ownerSVGElement, r = svg.getBoundingClientRect();
            lastPt.current = { X: (e.clientX - r.left) * W / Math.max(1, r.width), Y: (e.clientY - r.top) * H / Math.max(1, r.height), dist0: st.dist, lampX0: st.lampX, lampY0: st.lampY, obs0: st.obsBack, sc: T.sc }; }} />
        <circle cx={tObs[0]} cy={tObs[1]} r="4" fill="#6E6758" />
        {lbl(tObs[0], clearOf(tObs[0] - 40, tObs[1] - 16, warnTop), `viewer (−${st.obsBack} m)`, "#6E6758")}
        <circle cx={tObs[0]} cy={tObs[1]} r="13" fill="transparent" {...grab("obsT")} />
        <line x1={tT1[0]} y1={tT1[1]} x2={tT2[0]} y2={tT2[1]} stroke={C.ink} strokeWidth="3" />
        {lbl(tTc[0], tT1[1] + 14, `text at ${st.dist} m on ${surfName} · width ${textW.toFixed(2)} m`, C.ink)}
        <line x1={tT1[0]} y1={tT1[1]} x2={tT2[0]} y2={tT2[1]} stroke="transparent" strokeWidth="20" {...grab("text")} />
        {stack([
          (AL.graze || AL.wide) && { t: AL.graze ? `⚠ grazing light: −${I.lightLossPct}% light` : `⚠ wide angles: −${I.lightLossPct}% light`, c: AL.graze ? C.err : "#C98A0F" },
          AL.overlap && { t: "⚠ spot > pitch: letters smear", c: C.err },
          AL.far && { t: "⚠ long distance: dim spots", c: "#C98A0F" },
        ])}
      </svg>
      <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="Side view"
        onPointerMove={moveSide} onPointerUp={endDrag} onPointerLeave={endDrag}>
        {lbl(W - 10, 14, "SIDE VIEW", "#BDB49E", "end")}
        <line x1={sFloor0[0]} y1={sFloor0[1]} x2={sFloor1[0]} y2={sFloor1[1]} stroke="#E4C89B" />
        {isLamp ? <>{dash(sLamp, sArrC)}<circle cx={sLamp[0]} cy={sLamp[1]} r="6" fill="#FFD60A" stroke="#E8A93C" strokeWidth="1.5" />
          {lbl(sLamp[0], sLamp[1] - 10, `spotlight h ${st.lampZ} m`, C.gold)}
          <circle cx={sLamp[0]} cy={sLamp[1]} r="15" fill="transparent" {...grab("lampS")} /></>
          : <>{dash(sSunTip, sArrC, "#E8A93C")}<circle cx={sSunTip[0]} cy={sSunTip[1]} r="8" fill="#FFD60A" stroke="#E8A93C" strokeWidth="2" />
          {lbl(sSunTip[0], clearOf(sSunTip[0] - 40, sSunTip[1] - 12, warnSide), `elev ${elev.toFixed(0)}° · ${Math.abs(azRel) > 135 ? "in front" : Math.abs(azRel) > 45 ? "TO THE SIDE" : "behind"}`, "#C7861A")}
          <circle cx={sSunTip[0]} cy={sSunTip[1]} r="16" fill="transparent" {...grab("sunS")} /></>}
        {dash(sArrC, sP0)}
        {(() => { const fpx = [Math.sin(gR), -Math.cos(gR)];   // normale "fronte" in pixel
          const o = 4.5, f1 = [sArr1[0] + fpx[0] * o, sArr1[1] + fpx[1] * o], f2 = [sArr2[0] + fpx[0] * o, sArr2[1] + fpx[1] * o];
          return (<>
            <line x1={sArr1[0]} y1={sArr1[1]} x2={sArr2[0]} y2={sArr2[1]} stroke={I.backlit ? C.err : "#5B6670"} strokeWidth="6" strokeLinecap="round" />
            <line x1={f1[0]} y1={f1[1]} x2={f2[0]} y2={f2[1]} stroke="#5FB8CE" strokeWidth="3.5" strokeLinecap="round" />
            {(() => { const txtA = `array ${(2 * half).toFixed(2)} m \u00b7 h ${st.devZ} m \u00b7 tilt ${(I.devTilt ?? 0).toFixed(0)}\u00b0`;
          const x0 = sArrC[0] - 10 - txtA.length * 5.4;
          const moved = x0 < sObsH[0] + 14 || (x0 < bzX(warnSide) && Math.min(sArr1[1], sArr2[1]) - 17 < bzY(warnSide));
          return lbl(f2[0] + fpx[0] * 17, Math.max(f2[1] + fpx[1] * 17 + 4,
            Math.max(sArr1[1], sArr2[1]) + (moved ? 30 : 14)), "mirrors", "#3E93AA"); })()}
          </>); })()}
        {(() => { const txt = `array ${(2 * half).toFixed(2)} m \u00b7 h ${st.devZ} m \u00b7 tilt ${(I.devTilt ?? 0).toFixed(0)}\u00b0`;
          const yTop = Math.min(sArr1[1], sArr2[1]) - 17, x0 = sArrC[0] - 10 - txt.length * 5.4;
          // sotto l'array se l'etichetta finirebbe sull'osservatore o sui badge
          const clash = x0 < sObsH[0] + 14 || (x0 < bzX(warnSide) && yTop < bzY(warnSide));
          return lbl(clash ? sArrC[0] + 12 : sArrC[0] - 10,
                     clash ? Math.max(sArr1[1], sArr2[1]) + 15 : yTop,
                     txt, I.backlit ? C.err : C.steel, clash ? "start" : "end"); })()}
        <line x1={sArr1[0]} y1={sArr1[1]} x2={sArr2[0]} y2={sArr2[1]} stroke="transparent" strokeWidth="18" {...grab("array")} />
                <line x1={sObsF[0]} y1={sObsF[1]} x2={sObsH[0]} y2={sObsH[1]} stroke="#6E6758" strokeWidth="2" />
        {(() => { const ex = sObsH[0], ey = sObsH[1] - 5, ew = 9, eh = 5.5;
          return (<g>
            <path d={`M ${ex - ew} ${ey} Q ${ex} ${ey - eh * 1.7} ${ex + ew} ${ey} Q ${ex} ${ey + eh * 1.7} ${ex - ew} ${ey} Z`}
              fill="#FFFFFF" stroke={C.ink} strokeWidth="1.4" />
            <circle cx={ex + 1.5} cy={ey} r="3.1" fill="#8EB6D8" />
            <circle cx={ex + 1.5} cy={ey} r="1.5" fill={C.ink} />
            {[-0.65, -0.25, 0.15].map((t, i) => { const bx = ex + t * ew, by = ey - eh * 1.35 * (1 - t * t);
              return <line key={i} x1={bx} y1={by} x2={bx - 2.2} y2={by - 4.5} stroke={C.ink} strokeWidth="1.2" strokeLinecap="round" />; })}
          </g>); })()}
        {dash([sObsH[0], sObsH[1] - 5], sP0, I.occFrac > 0 ? C.err : "#B9B9BF")}
        {lbl(sObsF[0], sObsF[1] + 12, `eyes ${st.obsH} m`, "#6E6758")}
        <line x1={sObsF[0]} y1={sObsF[1]} x2={sObsH[0]} y2={sObsH[1] - 10} stroke="transparent" strokeWidth="18" {...grab("obsS")} />
        <line x1={sPlA[0]} y1={sPlA[1]} x2={sPlB[0]} y2={sPlB[1]} stroke={C.ink} strokeWidth="3" />
                <line x1={sPlA[0]} y1={sPlA[1]} x2={sPlB[0]} y2={sPlB[1]} stroke={C.ink} strokeWidth="4" />
        {lbl(sP0[0], Math.min(sPlA[1], sPlB[1]) - 8, `${surfName} (${st.planeTilt}\u00b0) \u00b7 viewer sees it at ${I.viewAngle ? I.viewAngle.toFixed(0) : "\u2014"}\u00b0`, C.ink)}
        <line x1={sPlA[0]} y1={sPlA[1]} x2={sPlB[0]} y2={sPlB[1]} stroke="transparent" strokeWidth="20" {...grab("planeS")} />
        {stack([
          AL.backlit && { t: AL.behind ? "⚠ LIGHT FROM BEHIND" : "⚠ GRAZING LIGHT ON THE PANEL", c: C.err },
          AL.occ && { t: `⚠ the array blocks the view (${Math.round(100 * I.occFrac)}%)`, c: C.err },
          AL.body && { t: "⚠ your shadow covers the array", c: "#C98A0F" },
          !AL.backlit && (AL.graze || AL.wide) && { t: AL.graze ? `⚠ grazing light: −${I.lightLossPct}%` : `⚠ wide angles: −${I.lightLossPct}%`, c: AL.graze ? C.err : "#C98A0F" },
          AL.far && { t: "⚠ long distance", c: "#C98A0F" },
        ])}
      </svg>
    </div>
  );
}


/* ================= Overview & Guide pages ================= */
const P = {
  wrap: { maxWidth: 780, margin: "0 auto" },
  hero: { fontSize: 46, fontWeight: 600, lineHeight: 1.1, margin: "30px 0 12px", letterSpacing: "-0.015em" },
  lead: { fontSize: 17, lineHeight: 1.6, color: "#3A3A3C", margin: "0 0 18px" },
  h2: { fontSize: 21, fontWeight: 600, margin: "30px 0 8px", letterSpacing: "-0.01em" },
  p: { fontSize: 14.5, lineHeight: 1.65, color: "#3A3A3C", margin: "0 0 12px" },
  card: { background: "#FFFFFF", border: "1px solid #D2D2D7", borderRadius: 14, padding: "18px 20px", margin: "14px 0" },
  kbd: { fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", fontSize: 13, background: "#F5F5F7", border: "1px solid #D2D2D7", borderRadius: 6, padding: "1px 6px" },
  a: { color: "#1D1D1F", textDecoration: "underline", textUnderlineOffset: 3 },
};

function HomePage({ go }) {
  return (
    <div style={P.wrap}>
      <h1 style={P.hero}>Write messages with sunlight.</h1>
      <p style={P.lead}>
        A heliograph mirror array is a 3D-printed panel of small mirrors, each tilted at a precisely
        computed angle, so that together they reflect the sun — or a spotlight — into glowing dots of
        light that spell out a message on a wall or on the ground.
      </p>

      <div style={P.card}>
        <h2 style={{ ...P.h2, marginTop: 0 }}>The story behind it</h2>
        <p style={P.p}>
          In 2021, physicist <a style={P.a} href="https://bencbartlett.com/blog/3D-printed-mirror-array/" target="_blank" rel="noreferrer">Ben
          Bartlett</a> designed a hexagonal array of 196 mirrors as a marriage proposal: just before
          sunset on his 8th anniversary, the array reflected the setting sun onto the ground to spell
          <b> “MARRY ME?”</b>. He printed it on an ordinary Ender&nbsp;3 and glued one-inch craft
          mirrors onto the angled pillars. It worked on the first real try — and he open-sourced the
          whole project. This app is built on his idea and geometry, and extends it into a complete
          design studio.
        </p>
      </div>

      <h2 style={P.h2}>How it works</h2>
      <p style={P.p}>
        Every mirror knows two directions: where the light comes from (<i>v̂</i>, the sun or lamp) and
        where its dot must land (<i>t̂</i>, one pixel of your text). A mirror reflects light
        symmetrically, so its normal simply has to <b>bisect the two directions</b>: n ∝ v̂ + t̂. The app
        rasterizes your text into a grid of target points, assigns one mirror to each point, and solves
        that tiny equation once per mirror. The 3D-printed frame is a field of hexagonal pillars whose
        top faces are cut at exactly those angles — the mirrors just get glued flat on top.
      </p>
      <p style={P.p}>
        Two of Bartlett's insights matter most. First, <b>ring matching</b>: targets are assigned to
        mirrors ring-by-ring from the center outward, keeping the reflected rays as parallel as
        possible — so the message stays legible even if you hold the array at a slightly wrong distance
        or angle. Second, <b>tiling</b>: an array larger than your print bed is split into flower-like
        tiles whose seams run only through the base, never through a pillar — a planar cut across a
        pillar top would ruin angles that must be accurate to a few tenths of a degree.
      </p>
      <p style={P.p}>
        (Bartlett's near-disaster is worth retelling: twenty hours into the final print he realized the
        array would project <span style={P.kbd}>?EM YRRAM</span> — mirrored! This app shows you the live
        simulated projection at all times, exactly to avoid that fate.)
      </p>

      <h2 style={P.h2}>What this studio adds</h2>
      <p style={P.p}>
        The <b>Designer</b> page is a full physical simulation: real sun position from your location,
        date and time (or a spotlight with lumens and beam angle), spot size from solar divergence,
        smearing at grazing angles, brightness and contrast against ambient light, occlusion and
        shadowing checks, and an optimizer that searches within your tolerances for the sharpest,
        brightest configuration — every suggestion verified against the full simulation before it is
        shown. When you are happy, one click exports a <span style={P.kbd}>config.json</span> for the
        companion Python tool, which recomputes all mirror normals independently, cross-checks them
        against the app (to machine precision), and generates print-ready STL tiles plus an assembly
        map.
      </p>

      <div style={{ margin: "26px 0 34px" }}>
        <button onClick={go} style={{ background: "#1D1D1F", color: "#FFFFFF", border: "none", borderRadius: 980, padding: "13px 26px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Open the Designer →</button>
        <a href="https://github.com/bencbartlett/3D-printed-mirror-array" target="_blank" rel="noreferrer"
          style={{ ...P.a, marginLeft: 16, fontSize: 14 }}>Original project on GitHub</a>
      </div>
    </div>
  );
}

function GuidePage() {
  const row = (name, refl, note) => (
    <tr key={name} style={{ borderTop: "1px solid #E8E8ED" }}>
      <td style={{ padding: "8px 10px 8px 0", fontWeight: 600 }}>{name}</td>
      <td style={{ padding: "8px 10px", fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", whiteSpace: "nowrap" }}>{refl}</td>
      <td style={{ padding: "8px 0", color: "#3A3A3C" }}>{note}</td>
    </tr>);
  return (
    <div style={P.wrap}>
      <h1 style={P.hero}>Materials & printing</h1>
      <p style={P.lead}>What to buy and how to print it — distilled from Bartlett's build and from the
        photometry this app simulates. Set your mirror material in the Designer to see its real effect
        on contrast.</p>

      <div style={P.card}>
        <h2 style={{ ...P.h2, marginTop: 0 }}>Mirrors</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <tbody>
            {row("1\" hexagonal craft mirrors", "~87–90%", "The proven choice (used in the original). Cheap, pre-cut, glass. The slight rear-surface ghost image is irrelevant at these angles.")}
            {row("First-surface aluminum glass", "~92%", "Coating on the front face: no ghosting, noticeably punchier spots. Good outdoor durability.")}
            {row("Protected-silver first-surface", "~97%", "The maximum. Pricier; look for \"protected silver first surface mirror\" (optics suppliers).")}
            {row("Acrylic mirror sheet", "~82%", "Avoid for sharpness: it flexes, and flatness matters more than the last 5% of reflectivity — bent mirrors smear the spots.")}
            {row("Polished stainless steel", "~63%", "Only if it must be indestructible. Dim spots.")}
          </tbody>
        </table>
        <p style={{ ...P.p, marginTop: 10 }}>
          Whatever you choose: <b>glass ≥ 2 mm</b> for flatness, and clean the mirrors before judging
          brightness — haze costs more light than the material choice.
        </p>
      </div>

      <div style={P.card}>
        <h2 style={{ ...P.h2, marginTop: 0 }}>Glue</h2>
        <p style={P.p}>
          The one hard rule from the original build: use a glue that <b>does not expand while
          curing</b> — expansion tilts the mirrors and the angles are sensitive to fractions of a
          degree. A very thin coat of cyanoacrylate is proven to work, but its curing vapors can fog
          the mirror surfaces: Bartlett glued with a fan blowing across the work, mounting mirrors
          right-to-left so vapors drifted away from finished ones. Gentler alternative: tiny dots of
          E6000 or neutral-cure silicone — slower, but fume-free and slightly elastic.
        </p>
      </div>

      <div style={P.card}>
        <h2 style={{ ...P.h2, marginTop: 0 }}>Printer & settings</h2>
        <p style={P.p}>
          Any FDM printer works — the original ran on a <b>Creality Ender 3 v2</b> (220 × 220 mm bed).
          The Python tool splits arrays that exceed your bed into tiles whose seams pass only through
          the base, never through a pillar; pass your real bed size with
          <span style={P.kbd}> --bed 220x220</span>.
        </p>
        <p style={P.p}>
          <b>Orientation & scale:</b> print the tiles exactly as exported, base on the bed, scale 100% —
          the slanted pillar tops <i>are</i> the mirror angles. No supports needed (the report tells you
          the max pillar tilt; below ~45° you are fine). <b>Layers:</b> 0.2 mm for the body, but switch
          to fine layers (0.10–0.12 mm, or adaptive) for the last 2–3 mm: that is where the angle
          accuracy lives. <b>Adhesion:</b> warping was the original build's main enemy — a lifted corner
          bends every pillar above it. Use a brim, a properly leveled bed, slightly lower bed
          temperature, and (proven trick) a film of hairspray.
        </p>
        <p style={P.p}>
          <b>Filament:</b> PLA is fine indoors and is what the original used. For an array that will sit
          in the sun, prefer <b>PETG</b> — a dark PLA frame can soften above ~55 °C. Matte dark filament
          also makes the mirrors visually pop. 3 perimeters, 15% infill is plenty.
        </p>
      </div>

      <div style={P.card}>
        <h2 style={{ ...P.h2, marginTop: 0 }}>Assembly & aiming</h2>
        <p style={P.p}>
          Glue the tiles together at the base first (light sanding of mating edges is normal), on a flat
          surface. Then mount the mirrors following the numbered map in
          <span style={P.kbd}> report.png</span> — the aligner tabs on each pillar seat the hexagon for
          you. Outdoors, orient the array as designed (projection azimuth and tilt); small aiming errors
          are recovered by rotating the whole panel until the message locks onto the target.
        </p>
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}


/* ================= In-browser STL generation (port of the Python tool) ================= */
function polygon2(shape, widthMm, rotDeg = 0) {
  const pts = [];
  if (shape === "hex") {
    const R = widthMm / Math.sqrt(3);
    for (let k = 0; k < 6; k++) { const a = (k * 60 + 30 + rotDeg) * D2R; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
  } else {
    const R = widthMm / Math.sqrt(2);
    for (let k = 0; k < 4; k++) { const a = (k * 90 + 45 + rotDeg) * D2R; pts.push([R * Math.cos(a), R * Math.sin(a)]); }
  }
  return pts;
}
function requiredTopHeight(normals, shape, widthMm, minBase = 3) {
  const poly = polygon2(shape, widthMm);
  let worst = 0;
  for (const n of normals) for (const [px, py] of poly) worst = Math.max(worst, (n[0] * px + n[1] * py) / n[2]);
  return worst + minBase;
}
function prismBetween(bottom, top) {
  const n = bottom.length, tris = [];
  const cb = [0, 0, 0], ct = [0, 0, 0];
  for (const p of bottom) { cb[0] += p[0] / n; cb[1] += p[1] / n; cb[2] += p[2] / n; }
  for (const p of top) { ct[0] += p[0] / n; ct[1] += p[1] / n; ct[2] += p[2] / n; }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push([bottom[j], bottom[i], cb], [top[i], top[j], ct],
              [bottom[i], bottom[j], top[j]], [bottom[i], top[j], top[i]]);
  }
  return tris;
}
function topRing(poly2d, cx, cy, topH, n) {
  if (n[2] <= 0.05) throw new Error("Local normal nearly horizontal: pillar not printable.");
  return poly2d.map(([px, py]) => [cx + px, cy + py, topH - (n[0] * px + n[1] * py) / n[2]]);
}
function pillarTris(cx, cy, nL, shape, mirrorW, margin, topH, aligner = true, alignerH = 1.8) {
  const outer = polygon2(shape, mirrorW + 2 * margin);
  const inner = polygon2(shape, mirrorW);
  const bottom = outer.map(([px, py]) => [cx + px, cy + py, 0]);
  const top = topRing(outer, cx, cy, topH, nL);
  if (Math.min(...top.map(p => p[2])) < 2)
    throw new Error("Pillar too short for the required tilt: increase pillar height.");
  let tris = prismBetween(bottom, top);
  if (aligner) {
    const nn = V.unit(nL);
    const topIn = topRing(inner, cx, cy, topH, nL);
    for (const e of [0, 1]) {
      const i = e, j = (e + 1) % outer.length;
      const q = [topIn[i], topIn[j], top[j], top[i]];
      const lift = q.map(pt => [pt[0] + alignerH * nn[0], pt[1] + alignerH * nn[1], pt[2] + alignerH * nn[2]]);
      tris = tris.concat(prismBetween(q, lift));
    }
  }
  return tris;
}
function basePadTris(cx, cy, shape, footprintMm, padH = 3) {
  const p2 = polygon2(shape, footprintMm);
  const bottom = p2.map(([px, py]) => [cx + px, cy + py, 0]);
  const top = bottom.map(p => [p[0], p[1], padH]);
  return prismBetween(bottom, top);
}
function stlBinary(tris) {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  let o = 84;
  for (const [a, b, c] of tris) {
    const u = V.sub(b, a), w = V.sub(c, a);
    let n = V.cross(u, w); const L = V.norm(n) || 1; n = [n[0] / L, n[1] / L, n[2] / L];
    for (const v of [n, a, b, c]) for (let k = 0; k < 3; k++) { dv.setFloat32(o, v[k], true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Uint8Array(buf);
}
const CRC_T = (() => { const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {   // STORE (nessuna compressione): [{name, data:Uint8Array}]
  const enc = new TextEncoder(); const chunks = []; const central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 0, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true);
    lh.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + n;
  }
  let cSize = 0; for (const c of central) cSize += c.length;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(8, files.length, true); eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, cSize, true); eocd.setUint32(16, off, true);
  const all = [...chunks, ...central, new Uint8Array(eocd.buffer)];
  let tot = 0; for (const c of all) tot += c.length;
  const out = new Uint8Array(tot); let q = 0;
  for (const c of all) { out.set(c, q); q += c.length; }
  return out;
}
function buildPrintFiles(st, res, bedW, bedH) {
  const rows = res.rows || [];
  if (!rows.length || !res.assign) throw new Error("Nothing to print: fix the design first.");
  const margin = 1.0, shape = st.shape, mw = st.mirrorW;
  const footprint = mw + 2 * margin + st.gap;
  const topH = Math.max(12, requiredTopHeight(rows.map(r => r.nL), shape, mw + 2 * margin));
  const half = footprint / 2;
  let xmin = 1e9, ymin = 1e9, xmax = -1e9, ymax = -1e9;
  for (const r of rows) { xmin = Math.min(xmin, r.a - half); ymin = Math.min(ymin, r.b - half);
                          xmax = Math.max(xmax, r.a + half); ymax = Math.max(ymax, r.b + half); }
  // ogni pilastro sporge footprint/2 oltre il proprio centro: la cella utile
  // per i CENTRI deve essere (piatto - footprint), o la tessera eccede il piatto
  // l'esagono (piatto-su-piatto lungo x) e' 2/sqrt(3) piu' largo sulle punte
  const fpx = footprint, fpy = shape === "hex" ? footprint * 2 / Math.sqrt(3) : footprint;
  if (bedW <= fpx || bedH <= fpy)
    throw new Error(`Print bed ${bedW}\u00d7${bedH} mm is too small: one pillar takes ${fpx.toFixed(1)}\u00d7${fpy.toFixed(1)} mm.`);
  const ux = bedW - fpx, uy = bedH - fpy;
  let cx0 = 1e9, cy0 = 1e9, cx1 = -1e9, cy1 = -1e9;
  for (const r of rows) { cx0 = Math.min(cx0, r.a); cx1 = Math.max(cx1, r.a);
                          cy0 = Math.min(cy0, r.b); cy1 = Math.max(cy1, r.b); }
  const nx = Math.max(1, Math.ceil((cx1 - cx0) / ux));
  const ny = Math.max(1, Math.ceil((cy1 - cy0) / uy));
  const tiles = new Map();
  for (const r of rows) {
    const tx = Math.min(nx - 1, Math.max(0, Math.floor((r.a - cx0) / ux)));
    const ty = Math.min(ny - 1, Math.max(0, Math.floor((r.b - cy0) / uy)));
    const k = tx + "_" + ty;
    if (!tiles.has(k)) tiles.set(k, []);
    tiles.get(k).push(r);
  }
  const files = [], tileInfo = [];
  for (const [k, rs] of [...tiles.entries()].sort()) {
    let tris = [];
    for (const r of rs) {
      tris = tris.concat(pillarTris(r.a, r.b, r.nL, shape, mw, margin, topH));
      tris = tris.concat(basePadTris(r.a, r.b, shape, footprint));
    }
    files.push({ name: `array_tile_${k}.stl`, data: stlBinary(tris) });
    tileInfo.push({ key: k, pillars: rs.length, tris: tris.length, idx: rs.map(r => r.i) });
  }
  return { files, tileInfo, topH, footprint, grid: [nx, ny], bounds: [xmin, ymin, xmax, ymax] };
}


function mirrorMapSVG(rows, tileInfo, mirrorW, shape) {
  const cols = ["#1D1D1F", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5AC8FA", "#FFCC00", "#8E8E93"];
  const tileOf = {}; tileInfo.forEach((t, ti) => t.idx.forEach(i => tileOf[i] = ti));
  let xmin = 1e9, ymin = 1e9, xmax = -1e9, ymax = -1e9;
  for (const r of rows) { xmin = Math.min(xmin, r.a); xmax = Math.max(xmax, r.a); ymin = Math.min(ymin, r.b); ymax = Math.max(ymax, r.b); }
  const pad = mirrorW, W = xmax - xmin + 2 * pad, H = ymax - ymin + 2 * pad, sc = 640 / W;
  const px = (a, b) => [(a - xmin + pad) * sc, (ymax - b + pad) * sc];
  let sh = "";
  for (const r of rows) {
    const [x, y] = px(r.a, r.b), col = cols[(tileOf[r.i] || 0) % cols.length];
    const R = mirrorW / 2 * sc * (shape === "hex" ? 2 / Math.sqrt(3) : Math.SQRT2);
    const nV = shape === "hex" ? 6 : 4, rot = shape === "hex" ? 30 : 45;
    const pts = Array.from({ length: nV }, (_, k) => { const a2 = (k * 360 / nV + rot) * Math.PI / 180;
      return (x + R * Math.cos(a2)).toFixed(1) + "," + (y - R * Math.sin(a2)).toFixed(1); }).join(" ");
    sh += `<polygon points="${pts}" fill="${col}22" stroke="${col}" stroke-width="1.5"/>` +
          `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" font-size="${Math.max(8, mirrorW * sc * 0.34).toFixed(0)}" text-anchor="middle" fill="#1D1D1F" font-family="Menlo,monospace">${r.i}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${(H * sc).toFixed(0)}" style="max-width:100%;background:#fff;border:1px solid #D2D2D7;border-radius:10px">${sh}</svg>`;
}
function assemblyGuideHTML(st, res, pf, cfg) {
  const I = res.info, sun = st.lightMode !== "lamp";
  const surf = st.planeTilt <= 5 ? "floor" : st.planeTilt >= 175 ? "ceiling" : st.planeTilt > 95 ? `sloped ceiling (${st.planeTilt}\u00b0)` : st.planeTilt >= 85 ? "wall" : `surface tilted ${st.planeTilt}\u00b0`;
  const map = mirrorMapSVG(res.rows, pf.tileInfo, st.mirrorW, st.shape);
  const tileRows = pf.tileInfo.map(t =>
    `<tr><td><code>array_tile_${t.key}.stl</code></td><td>${t.pillars}</td><td>${t.tris}</td><td>mirrors ${t.idx[0]}\u2026${t.idx[t.idx.length - 1]}</td></tr>`).join("");
  const cols = ["#1D1D1F", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5AC8FA", "#FFCC00", "#8E8E93"];
  const legend = pf.tileInfo.map((t, ti) =>
    `<span style="display:inline-block;margin-right:14px"><span style="display:inline-block;width:11px;height:11px;background:${cols[ti % cols.length]};border-radius:3px;margin-right:5px"></span>tile ${t.key}</span>`).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Heliograph \u2014 Assembly guide</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;max-width:820px;margin:30px auto;padding:0 18px;color:#1D1D1F;line-height:1.6}
h1{font-size:30px}h2{font-size:20px;margin-top:28px}table{border-collapse:collapse;width:100%;font-size:14px}
td,th{border-top:1px solid #E8E8ED;padding:7px 10px;text-align:left}code{background:#F5F5F7;border:1px solid #D2D2D7;border-radius:5px;padding:1px 5px;font-size:13px}
.step{background:#fff;border:1px solid #D2D2D7;border-radius:12px;padding:14px 18px;margin:12px 0}.n{display:inline-block;background:#1D1D1F;color:#fff;border-radius:99px;width:24px;height:24px;text-align:center;line-height:24px;font-weight:700;margin-right:8px}
.warn{background:#FFF4E5;border:1px solid #F5C27A;border-radius:10px;padding:10px 14px;font-size:14px}</style></head><body>
<h1>Assembly guide</h1>
<p><b>Design:</b> \u201C${st.text.replace(/</g, "&lt;")}\u201D \u00b7 ${res.rows.length} mirrors (${st.shape}, ${st.mirrorW} mm) \u00b7 array ${(I.arraySize || 0).toFixed(2)} m wide
\u00b7 projected on the ${surf} at ${st.dist} m \u00b7 ${sun ? `sun, ${st.dateLocal.replace("T", " ")} (UTC+${st.tzOffset}), lat ${st.lat} lon ${st.lon}` : `spotlight ${st.lampLm} lm at (${st.lampX}, ${st.lampY}, ${st.lampZ}) m`}.</p>
<div class="step"><span class="n">1</span><b>Print the tiles</b> \u2014 ${pf.tileInfo.length} file(s), bed ${cfg.bed[0]}\u00d7${cfg.bed[1]} mm, pillar height ${pf.topH.toFixed(1)} mm.
<table><tr><th>File</th><th>Pillars</th><th>Triangles</th><th>Mirror IDs</th></tr>${tileRows}</table>
<p>Print exactly as exported: base on the bed, scale 100%, no supports. 0.2 mm layers for the body, <b>0.10\u20130.12 mm for the last 3 mm</b> (the slanted tops are the mirror angles). Use a brim; a lifted corner bends every pillar above it. PLA indoors, PETG if the array will sit in the sun.</p></div>
<div class="step"><span class="n">2</span><b>Join the tiles</b> \u2014 dry-fit on a flat surface, lightly sand mating edges if needed, then glue tile bases together (thin cyanoacrylate or epoxy on the base only \u2014 never touch the pillar tops). The seams pass only through the base, so alignment is forgiving; keep everything flat until cured.</div>
<div class="step"><span class="n">3</span><b>Mount the mirrors</b> \u2014 follow the numbered map below (colors = tiles). Each pillar has two aligner tabs that seat the mirror corner. Use a glue that <b>does not expand</b> while curing: a very thin coat of cyanoacrylate (work with a fan blowing across, mount right-to-left so vapors drift away from finished mirrors) or tiny dots of E6000 / neutral-cure silicone.<br><br>${legend}<br><br>${map}</div>
<div class="step"><span class="n">4</span><b>Aim it</b> \u2014 place the array ${st.devZ} m above the floor${(st.devX || 0) !== 0 ? `, ${Math.abs(st.devX)} m to the ${st.devX > 0 ? "right" : "left"}` : ""}, facing the target ${st.dist} m away${sun ? `, with the projection azimuth at ${st.projAz}\u00b0 from north` : ""}. Array tilt: ${(I.devTilt ?? 0).toFixed(0)}\u00b0${st.devTiltAuto ? " (auto)" : ""}. ${sun ? `The message appears around ${st.dateLocal.slice(11)} local time \u2014 small aiming errors are fixed by rotating the whole panel until the text locks on.` : "Switch the lamp on and rotate the panel slightly until the text locks on."}</div>
${st.planeTilt > 90 ? `<div class="step" style="border-color:#A7D9E2"><b>Overhead projection</b> \u2014 the text is already mirrored so it reads correctly to someone lying below and looking up (get this wrong and you get Bartlett\u2019s famous \u201C?EM YRRAM\u201D). Ceiling height used: ${st.ceilH} m. Keep the array low and close to directly under the text: the more vertical the beam, the rounder the spots.</div>` : ""}
<div class="warn">\u26A0 The array concentrates ${res.rows.length} reflections. Never look at the sun in the mirrors, and avoid pointing the projection at anyone's eyes at short distance.</div>
<p style="color:#86868B;font-size:13px">Generated by Heliograph Studio \u00b7 based on Ben Bartlett\u2019s \u201C3D printed mirror array\u201D. The bundled <code>config.json</code> can be re-verified anytime with the companion Python tool.</p>
</body></html>`;
}

function buildConfig(st, res) {
    const sun = st.lightMode === "sunAuto"
      ? { auto: true, datetime_utc: new Date(new Date(st.dateLocal + ":00").getTime() - st.tzOffset * 3600000).toISOString().slice(0, 19), lat: st.lat, lon: st.lon, projection_azimuth_deg: st.projAz }
      : { elevation_deg: st.sunElev, azimuth_rel_deg: st.sunAzRel };
    const cfg = {
      schema_version: 1,
      light: st.lightMode === "lamp"
        ? { mode: "lamp", lamp: { position_m: [st.lampX, st.lampY, st.lampZ], diameter_m: st.lampD / 100, lumens: st.lampLm, beam_deg: st.lampBeam } }
        : { mode: "sun", sun },
      photometry: { ambient_lux: st.ambient, mirror_reflectivity: st.reflect ?? 0.9, slope_error_mrad: st.slopeMrad ?? 1.0 },
      observer: { behind_m: st.obsBack, eye_height_m: st.obsH },
      plane: { distance_m: st.dist, tilt_deg: st.planeTilt, center_height_m: st.planeH, ceiling_height_m: st.ceilH },
      device: { center_m: [st.devX || 0, 0, st.devZ], tilt_deg: st.devTiltAuto ? "auto" : st.devTilt,
        mirror_shape: st.shape, mirror_width_mm: st.mirrorW, gap_mm: st.gap,
        grid: st.shape === "hex" ? { type: "hex", radius: st.hexR } : { type: "square", cols: st.cols, rows: st.rows } },
      text: { string: st.text, pitch_cm: st.pitch, flip_h: st.flipH, flip_v: st.flipV },
      pillar: { base_height_mm: 12, margin_mm: 1, aligner: true },
      assignments: res.assign ? res.rows.map(r => ({ i: r.i, normal_local: r.nL })) : [],
    };
    return cfg;
}

export default function EliografoStudio() {
  const [st, setSt] = useState({
    lightMode: "sunAuto", sunElev: 30, sunAzRel: 180,
    dateLocal: nowLocalISO(), tzOffset: -new Date().getTimezoneOffset() / 60, lat: 43.93, lon: 10.92, projAz: 285,
    lampX: 0, lampY: -3, lampZ: 2.5, lampD: 8,
    dist: 5, planeTilt: 0, ceilH: 2.7, devZ: 1.2, devX: 0, reflect: 0.9, slopeMrad: 1.0, bedW: 220, bedH: 220, devTiltAuto: true, devTilt: 0,
    shape: "hex", mirrorW: 25.4, gap: 2, hexR: 5, cols: 8, rows: 8,
    text: "HELLO ♥", pitch: 7, flipH: false, flipV: false, tol: 0,
    lampLm: 1500, lampBeam: 36, ambient: 50,
    obsBack: 0.4, obsH: 1.65, planeH: 1.3,
    optOn: { day: true, hour: true, dist: true, devZ: true, devX: true, planeH: true, ceilH: true, obsBack: true, obsH: true, lampY: true, lampZ: true },
    optRange: { day: 1, hour: 1, dist: 1, devZ: 1, devX: 1, planeH: 1, ceilH: 0.3, obsBack: 1, obsH: 0.2, lampY: 1, lampZ: 1 },
  });
  const up = (k) => (v) => setSt(s => ({ ...s, [k]: v }));
  const res = useMemo(() => compute(st), [st]);
  const [optRes, setOptRes] = useState(null);
  const [geoMsg, setGeoMsg] = useState(null);
  const [page, setPage] = useState("home");
  const [appliedMsg, setAppliedMsg] = useState(null);
  useEffect(() => { setOptRes(null); }, [st]);
  const projRef = useRef(null), arrRef = useRef(null);

  /* --- canvas proiezione (elemento firma) --- */
  useEffect(() => {
    const cv = projRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    ctx.fillStyle = "#07090F"; ctx.fillRect(0, 0, W, H);
    const { rows, t2d, pf, tolHits } = res;
    if (!rows.length || !res.assign) {
      ctx.fillStyle = "#8A94AB"; ctx.font = "14px system-ui"; ctx.textAlign = "center";
      ctx.fillText("Set the text and grid to see the projection", W / 2, H / 2);
      return;
    }
    const xs = t2d.map(p => p[0]), ys = t2d.map(p => p[1]);
    const rMax = Math.max(...rows.map(r => r.spotR * r.elong));
    const pad = 3 * rMax + 0.08;
    let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
    let y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    if (tolHits) tolHits.forEach(h => { if (h) { x0 = Math.min(x0, h[0] - pad); x1 = Math.max(x1, h[0] + pad); y0 = Math.min(y0, h[1] - pad); y1 = Math.max(y1, h[1] + pad); } });
    const sc = Math.min(W / (x1 - x0), H / (y1 - y0));
    const ox = (W - sc * (x1 - x0)) / 2, oy = (H - sc * (y1 - y0)) / 2;
    const px = (a, b) => [ox + sc * (a - x0), H - oy - sc * (b - y0)];
    // griglia metrica
    ctx.strokeStyle = "#141B2B"; ctx.lineWidth = 1;
    const stepM = (x1 - x0) > 4 ? 1 : 0.5;
    for (let gx = Math.ceil(x0 / stepM) * stepM; gx <= x1; gx += stepM) {
      const [X] = px(gx, 0); ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, H); ctx.stroke();
      ctx.fillStyle = "#3A4358"; ctx.font = "10px monospace"; ctx.textAlign = "left";
      ctx.fillText(gx.toFixed(1) + " m", X + 3, H - 5);
    }
    for (let gy = Math.ceil(y0 / stepM) * stepM; gy <= y1; gy += stepM) {
      const [, Y] = px(0, gy); ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(W, Y); ctx.stroke();
    }
    // spot: alone + nucleo, ellittici secondo l'obliquità del raggio
    const drawSpots = (getAB, alpha, hue) => {
      rows.forEach(r => {
        const ab = getAB(r); if (!ab) return;
        const [X, Y] = px(ab[0], ab[1]);
        const rr = Math.max(2, r.spotR * sc);
        const inPl = [V.dot(r.ray, pf.r), V.dot(r.ray, pf.s)];
        const rot = -Math.atan2(inPl[1], inPl[0]);
        ctx.save(); ctx.translate(X, Y); ctx.rotate(rot);
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * r.elong * 1.6);
        grd.addColorStop(0, `rgba(${hue},${alpha})`);
        grd.addColorStop(0.55, `rgba(${hue},${alpha * 0.5})`);
        grd.addColorStop(1, `rgba(${hue},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(0, 0, rr * r.elong * 1.6, rr * 1.6, 0, 0, 7); ctx.fill();
        ctx.restore();
      });
    };
    if (tolHits) {
      drawSpots(r => { const d = V.sub(r.tp, pf.P0); return [V.dot(d, pf.r), V.dot(d, pf.s)]; }, 0.25, "243,184,67");
      drawSpots(r => tolHits[r.i], 0.9, "143,179,206");
    } else {
      drawSpots(r => { const d = V.sub(r.tp, pf.P0); return [V.dot(d, pf.r), V.dot(d, pf.s)]; }, 0.9, "243,184,67");
    }
    const al = res.info.al || {};
    if (al.overlap || al.far || al.graze) {
      const msg = al.overlap ? "⚠ SPOTS WIDER THAN PITCH: LETTERS SMEAR — increase pitch or move closer"
        : al.graze ? "⚠ GRAZING LIGHT: VERY DIM SPOTS" : "⚠ LONG DISTANCE: DIM, WIDENED SPOTS";
      ctx.fillStyle = al.overlap || al.graze ? "rgba(188,68,48,0.92)" : "rgba(201,138,15,0.92)";
      ctx.fillRect(0, 0, W, 26);
      ctx.fillStyle = "#FFF"; ctx.font = "700 12px monospace"; ctx.textAlign = "center";
      ctx.fillText(msg, W / 2, 17);
    }
  }, [res]);

  /* --- canvas array --- */
  useEffect(() => {
    const cv = arrRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    ctx.fillStyle = "#F1EBDD"; ctx.fillRect(0, 0, W, H);
    const { offsets, rows } = res; if (!offsets.length) return;
    const xs = offsets.map(p => p[0]), ys = offsets.map(p => p[1]);
    const half = (st.mirrorW + st.gap) / 2 + 2;
    const x0 = Math.min(...xs) - half, x1 = Math.max(...xs) + half;
    const y0 = Math.min(...ys) - half, y1 = Math.max(...ys) + half;
    const sc = Math.min(W / (x1 - x0), H / (y1 - y0));
    const ox = (W - sc * (x1 - x0)) / 2, oy = (H - sc * (y1 - y0)) / 2;
    const maxT = Math.max(res.info.maxTilt, 1e-6);
    offsets.forEach(([a, b], i) => {
      const X = ox + sc * (a - x0), Y = H - oy - sc * (b - y0);
      const t = rows[i] ? rows[i].tilt / maxT : 0;
      const R = sc * st.mirrorW / 2 * (st.shape === "hex" ? 1.05 : 1.2);
      ctx.beginPath();
      const n = st.shape === "hex" ? 6 : 4, a0 = st.shape === "hex" ? Math.PI / 2 : Math.PI / 4;
      for (let k = 0; k <= n; k++) {
        const ang = a0 + k * 2 * Math.PI / n;
        const px2 = X + R * Math.cos(ang), py2 = Y + R * Math.sin(ang);
        k ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2);
      }
      const hot = rows[i] && rows[i].tilt > 32;
      ctx.fillStyle = hot ? C.err : `rgb(${40 + 200 * t},${60 + 120 * t},${90 - 30 * t})`;
      ctx.fill(); ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    });
    ctx.fillStyle = C.dim; ctx.font = "11px monospace"; ctx.textAlign = "left";
    ctx.fillText(`inclinazione pilastri 0 → ${res.info.maxTilt.toFixed(1)}°`, 8, H - 8);
  }, [res, st.mirrorW, st.gap, st.shape]);

  /* --- export --- */
  const buildCfg = () => buildConfig(st, res);
  function exportConfig() {
    const cfg = buildCfg();
    const blob = new Blob([JSON.stringify(cfg, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "config.json"; a.click();
    try { URL.revokeObjectURL(a.href); } catch (e) {}
  }

  const I = res.info;
  const stat = (k, v, hot) => (
    <div style={{ padding: "8px 10px", background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 8, minWidth: 90 }}>
      <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: ".07em" }}>{k}</div>
      <div style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", fontSize: 15, color: hot ? C.err : C.ink, marginTop: 2 }}>{v}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif", padding: 18 }}>
      <style>{`input,select,textarea{color-scheme:light} textarea{resize:vertical}
        button:focus-visible,input:focus-visible{outline:2px solid ${C.gold};outline-offset:1px}`}</style>

      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16, borderBottom: `1px solid ${C.line}`, paddingBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Heliograph <span style={{ color: C.dim, fontWeight: 500 }}>Studio</span><span style={{ fontSize: 10, color: C.dim, fontWeight: 400, marginLeft: 8, letterSpacing: 0 }} title="Build timestamp \u2014 check this matches the latest version">build {BUILD}</span></h1>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>
            Write with reflected light — design your mirror array</div>
        </div>
        <nav style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {[["home", "Overview"], ["studio", "Designer"], ["guide", "Materials & printing"]].map(([k, name]) => (
            <button key={k} onClick={() => { setPage(k); try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) { window.scrollTo(0, 0); } }}
              style={{ background: page === k ? C.ink : "transparent", color: page === k ? "#FFFFFF" : C.ink,
                border: `1px solid ${page === k ? C.ink : C.line}`, borderRadius: 980, padding: "8px 16px",
                fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{name}</button>))}
          {page === "studio" && <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.dim, marginLeft: 6 }}>
              Bed
              <input type="number" value={st.bedW} onChange={e => up("bedW")(parseFloat(e.target.value) || 220)} style={{ ...S.input, width: 58, padding: "6px 8px" }} />
              ×
              <input type="number" value={st.bedH} onChange={e => up("bedH")(parseFloat(e.target.value) || 220)} style={{ ...S.input, width: 58, padding: "6px 8px" }} />
              mm</span>
            <button onClick={() => {
                try {
                  const pf = buildPrintFiles(st, res, st.bedW, st.bedH);
                  const cfg = buildCfg(); cfg.bed = [st.bedW, st.bedH];
                  const enc = new TextEncoder();
                  const files = [...pf.files,
                    { name: "assembly-guide.html", data: enc.encode(assemblyGuideHTML(st, res, pf, cfg)) },
                    { name: "config.json", data: enc.encode(JSON.stringify(cfg, null, 1)) }];
                  const blob = new Blob([makeZip(files)], { type: "application/zip" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob); a.download = "heliograph-print-files.zip"; a.click();
                  try { URL.revokeObjectURL(a.href); } catch (e) {}
                } catch (err) { alert("Cannot generate: " + err.message); }
              }}
              style={{ background: C.goldFill, color: "#FFFFFF", border: "none", borderRadius: 980, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Generate print files</button>
            <button onClick={exportConfig} style={{ background: "#EBDEAA", color: C.ink, border: "none", borderRadius: 980, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Export config.json</button>
          </>}
        </nav>
      </header>

      {page === "home" && <HomePage go={() => { setPage("studio"); try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) { window.scrollTo(0, 0); } }} />}
      {page === "guide" && <GuidePage />}
      {page === "studio" && <>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: 16, alignItems: "start" }}>
        {/* -------- controlli -------- */}
        <div>
          <section style={S.group}>
            <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#EBDEAA", marginRight: 8 }} />Light</h2>
            <Seg value={st.lightMode} set={up("lightMode")}
              options={[["sunAuto", "Sun · auto"], ["sunManual", "Sun · manual"], ["lamp", "Spotlight"]]} />
            {st.lightMode === "sunAuto" && (<>
              <div style={S.row}>
                <div style={{ flex: 2 }}><label style={S.label}>Local date & time</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="datetime-local" style={{ ...S.input, flex: 1 }} value={st.dateLocal} onChange={e => up("dateLocal")(e.target.value)} />
                    <button onClick={() => setSt(x => ({ ...x, dateLocal: nowLocalISO(), tzOffset: -new Date().getTimezoneOffset() / 60 }))}
                      title="Set to the current date and time"
                      style={{ background: "#EBDEAA", color: C.ink, border: "none", borderRadius: 8, padding: "0 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Now</button>
                  </div></div>
                <Num label="Time zone" unit="UTC+" value={st.tzOffset} set={up("tzOffset")} step={0.5} />
              </div>
              <div style={S.row}>
                <Num label="Latitude" value={st.lat} set={up("lat")} step={0.01} />
                <Num label="Longitude" value={st.lon} set={up("lon")} step={0.01} />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <button onClick={() => {
                  if (!navigator.geolocation) { setGeoMsg("This browser has no geolocation API \u2014 type your latitude and longitude below."); return; }
                  if (window.isSecureContext === false) { setGeoMsg("Location needs a secure page (https). Open the online version, or type lat/lon below."); return; }
                  setGeoMsg("Detecting your location\u2026");
                  navigator.geolocation.getCurrentPosition(
                    (pos) => { setGeoMsg("Location set \u2713"); setSt(x => ({ ...x, lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 })); },
                    (err) => setGeoMsg(
                      err && err.code === 1 ? "Location blocked. Allow it from the icon in the address bar \u2014 on macOS also enable it in System Settings \u203a Privacy & Security \u203a Location Services for your browser."
                      : err && err.code === 3 ? "Location timed out \u2014 try again, or type lat/lon below."
                      : "Location unavailable \u2014 type your latitude and longitude below."),
                    { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false });
                }} style={{ background: "#ADDAC5", color: C.ink, border: "none", borderRadius: 980, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Use my location</button>
                {geoMsg && <span style={{ fontSize: 12, color: geoMsg.indexOf("\u2713") >= 0 ? C.ok : "#B25000", fontWeight: 600, flex: "1 1 240px" }}>{geoMsg}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 2, marginBottom: 8 }}>Solar disc today: {((I.sdiv || 0.0093) * R2D).toFixed(3)}° <span style={{ color: "#C7861A" }}>(0.525–{"0.543"}° across the year — Earth–Sun distance)</span></div>
              <Slider label="Projection azimuth (0=N 90=E 180=S 270=W)" value={st.projAz} set={up("projAz")} min={0} max={359} unit="°" />
              {I.sunElev !== undefined && (
                <div style={{ fontSize: 12, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", color: I.sunElev > 0 ? C.ok : C.err }}>
                  ☉ right now the sun is {I.sunElev.toFixed(1)}° above the horizon, toward {compassName(I.sunAzNorth)} ({I.sunAzNorth.toFixed(0)}°) · {Math.abs(I.sunAzRel) > 90 ? "in front of you" : "behind you"}
                </div>)}
            </>)}
            {st.lightMode === "sunManual" && (<>
              <Slider label="Sun elevation" value={st.sunElev} set={up("sunElev")} min={1} max={89} unit="°" />
              <Slider label="Relative azimuth (0 = behind you, ±180 = in front)" value={st.sunAzRel} set={up("sunAzRel")} min={-180} max={180} unit="°" />
            </>)}
            {st.lightMode === "lamp" && (<>
              <div style={S.row}>
                <Num label="Sideways (+right −left)" unit="m" value={st.lampX} set={up("lampX")} step={0.1} />
                <Num label="Forward (− = behind)" unit="m" value={st.lampY} set={up("lampY")} step={0.1} />
                <Num label="Height above floor" unit="m" value={st.lampZ} set={up("lampZ")} step={0.1} />
              </div>
              <Slider label="Source diameter" value={st.lampD} set={up("lampD")} min={0.5} max={30} step={0.5} unit=" cm" />
              <div style={S.row}>
                <Num label="Luminous flux" unit="lm" value={st.lampLm} set={up("lampLm")} step={100} min={50} />
                <Num label="Beam angle" unit="°" value={st.lampBeam} set={up("lampBeam")} step={1} min={5} max={120} />
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>Coordinates relative to the array (you are the origin). A small, distant source = sharper spots; more lumens and a tighter beam = more visible spots.</div>
            </>)}
          </section>

          <section style={S.group}>
            <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#A7D9E2", marginRight: 8 }} />Space</h2>
            <Slider label="Projection distance" value={st.dist} set={up("dist")} min={0.5} max={30} step={0.5} unit=" m" />
            <Slider label="Surface (0 = floor · 90 = wall · 180 = ceiling)" value={st.planeTilt} set={up("planeTilt")} min={0} max={180} step={5} unit="°" />
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {[["Floor", 0], ["Wall", 90], ["Ceiling", 180]].map(([n, v]) =>
                <button key={n} onClick={() => up("planeTilt")(v)}
                  style={{ flex: 1, background: st.planeTilt === v ? C.goldFill : "#EDEDF0", color: st.planeTilt === v ? "#FFF" : C.ink,
                    border: "none", borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{n}</button>)}
            </div>
            {st.planeTilt > 5 && st.planeTilt <= 90 &&
              <Slider label="Text center height on wall" value={st.planeH} set={up("planeH")} min={0.2} max={4} step={0.05} unit=" m" />}
            {st.planeTilt > 90 &&
              <Slider label="Ceiling height" value={st.ceilH} set={up("ceilH")} min={1.8} max={6} step={0.05} unit=" m" />}
            <Slider label="Array sideways offset (+right −left)" value={st.devX} set={up("devX")} min={-3} max={3} step={0.05} unit=" m" />
            <Slider label="Array height above floor" value={st.devZ} set={up("devZ")} min={0.2} max={3} step={0.05} unit=" m" />
            <label style={{ ...S.label, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textTransform: "none", fontSize: 13, color: C.ink }}>
              <input type="checkbox" checked={st.devTiltAuto} onChange={e => up("devTiltAuto")(e.target.checked)} style={{ accentColor: C.gold }} />
              Automatic array tilt {st.devTiltAuto && I.devTilt !== undefined &&
                <span style={{ color: C.gold, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace" }}>→ {I.devTilt.toFixed(1)}°</span>}
            </label>
            {!st.devTiltAuto && <Slider label="Array tilt" value={st.devTilt} set={up("devTilt")} min={0} max={360} unit="°" />}
          </section>

          <section style={S.group}>
            <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#AAD9D3", marginRight: 8 }} />Mirrors</h2>
            <Seg value={st.shape} set={up("shape")} options={[["hex", "Hexagonal"], ["square", "Square"]]} />
            <div style={S.row}>
              <Num label="Width" unit="mm" value={st.mirrorW} set={up("mirrorW")} step={0.1} />
              <Num label="Gap" unit="mm" value={st.gap} set={up("gap")} step={0.5} />
            </div>
            {st.shape === "hex"
              ? <Slider label="Grid radius (rings)" value={st.hexR} set={up("hexR")} min={1} max={9} />
              : <div style={S.row}>
                  <Num label="Columns" value={st.cols} set={up("cols")} min={2} max={24} />
                  <Num label="Rows" value={st.rows} set={up("rows")} min={2} max={24} />
                </div>}
            <div style={{ margin: "8px 0 2px" }}>
              <div style={S.label}>Mirror material (reflectivity)</div>
              <select value={st.reflect} onChange={e => up("reflect")(parseFloat(e.target.value))}
                style={{ ...S.input, width: "100%" }}>
                <option value={0.97}>Protected-silver first-surface glass (~97%)</option>
                <option value={0.92}>Aluminum first-surface glass (~92%)</option>
                <option value={0.9}>Enhanced aluminum / quality craft mirror (~90%)</option>
                <option value={0.87}>Standard rear-silvered craft mirror (~87%)</option>
                <option value={0.82}>Acrylic mirror (~82%, less flat: softer spots)</option>
                <option value={0.63}>Polished stainless steel (~63%)</option>
              </select>
              <div style={{ marginTop: 10 }}>
                <Num label="Slope error σ" unit="mrad" value={st.slopeMrad} set={up("slopeMrad")} step={0.25} min={0} max={5} />
                <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Surface/mounting accuracy: 0.5 first-surface glass · 1–2 printed pillars + craft mirrors · 3+ flexible acrylic</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: C.steel, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", marginTop: 6 }}>
              Actual array width: <b style={{ color: C.gold }}>{(I.arraySize || 0).toFixed(2)} m</b> · {I.nMirrors ?? "-"} mirrors
            </div>
          </section>

          <section style={S.group}>
            <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#F5B2A1", marginRight: 8 }} />Text</h2>
            <textarea rows={2} style={{ ...S.input, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", fontSize: 15, marginBottom: 10 }}
              value={st.text} onChange={e => up("text")(e.target.value)} placeholder="Your message…" />
            <Slider label="Dot pitch" value={st.pitch} set={up("pitch")} min={1} max={30} step={0.5} unit=" cm" />
            <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
              <label style={{ cursor: "pointer" }}><input type="checkbox" checked={st.flipH} onChange={e => up("flipH")(e.target.checked)} style={{ accentColor: C.gold }} /> mirror ↔</label>
              <label style={{ cursor: "pointer" }}><input type="checkbox" checked={st.flipV} onChange={e => up("flipV")(e.target.checked)} style={{ accentColor: C.gold }} /> mirror ↕</label>
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>A–Z 0–9 ? ! . , - ' : + ♥ · line breaks for multiple rows. Readable orientation is already guaranteed dal motore.</div>
          </section>
        </div>

        {/* -------- simulazione -------- */}
        <div>
          <section style={{ ...S.group, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#ADDAC5", marginRight: 8 }} />Scene</h2>
              <div style={{ fontSize: 11, color: C.dim }}>Read-only preview — set every value in the panels; the scene updates live</div>
            </div>
            <SceneViews st={st} I={I} patch={(p) => setSt(s => ({ ...s, ...p }))} />
            <div style={{ ...S.row, marginTop: 10, marginBottom: 0, maxWidth: 420 }}>
              <Num label="Viewer behind the array" unit="m" value={st.obsBack} set={up("obsBack")} step={0.5} min={0} />
              <Num label="Eye height" unit="m" value={st.obsH} set={up("obsH")} step={0.05} min={0.4} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {[["Standing", 1.65], ["Sitting", 1.15], ["Lying down", 0.5]].map(([n, v]) =>
                  <button key={n} onClick={() => up("obsH")(v)}
                    style={{ flex: 1, background: Math.abs(st.obsH - v) < 0.03 ? C.goldFill : "#EDEDF0", color: Math.abs(st.obsH - v) < 0.03 ? "#FFF" : C.ink,
                      border: "none", borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{n}</button>)}
              </div>
            </div>
          </section>

          <section style={{ ...S.group, marginBottom: 14, background: "#FAFCEF", borderColor: "#DCE690" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#C6DA69", marginRight: 8 }} />Recommended parameters</h2>
              <div style={{ fontSize: 11, color: C.dim }}>tolerance = how far the optimizer may move each value · check = locked (tolerance 0)</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "0 22px" }}>
              {[["day", "Day", st.dateLocal.slice(0, 10), st.lightMode === "sunAuto", "days"],
                ["hour", "Time", st.dateLocal.slice(11), st.lightMode === "sunAuto", "hours"],
                ["dist", "Wall / floor distance", st.dist + " m", true, "m"],
                ["devZ", "Array height", st.devZ + " m", true, "m"],
                ["devX", "Array sideways offset", (st.devX || 0) + " m", true, "m"],
                ["obsBack", "Array–viewer distance", st.obsBack + " m", true, "m"],
                ["obsH", "Eye height", st.obsH + " m", true, "m"],
                ["planeH", "Text height on wall", st.planeH + " m", st.planeTilt > 5 && st.planeTilt <= 90, "m"],
                ["ceilH", "Ceiling height", st.ceilH + " m", st.planeTilt > 90, "m"],
                ["lampY", "Spotlight: forward", st.lampY + " m", st.lightMode === "lamp", "m"],
                ["lampZ", "Spotlight: height", st.lampZ + " m", st.lightMode === "lamp", "m"]]
                .filter(r => r[3]).map(([k, name, val, , unit]) => (
                <div key={k} style={{ padding: "7px 0", borderBottom: `1px dashed ${C.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    <span style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", color: C.steel, whiteSpace: "nowrap" }}>{val}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.dim }}>
                    <span>tolerance ±</span>
                    <input type="number" step={k === "day" || k === "hour" ? 1 : 0.5} min={0}
                      disabled={!st.optOn[k]} value={st.optOn[k] ? st.optRange[k] : 0}
                      style={{ ...S.input, width: 62, opacity: st.optOn[k] ? 1 : 0.5 }}
                      onChange={e => setSt(x => ({ ...x, optRange: { ...x.optRange, [k]: Math.max(0.1, parseFloat(e.target.value) || 1) } }))} />
                    <span>{unit}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", whiteSpace: "nowrap", marginLeft: "auto" }}>
                      <input type="checkbox" checked={!st.optOn[k]} style={{ accentColor: C.gold }}
                        onChange={e => setSt(x => ({ ...x, optOn: { ...x.optOn, [k]: !e.target.checked } }))} />
                      locked</label>
                  </div>
                </div>))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={() => setOptRes(optimizeScene(st, res.info) || "no-sun")}
                style={{ background: C.goldFill, color: "#FFFFFF", border: "none", borderRadius: 980, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Compute optimized parameters</button>
              <button onClick={() => {
                  const stA = { ...st, devTiltAuto: true };
                  const r = optimizeScene(stA, res.info, { frees: ["devX", "devZ"], wide: true });
                  if (r && r.best) r.best.patch.devTiltAuto = true;
                  setOptRes(r ? { ...r, place: true } : "no-sun");
                }}
                style={{ background: "#A7D9E2", color: C.ink, border: "none", borderRadius: 980, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                title="Moves only the array (sideways, height, tilt set to auto). Everything else stays as you set it.">
                Auto-place the array</button>
              {optRes === "no-sun" && <span style={{ fontSize: 12, color: C.err }}>Sun below the horizon: change the time or give Day/Time some tolerance.</span>}
              {optRes && optRes !== "no-sun" && optRes.frees && !optRes.frees.length &&
                <span style={{ fontSize: 12, color: C.dim }}>Every parameter is locked: uncheck a few.</span>}
              {optRes && optRes !== "no-sun" && optRes.infeasible &&
                <span style={{ fontSize: 12, color: C.err }}>No valid combination within the tolerances (blocked view or grazing light): widen tolerances or unlock more.</span>}
              {optRes && optRes !== "no-sun" && optRes.place && !optRes.best && !optRes.infeasible &&
                <span style={{ fontSize: 12, color: C.ok }}>✓ The array is already in the best spot for focus (with tilt on auto).</span>}
              {optRes && optRes !== "no-sun" && !optRes.place && optRes.frees && optRes.frees.length > 0 && !optRes.best && !optRes.infeasible &&
                <span style={{ fontSize: 12, color: C.ok }}>✓ Already at the optimum within tolerances: spot on surface {(optRes.cur.spot * 100).toFixed(1)} cm, contrast {optRes.cur.contrast.toFixed(1)}×. Widen the tolerances to improve further.</span>}
            </div>
            {appliedMsg && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "#1D4A2A", background: "#B2DBB3", borderRadius: 10, padding: "8px 12px", display: "inline-block" }}>{appliedMsg}</div>}
            {optRes && optRes !== "no-sun" && optRes.best && (
              <div style={{ marginTop: 10, background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 8, padding: 10 }}>
                <div style={{ ...S.label, marginBottom: 6 }}>Best focus and brightness within the tolerances:</div>
                {optRes.best.rowsOut.map(([n, a, b]) => (
                  <div key={n} style={{ fontSize: 13, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", color: C.ink }}>
                    {n}: {a} → <span style={{ color: C.gold, fontWeight: 700 }}>{b}</span></div>))}
                <div style={{ fontSize: 13, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", color: C.steel, marginTop: 4 }}>
                  spot on surface {(optRes.cur.spot * 100).toFixed(1)} → <span style={{ color: C.gold }}>{(optRes.best.e.spot * 100).toFixed(1)} cm</span>
                  {" · contrast "}{optRes.cur.contrast.toFixed(1)} → <span style={{ color: C.gold }}>{optRes.best.e.contrast.toFixed(1)}×</span>
                </div>
                <button onClick={() => {
                    const b = optRes.best;
                    setAppliedMsg(`✓ Parameters applied — the simulation below now uses them (spot on surface ${(b.e.spot * 100).toFixed(1)} cm · contrast ${b.e.contrast.toFixed(1)}×)`);
                    setSt(x => ({ ...x, ...b.patch }));
                    setTimeout(() => setAppliedMsg(null), 6000);
                  }}
                  style={{ marginTop: 8, background: C.goldFill, color: "#FFFFFF", border: "none", borderRadius: 980, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Use optimized parameters → simulate</button>
                {optRes.best.needLm && (
                  <div style={{ fontSize: 12, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", color: C.gold, marginTop: 6 }}>
                    △ Full contrast (2×) is out of reach at this flux: you would need ~{optRes.best.needLm} lm or a darker environment.
                  </div>)}
              </div>)}
          </section>

          <section style={{ ...S.group, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#EDC7A0", marginRight: 8 }} />Simulated projection</h2>
              <div style={{ fontSize: 11, color: C.dim }}>as seen by someone looking at the surface from behind the array</div>
            </div>
            <canvas ref={projRef} width={860} height={430} style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.line}`, display: "block" }} />
            <div style={{ marginTop: 10 }}>
              <Slider label={st.tol === 0 ? "Tolerance: what if my distance is off" : `Surface moved to ${(st.dist * (1 + st.tol / 100)).toFixed(2)} m (dark = nominal, blue = actual)`}
                value={st.tol} set={up("tol")} min={-30} max={30} unit="%" />
            </div>
          </section>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {stat("Mirrors", I.nMirrors ?? "—")}
            {stat("Text dots", I.nPoints ?? "—", I.nPoints > I.nMirrors)}
            {stat("Spot on surface", I.spotEff ? (I.spotEff * 100).toFixed(1) + " cm" + (I.meanElong > 1.2 ? ` (beam ${(I.spotD * 100).toFixed(1)}, ×${I.meanElong.toFixed(1)})` : "") : "—", (I.spotEff ?? 0) > 1.35 * st.pitch / 100)}
            {stat("Array tilt", I.devTilt !== undefined ? I.devTilt.toFixed(1) + "°" : "—")}
            {stat("Max pillar", I.maxTilt ? I.maxTilt.toFixed(1) + "°" : "—", I.maxTilt > 32)}
            {stat("Max incidence", I.maxInc ? I.maxInc.toFixed(0) + "°" : "—", I.maxInc > 60)}
            {I.spotLux !== undefined && stat("Spot", I.spotLux >= 1000 ? (I.spotLux / 1000).toFixed(1) + " klx" : I.spotLux.toFixed(0) + " lx", I.contrast < 2)}
            {I.contrast !== undefined && stat("Contrast", I.contrast.toFixed(1) + "×", I.contrast < 2)}
          </div>

          <section style={S.group}>
            <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#F2A39C", marginRight: 8 }} />Focus & visibility</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              {stat("Min spot Ø (physical limit)", I.minSpot ? (I.minSpot * 100).toFixed(1) + " cm" : "—")}
              {stat("Recommended mirror", I.wRec ? I.wRec.toFixed(0) + " mm" : "—")}
              {stat("Recommended pitch", I.pitchRec ? I.pitchRec + " cm" : "—")}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setSt(s => ({ ...s, mirrorW: Math.round(I.wRec * 10) / 10, pitch: I.pitchRec }))}
                disabled={!I.wRec}
                style={{ background: "transparent", color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 8, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Apply recommended values</button>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={S.label}>Ambient light on the surface</label>
                <select style={S.input} value={st.ambient} onChange={e => up("ambient")(parseFloat(e.target.value))}>
                  <option value={1}>Night / dark (~1 lx)</option>
                  <option value={50}>Indoor evening (~50 lx)</option>
                  <option value={300}>Indoor daytime (~300 lx)</option>
                  <option value={8000}>Outdoor shade in daylight (~8000 lx)</option>
                  <option value={30000}>Surface in full sun (~30000 lx)</option>
                </select>
              </div>
              {I.contrast !== undefined && (
                <div style={{ fontSize: 13, fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", padding: "9px 0",
                  color: I.contrast >= 5 ? C.ok : I.contrast >= 2 ? C.gold : C.err }}>
                  {I.contrast >= 5 ? "✓ clearly visible" : I.contrast >= 2 ? "△ visible" : I.contrast >= 1 ? "△ barely visible" : "✕ invisible"}
                </div>)}
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
              Flat mirrors cannot focus below the physical limit (solar divergence 0.53° / spotlight penumbra): the recommendations land exactly on that limit, balancing sharpness and brightness. The viewer's position does not change the optics, only how foreshortened the text appears (view angle in the scene).
            </div>
          </section>

          {res.warn.length > 0 && (
            <section style={{ ...S.group, borderColor: res.warn.some(w => w.lvl === "err") ? C.err : "#DFBE85" }}>
              {res.warn.map((w, i) => (
                <div key={i} style={{ fontSize: 13, color: w.lvl === "err" ? C.err : C.gold, marginBottom: i < res.warn.length - 1 ? 6 : 0 }}>
                  {w.lvl === "err" ? "✕" : "△"} {w.msg}</div>))}
            </section>)}
          {res.warn.length === 0 && I.nPoints > 0 && (
            <section style={{ ...S.group, borderColor: "#A8CDB4" }}>
              <div style={{ fontSize: 13, color: C.ok }}>✓ Valid configuration: every verified ray hits its target.
                {I.dup ? " " + I.dup + "." : ""} Export the config and generate the STLs with the Python tool.</div>
            </section>)}

          <section style={S.group}>
            <h2 style={S.gtitle}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#B2DBB3", marginRight: 8 }} />Array — pillar tilts</h2>
            <canvas ref={arrRef} width={860} height={300} style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.line}`, display: "block" }} />
          </section>
        </div>
      </div>
      </>}

      <footer style={{ marginTop: 8, fontSize: 11, color: C.dim }}>
        Based on Ben Bartlett's “3D printed mirror array” · mirror normal n ∝ v̂ + t̂ · sun ≈ 9.3 mrad · NOAA solar
      </footer>
    </div>
  );
}
