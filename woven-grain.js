// ── Woven Grain エフェクトエンジン（k-eis DESIGN FILTER・新規アプリコンセプト）
// 網籠の構造原理（張力・光と影・不均一さ・密度など）を、2枚（オプションで3枚）の写真の
// 編み込みに翻訳するアプリ。既存シリーズ（Silver Gelatin等）とは異なり、単一写真の色調フィルターではなく
// 2枚の写真の関係性そのものをデザインする構造系アプリ
//
// BASIC PARAMETERS: MESH SIZE / DIRECTION（Stripe・Basket・Diagonal）
// CHARACTER PARAMETERS: WEAVE DEPTH / WARP / IMPERFECTION / DENSITY / TENSION
// BACK LIGHT MODE: 3枚目の写真（Photo C）を背景に敷き、TENSION/IMPERFECTIONで生まれる
//                  隙間から透けて見えるようにする（光そのものではなく、奥に透ける景色）

const outputCanvas = document.getElementById('outputCanvas');
const ctx = outputCanvas.getContext('2d');
const canvasHint = document.getElementById('canvasHint');

// THEME SWITCH: matches the series convention (body.theme-xxx class swap),
// two beige palettes only — Sarashi（晒し布×真鍮、既定）／Touki（陶器×抹茶）
const themeBtns = document.querySelectorAll('.theme-btn');
const THEME_CLASS_MAP = { sarashi: null, touki: 'theme-touki' };

function applyTheme(themeKey) {
  if (!(themeKey in THEME_CLASS_MAP)) return;
  Object.values(THEME_CLASS_MAP).forEach(cls => { if (cls) document.body.classList.remove(cls); });
  const cls = THEME_CLASS_MAP[themeKey];
  if (cls) document.body.classList.add(cls);
  themeBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === themeKey));
  try { localStorage.setItem('wovengrain-theme', themeKey); } catch (e) {}
}

themeBtns.forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

(function initTheme() {
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('wovengrain-theme'); } catch (e) {}
  if (savedTheme && (savedTheme in THEME_CLASS_MAP)) {
    applyTheme(savedTheme);
  } else if (savedTheme) {
    try { localStorage.removeItem('wovengrain-theme'); } catch (e) {}
  }
})();

const imgA = new Image();
const imgB = new Image();
const imgC = new Image();
let hasA = false, hasB = false, hasC = false;

const meshSlider = document.getElementById('mesh');
const meshVal = document.getElementById('meshVal');
const zoomWithMeshToggle = document.getElementById('zoomWithMesh');
const strandLengthSlider = document.getElementById('strandLength');
const strandLengthVal = document.getElementById('strandLengthVal');
const directionBtns = document.querySelectorAll('[data-direction]');
let currentDirection = 'basket';

const exposureASlider = document.getElementById('exposureA');
const exposureAVal = document.getElementById('exposureAVal');
const brillianceASlider = document.getElementById('brillianceA');
const brillianceAVal = document.getElementById('brillianceAVal');
const exposureBSlider = document.getElementById('exposureB');
const exposureBVal = document.getElementById('exposureBVal');
const brillianceBSlider = document.getElementById('brillianceB');
const brillianceBVal = document.getElementById('brillianceBVal');

const depthAmtSlider = document.getElementById('depthAmt');
const depthAmtVal = document.getElementById('depthAmtVal');
const shadowReachSlider = document.getElementById('shadowReach');
const shadowReachVal = document.getElementById('shadowReachVal');
const lightDirectionSlider = document.getElementById('lightDirection');
const lightDirectionVal = document.getElementById('lightDirectionVal');
const grainSlider = document.getElementById('grain');
const grainVal = document.getElementById('grainVal');
const warpSlider = document.getElementById('warp');
const warpVal = document.getElementById('warpVal');
const imperfectionSlider = document.getElementById('imperfection');
const imperfectionVal = document.getElementById('imperfectionVal');
const densitySlider = document.getElementById('density');
const densityVal = document.getElementById('densityVal');
const tensionSlider = document.getElementById('tension');
const tensionVal = document.getElementById('tensionVal');
const backlightToggle = document.getElementById('backlight');
const lightIntensitySlider = document.getElementById('lightIntensity');
const lightIntensityVal = document.getElementById('lightIntensityVal');

const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const animateBtn = document.getElementById('animateBtn');
const animationStage = document.getElementById('animationStage');
const animationStageLabel = document.getElementById('animationStageLabel');
const animationStageProgress = document.getElementById('animationStageProgress');

let animationProgress = null;
let animationFrame = 0;
let animationPlaying = false;

function updateAnimationUI() {
  const ready = hasA && hasB;
  if (animateBtn) animateBtn.disabled = !ready || animationPlaying;
  if (downloadBtn) downloadBtn.disabled = !ready;
}

function animationStageInfo(p) {
  if (p < 0.12) return ['INPUT', p / 0.12];
  if (p < 0.25) return ['CUT', (p - 0.12) / 0.13];
  if (p < 0.67) return ['WEAVE', (p - 0.25) / 0.42];
  if (p < 0.84) return ['FORM', (p - 0.67) / 0.17];
  if (p < 0.96) return ['LIGHT', (p - 0.84) / 0.12];
  return ['FINAL', (p - 0.96) / 0.04];
}

