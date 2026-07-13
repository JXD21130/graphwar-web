// ==================== Graphwar Web - motor del juego ====================
// Reescrito en JavaScript reutilizando los graficos originales de Graphwar
// (GPLv3, https://github.com/catabriga/graphwar)

// ---------- Constantes (tomadas del Graphwar original) ----------
const PLANE_LENGTH = 770;
const PLANE_HEIGHT = 450;
const PLANE_GAME_LENGTH = 50;
const PLANE_X = 15;      // offset del plano dentro del canvas
const PLANE_Y = 40;
const SOLDIER_SIZE = 20;
const SOLDIER_HALF = 10;
const EXPLOSION_RADIUS = 16;
const SOLDIER_HIT_RADIUS = 11;
const STEP_PX = 5;        // avance en pixeles por frame de animacion
const TEAM_COLORS = ['#e63946', '#457b9d', '#f4a300', '#2a9d8f', '#8e44ad', '#e07a5f'];

function convertX(xGame) { return (PLANE_LENGTH * xGame) / PLANE_GAME_LENGTH + PLANE_LENGTH / 2; }
function convertY(yGame) { return -(PLANE_LENGTH * yGame) / PLANE_GAME_LENGTH + PLANE_HEIGHT / 2; }
function invConvertX(xPix) { return ((xPix - PLANE_LENGTH / 2) * PLANE_GAME_LENGTH) / PLANE_LENGTH; }
function invConvertY(yPix) { return ((PLANE_HEIGHT / 2 - yPix) * PLANE_GAME_LENGTH) / PLANE_LENGTH; }

// ---------- Parser de funciones matematicas ----------
function parseFunction(exprStr) {
  const s = exprStr.replace(/\s+/g, '').toLowerCase();
  if (s.length === 0) throw new Error('Funcion vacia');
  let pos = 0;
  function peek() { return s[pos]; }
  function eat(ch) { if (s[pos] !== ch) throw new Error(`Se esperaba '${ch}'`); pos++; }

  function parseExpr() {
    let node = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = peek(); pos++;
      const rhs = parseTerm();
      const a = node, b = rhs;
      node = { eval: (x) => (op === '+' ? a.eval(x) + b.eval(x) : a.eval(x) - b.eval(x)) };
    }
    return node;
  }
  function parseTerm() {
    let node = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const op = peek(); pos++;
      const rhs = parseUnary();
      const a = node, b = rhs;
      node = { eval: (x) => (op === '*' ? a.eval(x) * b.eval(x) : a.eval(x) / b.eval(x)) };
    }
    return node;
  }
  function parseUnary() {
    if (peek() === '-') { pos++; const n = parseUnary(); return { eval: (x) => -n.eval(x) }; }
    if (peek() === '+') { pos++; return parseUnary(); }
    return parsePow();
  }
  function parsePow() {
    let node = parseAtom();
    if (peek() === '^') {
      pos++;
      const rhs = parseUnary();
      const a = node, b = rhs;
      node = { eval: (x) => Math.pow(a.eval(x), b.eval(x)) };
    }
    return node;
  }
  const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
    ln: Math.log, log: Math.log10,
  };
  function parseAtom() {
    if (peek() === '(') { pos++; const n = parseExpr(); eat(')'); return n; }
    if (/[a-z]/.test(peek())) {
      let start = pos;
      while (pos < s.length && /[a-z]/.test(s[pos])) pos++;
      const name = s.slice(start, pos);
      if (name === 'x') return { eval: (x) => x };
      if (name === 'pi') return { eval: () => Math.PI };
      if (name === 'e') return { eval: () => Math.E };
      if (FUNCS[name]) {
        eat('(');
        const arg = parseExpr();
        eat(')');
        const fn = FUNCS[name];
        return { eval: (x) => fn(arg.eval(x)) };
      }
      throw new Error(`No se reconoce '${name}'`);
    }
    if (/[0-9.]/.test(peek())) {
      let start = pos;
      while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
      return { eval: () => parseFloat(s.slice(start, pos)) };
    }
    throw new Error(`Caracter inesperado '${peek()}'`);
  }
  const tree = parseExpr();
  if (pos !== s.length) throw new Error(`Sobra texto: '${s.slice(pos)}'`);
  return (x) => tree.eval(x);
}

// ---------- Carga de imagenes ----------
const IMAGES = {};
function loadImage(name, path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { IMAGES[name] = img; resolve(); };
    img.onerror = () => resolve();
    img.src = path;
  });
}