function shouldRevealCell(row, col, maxRow, maxCol, p, salt = 0) {
  // A deterministic serpentine reveal: neighboring cells appear in a woven order,
  // rather than the finished image simply fading in.
  const rr = Math.max(0, row), cc = Math.max(0, col);
  const serp = (rr % 2 === 0) ? cc : (maxCol - cc);
  const path = rr * (maxCol + 1) + serp;
  const total = Math.max(1, (maxRow + 1) * (maxCol + 1) - 1);
  const threshold = path / total;
  const jitter = (seededRandom(rr, cc, 900 + salt) - 0.5) * 0.025;
  return threshold <= p + jitter;
}

function stopAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  animationPlaying = false;
  animationProgress = null;
  if (animationStage) animationStage.style.display = 'none';
  updateAnimationUI();
  render();
}

function playWeaveAnimation() {
  if (!hasA || !hasB || animationPlaying) return;
  if (animationFrame) cancelAnimationFrame(animationFrame);

  animationPlaying = true;
  animationProgress = 0;
  if (animationStage) animationStage.style.display = 'block';
  updateAnimationUI();

  const start = performance.now();
  const duration = 7000;

  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    animationProgress = p;
    const [label, local] = animationStageInfo(p);
    if (animationStageLabel) animationStageLabel.textContent = label;
    if (animationStageProgress) animationStageProgress.textContent = Math.round(local * 100) + '%';
    render();

    if (p < 1) {
      animationFrame = requestAnimationFrame(tick);
    } else {
      animationFrame = 0;
      animationPlaying = false;
      animationProgress = null;
      if (animationStageLabel) animationStageLabel.textContent = 'FINAL';
      if (animationStageProgress) animationStageProgress.textContent = '100%';
      updateAnimationUI();
      render();
      setTimeout(() => {
        if (!animationPlaying && animationStage) animationStage.style.display = 'none';
      }, 900);
    }
  }
  animationFrame = requestAnimationFrame(tick);
}

if (animateBtn) animateBtn.addEventListener('click', playWeaveAnimation);

const previewA = document.getElementById('previewA');
const previewB = document.getElementById('previewB');

function wireDrop(dropId, fileId, img, onLoaded, useBackgroundImage) {
  const drop = document.getElementById(dropId);
  const file = document.getElementById(fileId);
  drop.addEventListener('click', () => file.click());
  file.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        onLoaded();
        drop.classList.add('filled');
        if (useBackgroundImage) drop.style.backgroundImage = `url(${ev.target.result})`;
        render();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
}

wireDrop('dropA', 'fileA', imgA, () => { hasA = true; updateAnimationUI(); }, false);
wireDrop('dropB', 'fileB', imgB, () => { hasB = true; updateAnimationUI(); }, false);
wireDrop('dropC', 'fileC', imgC, () => { hasC = true; }, true);

directionBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    directionBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDirection = btn.dataset.direction;
    render();
  });
});

zoomWithMeshToggle.addEventListener('change', render);

function seededRandom(row, col, salt) {
  let x = Math.sin(row * 127.1 + col * 311.7 + salt * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

// EXPOSURE(露出) -> brightness / BRILLIANCE(鮮やかさ) -> contrast+saturate combined,
// applied per photo (A/B independently) before that photo's cells are drawn.
// レンジは-100〜100、露出は0〜2倍（-100で真っ黒）、鮮やかさは彩度0〜2倍＋コントラスト強調
function photoFilter(exposureVal, brillianceVal) {
  const brightness = 1 + exposureVal / 100;
  const contrast = 1 + brillianceVal / 130;
  const saturate = 1 + brillianceVal / 100;
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
}

function drawCover(img, w, h, destCtx) {
  const targetCtx = destCtx || ctx;
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let sx, sy, sw, sh;
  if (ir > cr) { sh = img.naturalHeight; sw = sh * cr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
  else { sw = img.naturalWidth; sh = sw / cr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
  targetCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

// keeps the Photo A/B dropzone thumbnails in sync with their own EXPOSURE/BRILLIANCE —
// so adjusting a photo's sliders visibly changes that photo's own preview, not just the
// woven output
function updatePreviews(filterA, filterB) {
  if (hasA && previewA) {
    const w = previewA.clientWidth || 160, h = previewA.clientHeight || 160;
    // only reset the canvas backing store when the on-screen size actually changed —
    // resizing every render() call forces a layout reflow each time, which is cheap
    // on desktop but can visibly lag/stall on mobile hardware during slider drags
    if (previewA.width !== w) previewA.width = w;
    if (previewA.height !== h) previewA.height = h;
    const pctx = previewA.getContext('2d');
    pctx.clearRect(0, 0, w, h);
    pctx.filter = filterA;
    drawCover(imgA, w, h, pctx);
    pctx.filter = 'none';
  }
  if (hasB && previewB) {
    const w = previewB.clientWidth || 160, h = previewB.clientHeight || 160;
    if (previewB.width !== w) previewB.width = w;
    if (previewB.height !== h) previewB.height = h;
    const pctx = previewB.getContext('2d');
    pctx.clearRect(0, 0, w, h);
    pctx.filter = filterB;
    drawCover(imgB, w, h, pctx);
    pctx.filter = 'none';
  }
}

// Cuts the four corners of a rect off (an octagon rather than a rounded rect) —
// unlike rounding, this keeps every edge razor-straight along its own length,
// so neighboring cells still touch cleanly edge-to-edge. The gap this opens up
// when TENSION loosens is then concentrated right at the 4-way crossing point
// (a small diamond), matching how a real loose weave actually gaps — instead
// of a uniform hairline gap running the full length of every edge, which is
// what was reading as ruled "graph paper" rather than a woven surface.
function octagonPath(x, y, w, h, cut) {
  const c = Math.max(0, Math.min(cut, Math.min(w, h) / 2 - 0.5));
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function render() {
  const w = outputCanvas.width, h = outputCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const filterA = photoFilter(parseInt(exposureASlider.value, 10), parseInt(brillianceASlider.value, 10));
  const filterB = photoFilter(parseInt(exposureBSlider.value, 10), parseInt(brillianceBSlider.value, 10));
  updatePreviews(filterA, filterB);

  if (!hasA || !hasB) {
    canvasHint.style.display = 'block';
    downloadBtn.disabled = true;
    return;
  }
  canvasHint.style.display = 'none';
  downloadBtn.disabled = false;

  const mesh = parseInt(meshSlider.value, 10);
  const zoomWithMesh = zoomWithMeshToggle.checked;
  const zoomFactor = zoomWithMesh ? Math.max(1, mesh / 40) : 1; // 既定はOFF：MESH SIZEを変えても写真サイズは変わらない
  const strandLength = parseInt(strandLengthSlider.value, 10);
  const depthAmt = parseInt(depthAmtSlider.value, 10) / 100;
  const shadowReach = parseInt(shadowReachSlider.value, 10) / 100;
  const lightDirectionDeg = parseInt(lightDirectionSlider.value, 10);
  // 0°=top, 90°=right, 180°=bottom, 270°=left (clockwise from top), matching the compass feel of the slider
  const lightRad = (lightDirectionDeg - 90) * Math.PI / 180;
  const lightVec = { x: Math.cos(lightRad), y: Math.sin(lightRad) };
  const warpAmt = parseInt(warpSlider.value, 10) / 100 * 18;
  const imperfAmt = parseInt(imperfectionSlider.value, 10) / 100 * mesh * 0.3;
  const density = parseInt(densitySlider.value, 10);
  const tension = parseInt(tensionSlider.value, 10);
  const tensionFactor = (tension - 50) / 50;
  const tensionSizeAdjust = tensionFactor * mesh * 0.30;
  const tensionDepthMul = 1 + tensionFactor * 0.9;
  const backlightOn = backlightToggle.checked && hasC;
  const lightIntensity = parseInt(lightIntensitySlider.value, 10) / 100;
  const grainAmt = parseInt(grainSlider.value, 10) / 100;

  // Animation phases:
  // INPUT/CUT: establish the material and cutting idea;
  // WEAVE: progressively reveal the actual cells in a serpentine woven order;
  // FORM: increase depth/overlap;
  // LIGHT: progressively introduce directional relief lighting.
  const ap = animationProgress;
  const weaveP = ap == null ? 1 : Math.max(0, Math.min(1, (ap - 0.25) / 0.42));
  const formP = ap == null ? 1 : Math.max(0, Math.min(1, (ap - 0.67) / 0.17));
  const lightP = ap == null ? 1 : Math.max(0, Math.min(1, (ap - 0.84) / 0.12));
  const visualDepthAmt = depthAmt * (ap == null ? 1 : formP);
  const visualLightIntensity = lightIntensity * (ap == null ? 1 : lightP);

  if (ap != null && ap < 0.25) {
    // Give INPUT/CUT a clear visual identity instead of showing the finished weave.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = ap < 0.12 ? ap / 0.12 : 1;
    ctx.filter = filterA;
    drawCover(imgA, w * 0.46, h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = ap < 0.12 ? ap / 0.12 : 1;
    ctx.translate(w * 0.54, 0);
    ctx.filter = filterB;
    drawCover(imgB, w * 0.46, h);
    ctx.restore();
    if (ap >= 0.12) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ap - 0.12) / 0.13);
      ctx.strokeStyle = 'rgba(255,248,232,.75)';
      ctx.lineWidth = 1;
      const step = Math.max(12, mesh);
      for (let x = 0; x <= w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.restore();
    }
    return;
  }

  if (backlightOn) {
    ctx.save();
    ctx.filter = `brightness(${0.6 + visualLightIntensity * 1.1})`;
    drawCover(imgC, w, h);
    ctx.restore();
  } else {
    // no Photo C loaded — gaps from a loose TENSION should reveal plain black,
    // not the app's transparent canvas background (which would export as a hole
    // in the saved PNG). Filled explicitly here so it's part of the actual pixels.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
  }

  if (currentDirection === 'diagonal') {
    renderDiagonalWeave({ mesh, zoomFactor, strandLength, depthAmt: visualDepthAmt, shadowReach, lightVec, warpAmt, imperfAmt, density, tensionFactor, tensionSizeAdjust, tensionDepthMul, filterA, filterB, animationProgress: ap, weaveProgress: weaveP, lightProgress: lightP });
    if (ap == null || ap >= 0.96) applyGrain(grainAmt);
    return;
  }

  // ── PASS 1 (UNDER layer): every cell's crossing photo, drawn near its full
  // grid size but with its own light jitter + partial TENSION response — NOT
  // perfectly tiled edge-to-edge. A perfectly tiled under layer was the bug:
  // it fully covered the canvas by itself, so black/Photo C could never show
  // through and loosening TENSION did nothing visible at all.
  // TENSION now drives the octagon corner-cut directly (see cornerCut below) —
  // the under layer itself stays close to full size regardless of TENSION, so
  // it isn't also compounding into oversized gaps.
  const underShrink = 0;
  // TENSION's single, bounded gap mechanism: at neutral/tight it's a small
  // corner nick (cells read as almost-touching squares); toward LOOSE it grows
  // into a visible diamond gap at the 4-way crossings — capped well short of
  // swallowing the whole cell, so it never becomes a "grate" of mostly black.
  const cornerCut = mesh * (0.05 + Math.max(0, -tensionFactor) * 0.24);
  for (let gy = 0; gy < h; gy += mesh) {
    for (let gx = 0; gx < w; gx += mesh) {
      const col = Math.floor(gx / mesh);
      const row = Math.floor(gy / mesh);
      if (ap != null && !shouldRevealCell(row, col, Math.ceil(h / mesh) - 1, Math.ceil(w / mesh) - 1, weaveP, 1)) continue;
      const gRow = Math.floor(row / strandLength);
      const gCol = Math.floor(col / strandLength);
      let baseUseA = currentDirection === 'stripe' ? col % 2 === 0 : (gRow + gCol) % 2 === 0;
      let useA = baseUseA;
      if (density > 50 && !baseUseA) { if (seededRandom(gRow, gCol, 5) < (density - 50) / 50) useA = true; }
      else if (density < 50 && baseUseA) { if (seededRandom(gRow, gCol, 5) < (50 - density) / 50) useA = false; }

      const cw = Math.min(mesh, w - gx);
      const ch = Math.min(mesh, h - gy);
      const warpX = warpAmt * Math.sin(gy * 0.05 + col);
      const warpY = warpAmt * Math.sin(gx * 0.05 + row);
      const underImg = useA ? imgB : imgA;
      const ir = underImg.naturalWidth / underImg.naturalHeight;
      const cr = w / h;
      const baseScale = ir > cr ? underImg.naturalHeight / h : underImg.naturalWidth / w;
      const scale = baseScale * zoomFactor;
      const offX = (underImg.naturalWidth - w * scale) / 2;
      const offY = (underImg.naturalHeight - h * scale) / 2;
      const usx = offX + (gx + warpX) * scale, usy = offY + (gy + warpY) * scale;

      // own jitter (different salt from the OVER pass) so the two layers don't
      // move in lockstep — that's what actually opens small, organic gaps
      const ujx = (seededRandom(row, col, 31) - 0.5) * 2 * imperfAmt;
      const ujy = (seededRandom(row, col, 32) - 0.5) * 2 * imperfAmt;
      const ujw = cw + (seededRandom(row, col, 33) - 0.5) * imperfAmt + underShrink;
      const ujh = ch + (seededRandom(row, col, 34) - 0.5) * imperfAmt + underShrink;
      const ufx = gx + ujx - underShrink / 2;
      const ufy = gy + ujy - underShrink / 2;

      ctx.save();
      octagonPath(ufx, ufy, ujw, ujh, cornerCut);
      ctx.clip();
      ctx.filter = useA ? filterB : filterA;
      ctx.drawImage(underImg, usx, usy, cw * scale, ch * scale, ufx, ufy, ujw, ujh);
      ctx.filter = 'none';
      ctx.restore();
    }
  }

  // ── PASS 2 (OVER layer): the crossing-winning photo. TIGHT tension grows a
  // real overlap onto the neighbor (the "folded over" edge); LOOSE no longer
  // shrinks this layer's own size — the visible gap at loose settings comes
  // entirely from the octagon corner-cut above, kept to one bounded mechanism
  // instead of several shrinks compounding into an oversized void.
  const baseOverlap = mesh * 0.12;
  for (let gy = 0; gy < h; gy += mesh) {
    for (let gx = 0; gx < w; gx += mesh) {
      const col = Math.floor(gx / mesh);
      const row = Math.floor(gy / mesh);
      if (ap != null && !shouldRevealCell(row, col, Math.ceil(h / mesh) - 1, Math.ceil(w / mesh) - 1, weaveP, 2)) continue;
      let baseUseA;
      // STRAND LENGTH groups multiple cells into one continuous-looking strand segment
      // (real basket weave doesn't alternate every single tiny square — see basket weave
      // grouping pairs of threads), instead of a fine 1×1 checkerboard reading as disconnected tiles.
      const gRow = Math.floor(row / strandLength);
      const gCol = Math.floor(col / strandLength);
      if (currentDirection === 'stripe') baseUseA = col % 2 === 0;
      else baseUseA = (gRow + gCol) % 2 === 0;

      let useA = baseUseA;
      if (density > 50 && !baseUseA) {
        if (seededRandom(gRow, gCol, 5) < (density - 50) / 50) useA = true;
      } else if (density < 50 && baseUseA) {
        if (seededRandom(gRow, gCol, 5) < (50 - density) / 50) useA = false;
      }

      const cw = Math.min(mesh, w - gx);
      const ch = Math.min(mesh, h - gy);

      const warpX = warpAmt * Math.sin(gy * 0.05 + col);
      const warpY = warpAmt * Math.sin(gx * 0.05 + row);

      // per-photo sample rect, independent of tension/imperfection sizing
      function sampleFor(img) {
        const ir = img.naturalWidth / img.naturalHeight;
        const cr = w / h;
        const baseScale = ir > cr ? img.naturalHeight / h : img.naturalWidth / w;
        const scale = baseScale * zoomFactor;
        const offX = (img.naturalWidth - w * scale) / 2;
        const offY = (img.naturalHeight - h * scale) / 2;
        return { sx: offX + (gx + warpX) * scale, sy: offY + (gy + warpY) * scale, sw: cw * scale, sh: ch * scale };
      }

      const srcImg = useA ? imgA : imgB;
      const fg = sampleFor(srcImg);
      const sx = fg.sx, sy = fg.sy, sw = fg.sw, sh = fg.sh;

      const jx = (seededRandom(row, col, 1) - 0.5) * 2 * imperfAmt;
      const jy = (seededRandom(row, col, 2) - 0.5) * 2 * imperfAmt;
      const jw = cw + (seededRandom(row, col, 3) - 0.5) * imperfAmt;
      const jh = ch + (seededRandom(row, col, 4) - 0.5) * imperfAmt;

      const overlapAdjust = baseOverlap + Math.max(0, tensionFactor) * mesh * 0.30;
      const fx = gx + jx - overlapAdjust / 2;
      const fy = gy + jy - overlapAdjust / 2;
      const fw = jw + overlapAdjust;
      const fh = jh + overlapAdjust;

      ctx.save();
      octagonPath(fx, fy, fw, fh, cornerCut);
      ctx.clip();
      ctx.filter = useA ? filterA : filterB;
      ctx.drawImage(srcImg, sx, sy, sw, sh, fx, fy, fw, fh);
      ctx.filter = 'none';
      ctx.restore();

      // draw the strand-segment's shadow/highlight only ONCE per group, from its
      // top-left anchor cell — not once per constituent cell — so the four edge
      // glows aren't stacked on top of each other inside the same group
      const isGroupAnchor = currentDirection === 'stripe'
        ? (row === 0)
        : (row % strandLength === 0 && col % strandLength === 0);
      if (depthAmt > 0 && isGroupAnchor) {
        let gx0, gy0, gw0, gh0;
        if (currentDirection === 'stripe') {
          gx0 = col * mesh; gy0 = 0; gw0 = mesh; gh0 = h;
        } else {
          gx0 = gCol * strandLength * mesh; gy0 = gRow * strandLength * mesh;
          gw0 = Math.min(strandLength * mesh, w - gx0);
          gh0 = Math.min(strandLength * mesh, h - gy0);
        }
        applyEdgeGlow(gx0, gy0, gw0, gh0, useA, visualDepthAmt, shadowReach, tensionDepthMul, lightVec);
      }
    }
  }

  if (ap == null || ap >= 0.96) applyGrain(grainAmt);
}

// Film-grain-style noise overlay — a per-pixel random luminance texture blended
// with 'overlay', giving the surface some tactile, non-digital grit instead of
// a flat, overly clean composite. Regenerated fresh each render (no caching)
// since GRAIN is usually adjusted interactively at low-to-moderate canvas sizes.
function applyGrain(amt) {
  if (amt <= 0.003) return;
  const w = outputCanvas.width, h = outputCanvas.height;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  const imgData = octx.createImageData(w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() * 255) | 0;
    data[i] = n; data[i + 1] = n; data[i + 2] = n; data[i + 3] = 255;
  }
  octx.putImageData(imgData, 0, 0);
  ctx.save();
  ctx.globalAlpha = Math.min(1, amt * 0.55);
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

// Simulates the raised/lowered relief of a woven strand catching light from one
// direction — like the reference macro photos, where ridges facing the light
// catch a bright edge and the opposite side falls into shadow, all in the SAME
// direction across the whole piece (not just "A is always lit, B always dark").
// lightVec is a unit vector pointing toward the light source; useA still adds a
// small over/under bias on top of that shared directional lighting.
function applyEdgeGlow(x, y, w, h, useA, depthAmt, shadowReach, tensionDepthMul, lightVec) {
  const peakBase = Math.max(0, Math.min(0.5, 0.27 * depthAmt * tensionDepthMul * (useA ? 1.15 : 0.9)));
  if (peakBase <= 0.002) return;
  const reach = Math.max(1, Math.min(w, h) * 0.5 * Math.max(0.04, shadowReach));

  function edgeGlow(nx, ny, gx0, gy0, gx1, gy1, rx, ry, rw, rh) {
    const lit = nx * lightVec.x + ny * lightVec.y; // -1..1, >0 = facing the light
    const alpha = peakBase * Math.abs(lit);
    if (alpha <= 0.002) return;
    const color = lit > 0 ? '255,248,232' : '0,0,0';
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }

  edgeGlow(0, -1, 0, y, 0, y + reach, x, y, w, reach);
  edgeGlow(0, 1, 0, y + h, 0, y + h - reach, x, y + h - reach, w, reach);
  edgeGlow(-1, 0, x, 0, x + reach, 0, x, y, reach, h);
  edgeGlow(1, 0, x + w, 0, x + w - reach, 0, x + w - reach, y, reach, h);
}

// Same idea as applyEdgeGlow but for an arbitrary quadrilateral (the rotated
// diamond groups in DIAGONAL mode) — walks each edge and lights/shadows it
// based on how directly its own outward normal faces the light source.
function applyPolygonEdgeGlow(corners, useA, depthAmt, shadowReach, tensionDepthMul, lightVec) {
  const peakBase = Math.max(0, Math.min(0.5, 0.27 * depthAmt * tensionDepthMul * (useA ? 1.15 : 0.9)));
  if (peakBase <= 0.002) return;
  const centroid = corners.reduce((a, c) => [a[0] + c[0] / corners.length, a[1] + c[1] / corners.length], [0, 0]);
  const edgeLen = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]);
  const reach = Math.max(1, edgeLen * 0.5 * Math.max(0.04, shadowReach));

  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = mx - centroid[0], ny = my - centroid[1]; // outward normal for this edge
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen; ny /= nlen;

    const lit = nx * lightVec.x + ny * lightVec.y;
    const alpha = peakBase * Math.abs(lit);
    if (alpha <= 0.002) continue;
    const color = lit > 0 ? '255,248,232' : '0,0,0';

    // inward-pointing strip for the shadow/highlight to fade across
    const ix = -nx, iy = -ny;
    const a2 = [a[0] + ix * reach, a[1] + iy * reach];
    const b2 = [b[0] + ix * reach, b[1] + iy * reach];

    const g = ctx.createLinearGradient(mx, my, mx + ix * reach, my + iy * reach);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(b2[0], b2[1]);
    ctx.lineTo(a2[0], a2[1]);
    ctx.closePath();
    ctx.fill();
  }
}

// DIAGONAL WEAVE: unlike stripe/basket (axis-aligned square cells with a diagonal
// boundary), this rotates the mesh grid itself by 45° so the bands genuinely cross
// like real diagonal basketry — each "cell" is a diamond in screen space, clipped
// and filled with the correctly-oriented (unrotated) photo content underneath.
function renderDiagonalWeave(p) {
  const { mesh, zoomFactor, strandLength, depthAmt, shadowReach, lightVec, warpAmt, imperfAmt, density, tensionFactor, tensionSizeAdjust, tensionDepthMul, filterA, filterB, animationProgress, weaveProgress } = p;
  const w = outputCanvas.width, h = outputCanvas.height;
  const cx = w / 2, cy = h / 2;
  const cosA = Math.SQRT1_2, sinA = Math.SQRT1_2; // 45°

  const diag = Math.sqrt(w * w + h * h);
  const range = Math.ceil(diag / 2 / mesh) + 2;

  // precompute cover-fit mapping (source <- canvas) once per photo, reused for every diamond's bounding box.
  // zoomFactor (tied to MESH SIZE) scales past the normal cover-fit baseline so a wider mesh reads as more zoomed-in.
  function coverMap(img) {
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = w / h;
    const baseScale = ir > cr ? img.naturalHeight / h : img.naturalWidth / w;
    const scale = baseScale * zoomFactor;
    const offX = (img.naturalWidth - w * scale) / 2;
    const offY = (img.naturalHeight - h * scale) / 2;
    return { scale, offX, offY };
  }
  const mapA = coverMap(imgA), mapB = coverMap(imgB);

  function boundsOf(corners) {
    const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
    const bx = Math.max(0, Math.min(w, Math.min(...xs)));
    const by = Math.max(0, Math.min(h, Math.min(...ys)));
    const bxMax = Math.max(0, Math.min(w, Math.max(...xs)));
    const byMax = Math.max(0, Math.min(h, Math.max(...ys)));
    return { bx, by, bw: bxMax - bx, bh: byMax - by };
  }

  // ── PASS 1 (UNDER layer): every diamond's crossing photo drawn first at its
  // full, un-shrunk footprint — guarantees the strand that's "under" at a given
  // crossing is always fully present, same rationale as the axis-aligned modes.
  for (let row = -range; row <= range; row++) {
    for (let col = -range; col <= range; col++) {
      const u0 = row * mesh, v0 = col * mesh;
      const gRow = Math.floor(row / strandLength);
      const gCol = Math.floor(col / strandLength);
      if (animationProgress != null && !shouldRevealCell(row + range, col + range, range * 2, range * 2, weaveProgress, 4)) continue;
      let baseUseA = (gRow + gCol) % 2 === 0;
      let useA = baseUseA;
      if (density > 50 && !baseUseA) { if (seededRandom(gRow, gCol, 5) < (density - 50) / 50) useA = true; }
      else if (density < 50 && baseUseA) { if (seededRandom(gRow, gCol, 5) < (50 - density) / 50) useA = false; }

      const cornersUV = [[u0, v0], [u0 + mesh, v0], [u0 + mesh, v0 + mesh], [u0, v0 + mesh]];
      const cornersXYBase = cornersUV.map(([u, v], i) => {
        const jx = (seededRandom(row, col, 10 + i) - 0.5) * 2 * imperfAmt;
        const jy = (seededRandom(row, col, 20 + i) - 0.5) * 2 * imperfAmt;
        return [u * cosA - v * sinA + cx + jx, u * sinA + v * cosA + cy + jy];
      });
      const centroid = cornersXYBase.reduce((a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4], [0, 0]);
      const baseB = boundsOf(cornersXYBase);
      if (baseB.bw <= 0 || baseB.bh <= 0) continue;

      const centerWarpX = warpAmt * Math.sin(centroid[1] * 0.05 + col);
      const centerWarpY = warpAmt * Math.sin(centroid[0] * 0.05 + row);
      const underMap = useA ? mapB : mapA;
      const ubg = {
        sx: underMap.offX + (baseB.bx + centerWarpX) * underMap.scale,
        sy: underMap.offY + (baseB.by + centerWarpY) * underMap.scale,
        sw: baseB.bw * underMap.scale, sh: baseB.bh * underMap.scale
      };
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cornersXYBase[0][0], cornersXYBase[0][1]);
      for (let i = 1; i < cornersXYBase.length; i++) ctx.lineTo(cornersXYBase[i][0], cornersXYBase[i][1]);
      ctx.closePath();
      ctx.clip();
      ctx.filter = useA ? filterB : filterA;
      ctx.drawImage(useA ? imgB : imgA, ubg.sx, ubg.sy, ubg.sw, ubg.sh, baseB.bx, baseB.by, baseB.bw, baseB.bh);
      ctx.filter = 'none';
      ctx.restore();
    }
  }

  // ── PASS 2 (OVER layer): the crossing-winning photo, its diamond scaled up
  // from a constant baseline (a real fold-over edge even at neutral tension) —
  // TIGHT grows the overlap further, LOOSE shrinks it back toward (never past)
  // the base diamond, always revealing the always-present under layer beneath.
  for (let row = -range; row <= range; row++) {
    for (let col = -range; col <= range; col++) {
      const u0 = row * mesh, v0 = col * mesh;
      // STRAND LENGTH groups neighboring diamonds into the same continuous segment,
      // same rationale as basket/stripe below
      const gRow = Math.floor(row / strandLength);
      const gCol = Math.floor(col / strandLength);
      if (animationProgress != null && !shouldRevealCell(row + range, col + range, range * 2, range * 2, weaveProgress, 5)) continue;
      let baseUseA = (gRow + gCol) % 2 === 0;
      let useA = baseUseA;
      if (density > 50 && !baseUseA) {
        if (seededRandom(gRow, gCol, 5) < (density - 50) / 50) useA = true;
      } else if (density < 50 && baseUseA) {
        if (seededRandom(gRow, gCol, 5) < (50 - density) / 50) useA = false;
      }

      // diamond corners: rotated-grid square -> screen space, with IMPERFECTION
      // jittering each corner individually (uneven hand-woven edges) and TENSION
      // scaling the whole diamond from its centroid (tight = overlapping/sealed, loose = gaps)
      const cornersUV = [[u0, v0], [u0 + mesh, v0], [u0 + mesh, v0 + mesh], [u0, v0 + mesh]];
      const cornersXYBase = cornersUV.map(([u, v], i) => {
        const jx = (seededRandom(row, col, 10 + i) - 0.5) * 2 * imperfAmt;
        const jy = (seededRandom(row, col, 20 + i) - 0.5) * 2 * imperfAmt;
        return [u * cosA - v * sinA + cx + jx, u * sinA + v * cosA + cy + jy];
      });
      const centroid = cornersXYBase.reduce((a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4], [0, 0]);
      const tensionScale = 1.16 + tensionFactor * 0.22; // 1.16 baseline overlap at neutral tension
      const cornersXY = cornersXYBase.map(([x, y]) => [
        centroid[0] + (x - centroid[0]) * tensionScale,
        centroid[1] + (y - centroid[1]) * tensionScale
      ]);

      const baseB = boundsOf(cornersXYBase);
      if (baseB.bw <= 0 || baseB.bh <= 0) continue; // diamond entirely off-canvas, skip

      const centerWarpX = warpAmt * Math.sin(centroid[1] * 0.05 + col);
      const centerWarpY = warpAmt * Math.sin(centroid[0] * 0.05 + row);

      function sampleFor(map, bx, by, bw, bh) {
        return {
          sx: map.offX + (bx + centerWarpX) * map.scale,
          sy: map.offY + (by + centerWarpY) * map.scale,
          sw: bw * map.scale, sh: bh * map.scale
        };
      }

      const fgBounds = boundsOf(cornersXY);
      const { bx, by, bw, bh } = fgBounds;
      if (bw <= 0 || bh <= 0) continue;

      const map = useA ? mapA : mapB;
      const fg = sampleFor(map, bx, by, bw, bh);
      const sx = fg.sx, sy = fg.sy, sw = fg.sw, sh = fg.sh;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cornersXY[0][0], cornersXY[0][1]);
      for (let i = 1; i < cornersXY.length; i++) ctx.lineTo(cornersXY[i][0], cornersXY[i][1]);
      ctx.closePath();
      ctx.clip();
      ctx.filter = useA ? filterA : filterB;
      ctx.drawImage(useA ? imgA : imgB, sx, sy, sw, sh, bx, by, bw, bh);
      ctx.filter = 'none';
      ctx.restore();

      // group-level shadow: drawn once per group (from its anchor diamond), clipped
      // to the BIG group diamond's own path (not the small per-cell one) so the glow
      // hugs the group's true outer edge instead of stacking a blob on every sub-cell
      const isGroupAnchor = row % strandLength === 0 && col % strandLength === 0;
      if (depthAmt > 0 && isGroupAnchor) {
        const gu0 = row * mesh, gv0 = col * mesh;
        const gSize = strandLength * mesh;
        const groupCornersUV = [[gu0, gv0], [gu0 + gSize, gv0], [gu0 + gSize, gv0 + gSize], [gu0, gv0 + gSize]];
        let groupCorners = groupCornersUV.map(([u, v]) => [u * cosA - v * sinA + cx, u * sinA + v * cosA + cy]);
        const gCentroid = groupCorners.reduce((a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4], [0, 0]);
        groupCorners = groupCorners.map(([x, y]) => [
          gCentroid[0] + (x - gCentroid[0]) * tensionScale,
          gCentroid[1] + (y - gCentroid[1]) * tensionScale
        ]);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(groupCorners[0][0], groupCorners[0][1]);
        for (let i = 1; i < groupCorners.length; i++) ctx.lineTo(groupCorners[i][0], groupCorners[i][1]);
        ctx.closePath();
        ctx.clip();
        applyPolygonEdgeGlow(groupCorners, useA, depthAmt, shadowReach, tensionDepthMul, lightVec);
        ctx.restore();
      }
    }
  }
}