async function loadAllImages() {
  const list = [
    ['soldier1', 'rsc/soldiers/soldier1.png'],
    ['soldier2', 'rsc/soldiers/soldier2.png'],
    ['soldier3', 'rsc/soldiers/soldier3.png'],
    ['soldier4', 'rsc/soldiers/soldier4.png'],
    ['soldierNormal', 'rsc/soldiers/soldierNormal.png'],
    ['helmet', 'rsc/soldiers/helmet.png'],
    ['helmetMask', 'rsc/soldiers/helmetMask.png'],
    ['explosion0', 'rsc/explosions/explosion0.png'],
    ['explosion1', 'rsc/explosions/explosion1.png'],
    ['explosion2', 'rsc/explosions/explosion2.png'],
    ['explosion3', 'rsc/explosions/explosion3.png'],
    ['explosion4', 'rsc/explosions/explosion4.png'],
    ['explosion5', 'rsc/explosions/explosion5.png'],
    ['soldierExplosion1', 'rsc/soldiers/soldierExplosion1Small.png'],
    ['soldierExplosion2', 'rsc/soldiers/soldierExplosion2Small.png'],
    ['soldierExplosion3', 'rsc/soldiers/soldierExplosion3Small.png'],
    ['createGame', 'rsc/createGame.png'],
    ['joinGame', 'rsc/joinGame.png'],
    ['fire', 'rsc/fire.png'],
    ['fireOverRed', 'rsc/fireOverRed.png'],
    ['back', 'rsc/back.png'],
    ['ok', 'rsc/ok.png'],
    ['add', 'rsc/add.png'],
    ['addComputerPlayer', 'rsc/addComputerPlayer.png'],
    ['addLocalPlayer', 'rsc/addLocalPlayer.png'],
    ['arrowLeftBlack', 'rsc/arrowLeftBlack.png'],
  ];
  await Promise.all(list.map(([name, path]) => loadImage(name, path)));
}

// ---------- Recolorear un sprite (para distinguir jugadores por color de casco) ----------
function tintedHelmet(color) {
  const c = document.createElement('canvas');
  c.width = SOLDIER_SIZE; c.height = SOLDIER_SIZE;
  const g = c.getContext('2d');
  if (IMAGES.helmetMask) {
    g.drawImage(IMAGES.helmetMask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, SOLDIER_SIZE, SOLDIER_SIZE);
    g.globalCompositeOperation = 'source-over';
  }
  if (IMAGES.helmet) g.drawImage(IMAGES.helmet, 0, 0);
  return c;
}

// ---------- Terreno ----------
function generateTerrain() {
  const terrain = new Float64Array(PLANE_LENGTH);
  const base = 300;
  const bumps = [];
  const numBumps = 10 + Math.floor(Math.random() * 8);
  for (let i = 0; i < numBumps; i++) {
    bumps.push({
      amp: (Math.random() * 2 - 0.7) * 90,
      center: Math.random() * PLANE_LENGTH,
      width: 40 + Math.random() * 90,
    });
  }
  for (let px = 0; px < PLANE_LENGTH; px++) {
    let h = base;
    for (const b of bumps) {
      h -= b.amp * Math.exp(-((px - b.center) ** 2) / (2 * b.width * b.width));
    }
    terrain[px] = Math.max(70, Math.min(420, h));
  }
  return terrain;
}

function digCrater(terrain, hitX, hitY, radius) {
  const r2 = radius * radius;
  const startPx = Math.max(0, Math.floor(hitX - radius));
  const endPx = Math.min(PLANE_LENGTH - 1, Math.ceil(hitX + radius));
  for (let px = startPx; px <= endPx; px++) {
    const dx = px - hitX;
    const inside = r2 - dx * dx;
    if (inside >= 0) {
      const bottom = hitY + Math.sqrt(inside);
      if (bottom > terrain[px]) terrain[px] = Math.min(440, bottom);
    }
  }
}

// ---------- Estado del juego ----------
class Soldier {
  constructor(x, teamIndex, playerIndex, spriteKey, colorHelmet) {
    this.x = x;
    this.y = 0;
    this.alive = true;
    this.teamIndex = teamIndex;
    this.playerIndex = playerIndex;
    this.spriteKey = spriteKey;
    this.colorHelmet = colorHelmet;
    this.exploding = false;
    this.explodeFrame = 0;
  }
}

class GraphwarGame {
  constructor(canvas, players) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.players = players; // [{name, isBot, teamIndex}]
    this.terrain = generateTerrain();
    this.soldiers = [];
    this.turnOrder = [];
    this.turnIndex = 0;
    this.state = 'playing'; // playing | exploding | gameover
    this.trajectory = [];
    this.trajectoryStep = 0;
    this.explosion = null;
    this.message = '';
    this.direction = 1;
    this.winner = null;
    this.helmetCache = {};