[meshSlider, strandLengthSlider, warpSlider, imperfectionSlider, densitySlider, tensionSlider, depthAmtSlider, shadowReachSlider, lightDirectionSlider, grainSlider, lightIntensitySlider,
 exposureASlider, brillianceASlider, exposureBSlider, brillianceBSlider].forEach(el => {
  el.addEventListener('input', () => {
    if (animationPlaying) stopAnimation();
    meshVal.textContent = meshSlider.value;
    strandLengthVal.textContent = strandLengthSlider.value;
    warpVal.textContent = warpSlider.value + '%';
    imperfectionVal.textContent = imperfectionSlider.value + '%';
    densityVal.textContent = densitySlider.value + '%';
    tensionVal.textContent = tensionSlider.value + '%';
    depthAmtVal.textContent = depthAmtSlider.value + '%';
    shadowReachVal.textContent = shadowReachSlider.value + '%';
    lightDirectionVal.textContent = lightDirectionSlider.value + '°';
    grainVal.textContent = grainSlider.value + '%';
    lightIntensityVal.textContent = lightIntensitySlider.value + '%';
    exposureAVal.textContent = exposureASlider.value;
    brillianceAVal.textContent = brillianceASlider.value;
    exposureBVal.textContent = exposureBSlider.value;
    brillianceBVal.textContent = brillianceBSlider.value;
    render();
  });
});
backlightToggle.addEventListener('change', render);