    this.setupSoldiers();
    this.buildTurnOrder();
  }

  helmetImg(color) {
    if (!this.helmetCache[color]) this.helmetCache[color] = tintedHelmet(color);
    return this.helmetCache[color];
  }

  setupSoldiers() {
    const n = this.players.length;
    const margin = 70;
    const spacing = n > 1 ? (PLANE_LENGTH - margin * 2) / (n - 1) : 0;
    this.players.forEach((p, i) => {
      let x;
      if (n === 1) x = PLANE_LENGTH / 2;
      else x = margin + i * spacing;
      x += (Math.random() * 20 - 10);
      x = Math.max(30, Math.min(PLANE_LENGTH - 30, x));
      const color = TEAM_COLORS[i % TEAM_COLORS.length];
      const s = new Soldier(x, i, i, 'soldierNormal', color);
      s.y = this.terrain[Math.round(x)] - SOLDIER_HALF;
      this.soldiers.push(s);
    });
  }

  buildTurnOrder() {
    this.turnOrder = this.soldiers.map((s, idx) => idx);
  }

  aliveSoldiers() {
    return this.soldiers.filter((s) => s.alive);
  }

  currentSoldier() {
    return this.soldiers[this.turnOrder[this.turnIndex % this.turnOrder.length]];
  }

  nextTurn() {
    const totalTeamsAlive = new Set(this.aliveSoldiers().map((s) => s.teamIndex));
    if (totalTeamsAlive.size <= 1) {
      this.state = 'gameover';
      this.winner = totalTeamsAlive.size === 1 ? [...totalTeamsAlive][0] : null;
      return;
    }
    let tries = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
      tries++;
    } while (!this.soldiers[this.turnOrder[this.turnIndex]].alive && tries <= this.turnOrder.length);
    this.state = 'playing';
  }

  snapSoldiersToTerrain() {
    for (const s of this.soldiers) {
      if (s.alive) {
        const px = Math.max(0, Math.min(PLANE_LENGTH - 1, Math.round(s.x)));
        s.y = this.terrain[px] - SOLDIER_HALF;
      }
    }
  }

  fire(exprStr, direction) {
    if (this.state !== 'playing') return { ok: false, error: 'No es tu turno' };
    let f;
    try {
      f = parseFunction(exprStr);
    } catch (e) {
      return { ok: false, error: 'Funcion invalida: ' + e.message };
    }
    const shooter = this.currentSoldier();
    const x0Game = invConvertX(shooter.x);
    const y0Game = invConvertY(shooter.y);
    let f0;
    try {
      f0 = f(x0Game);
    } catch (e) {
      return { ok: false, error: 'Funcion invalida' };
    }
    if (!isFinite(f0)) return { ok: false, error: 'Funcion invalida en tu posicion' };
    const offset = y0Game - f0;

    const dirSign = direction;
    const traj = [];
    let xGame = x0Game;
    const dxGame = (STEP_PX * PLANE_GAME_LENGTH) / PLANE_LENGTH;
    let hit = null;
    for (let step = 0; step < 4000; step++) {
      xGame += dirSign * dxGame;
      const xPix = convertX(xGame);
      if (xPix < 0 || xPix > PLANE_LENGTH - 1) break;
      let yGame;
      try { yGame = f(xGame) + offset; } catch (e) { break; }
      if (!isFinite(yGame)) break;
      const yPix = convertY(yGame);
      traj.push({ x: xPix, y: yPix });

      if (yPix < -50 || yPix > PLANE_HEIGHT + 50) { hit = null; break; }

      const terrainPx = Math.max(0, Math.min(PLANE_LENGTH - 1, Math.round(xPix)));
      if (yPix >= this.terrain[terrainPx]) {
        hit = { x: xPix, y: this.terrain[terrainPx] };
        break;
      }
      for (const s of this.soldiers) {
        if (!s.alive) continue;
        const dx = s.x - xPix, dy = s.y - yPix;
        if (Math.sqrt(dx * dx + dy * dy) < SOLDIER_HIT_RADIUS) {
          hit = { x: xPix, y: yPix };
          break;
        }
      }
      if (hit) break;
    }

    this.trajectory = traj;
    this.trajectoryStep = 0;
    this.pendingHit = hit;
    this.state = 'animating';
    return { ok: true };
  }

  applyHit(hit) {
    if (!hit) return;
    digCrater(this.terrain, hit.x, hit.y, EXPLOSION_RADIUS);
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const dx = s.x - hit.x, dy = s.y - hit.y;
      if (Math.sqrt(dx * dx + dy * dy) < EXPLOSION_RADIUS + 6) {
        s.alive = false;
        s.exploding = true;
        s.explodeFrame = 0;
      }
    }
    this.snapSoldiersToTerrain();
    this.explosion = { x: hit.x, y: hit.y, frame: 0 };
  }

  update() {
    if (this.state === 'animating') {
      this.trajectoryStep += 1;
      if (this.trajectoryStep >= this.trajectory.length) {
        this.applyHit(this.pendingHit);
        this.state = 'exploding';
        this.explosionTimer = 0;
      }
    } else if (this.state === 'exploding') {
      this.explosionTimer = (this.explosionTimer || 0) + 1;
      if (this.explosionTimer > 40) {
        this.explosion = null;
        this.nextTurn();
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(PLANE_X, PLANE_Y);

    // fondo
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, PLANE_LENGTH, PLANE_HEIGHT);

    // terreno
    ctx.beginPath();
    ctx.moveTo(0, PLANE_HEIGHT);
    for (let px = 0; px < PLANE_LENGTH; px++) ctx.lineTo(px, this.terrain[px]);
    ctx.lineTo(PLANE_LENGTH, PLANE_HEIGHT);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, PLANE_HEIGHT);
    grad.addColorStop(0, '#8bc34a');
    grad.addColorStop(0.15, '#795548');
    grad.addColorStop(1, '#4e342e');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, PLANE_HEIGHT / 2);
    ctx.lineTo(PLANE_LENGTH, PLANE_HEIGHT / 2);
    ctx.moveTo(PLANE_LENGTH / 2, 0);
    ctx.lineTo(PLANE_LENGTH / 2, PLANE_HEIGHT);
    ctx.stroke();

    // soldados
    for (const s of this.soldiers) {
      if (!s.alive && !s.exploding) continue;
      if (s.exploding) {
        const frames = ['soldierExplosion1', 'soldierExplosion2', 'soldierExplosion3'];
        const img = IMAGES[frames[Math.min(frames.length - 1, Math.floor(s.explodeFrame / 8))]];
        s.explodeFrame++;
        if (img) ctx.drawImage(img, s.x - SOLDIER_HALF, s.y - SOLDIER_HALF, SOLDIER_SIZE, SOLDIER_SIZE);
        if (s.explodeFrame > 24) s.exploding = false;
        continue;
      }
      const helm = this.helmetImg(s.colorHelmet);
      const base = IMAGES.soldierNormal;
      if (base) ctx.drawImage(base, s.x - SOLDIER_HALF, s.y - SOLDIER_HALF, SOLDIER_SIZE, SOLDIER_SIZE);
      if (helm) ctx.drawImage(helm, s.x - SOLDIER_HALF, s.y - SOLDIER_HALF, SOLDIER_SIZE, SOLDIER_SIZE);

      // marcador turno actual
      if (this.soldiers[this.turnOrder[this.turnIndex]] === s && this.state === 'playing') {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(s.x - 6, s.y - SOLDIER_HALF - 4);
        ctx.lineTo(s.x + 6, s.y - SOLDIER_HALF - 4);
        ctx.lineTo(s.x, s.y - SOLDIER_HALF + 6);
        ctx.closePath();
        ctx.fill();
      }
      // nombre jugador
      const player = this.players[s.playerIndex];
      if (player) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        const label = player.name;
        const w = ctx.measureText(label).width;
        ctx.strokeText(label, s.x - w / 2, s.y - SOLDIER_HALF - 8);
        ctx.fillText(label, s.x - w / 2, s.y - SOLDIER_HALF - 8);
      }
    }

    // trayectoria
    if ((this.state === 'animating' || this.state === 'exploding') && this.trajectory.length) {
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const upto = Math.min(this.trajectoryStep, this.trajectory.length);
      for (let i = 0; i < upto; i++) {
        const p = this.trajectory[i];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // explosion
    if (this.explosion) {
      const frames = ['explosion0', 'explosion1', 'explosion2', 'explosion3', 'explosion4', 'explosion5'];
      const idx = Math.min(frames.length - 1, Math.floor((this.explosionTimer || 0) / 6));
      const img = IMAGES[frames[idx]];
      if (img) ctx.drawImage(img, this.explosion.x - 20, this.explosion.y - 20, 40, 40);
    }

    ctx.restore();
  }
}

// exponer para uso desde index.html
window.GraphwarGame = GraphwarGame;
window.loadAllImages = loadAllImages;
window.parseFunction = parseFunction;
window.PLANE_LENGTH = PLANE_LENGTH;
window.PLANE_HEIGHT = PLANE_HEIGHT;
window.invConvertX = invConvertX;
window.invConvertY = invConvertY;