resetBtn.addEventListener('click', () => {
  if (animationPlaying) stopAnimation();
  meshSlider.value = 40; strandLengthSlider.value = 1; depthAmtSlider.value = 60; shadowReachSlider.value = 75; warpSlider.value = 0;
  lightDirectionSlider.value = 45; grainSlider.value = 0;
  imperfectionSlider.value = 15; densitySlider.value = 50; tensionSlider.value = 50;
  backlightToggle.checked = false; lightIntensitySlider.value = 50;
  zoomWithMeshToggle.checked = false;
  exposureASlider.value = 0; brillianceASlider.value = 0;
  exposureBSlider.value = 0; brillianceBSlider.value = 0;
  directionBtns.forEach(b => b.classList.remove('active'));
  document.querySelector('[data-direction="basket"]').classList.add('active');
  currentDirection = 'basket';
  [meshSlider, strandLengthSlider, warpSlider, imperfectionSlider, densitySlider, tensionSlider, depthAmtSlider, shadowReachSlider, lightDirectionSlider, grainSlider, lightIntensitySlider,
   exposureASlider, brillianceASlider, exposureBSlider, brillianceBSlider]
    .forEach(el => el.dispatchEvent(new Event('input')));
  render();
});

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

downloadBtn.addEventListener('click', () => {
  if (!hasA || !hasB) return;
  const dataUrl = outputCanvas.toDataURL('image/png');
  if (isIOS()) {
    document.getElementById('saveOverlayImg').src = dataUrl;
    document.getElementById('saveOverlay').style.display = 'flex';
  } else {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'woven-grain.png';
    a.click();
  }
});
document.getElementById('saveOverlayClose').addEventListener('click', () => {
  document.getElementById('saveOverlay').style.display = 'none';
});

// keeps the A/B previews correctly sized after an orientation change or window
// resize, since updatePreviews() now only resizes them when the size differs
let resizeDebounce;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(render, 150);
});

updateAnimationUI();
render();
