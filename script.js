const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

// --- CONFIGURAÇÕES ---
const CONFIG = {
  maxHp: 150,
  radius: 30,
  boxSize: 25,
  maxPlayers: 4,
  spawnRate: 1500, // Surge uma caixa a cada 1,5 segundos
  maxSpeed: 2.8, // Limite de velocidade para evitar erros
  maxVelocity: 650 // Limite de módulo do vetor de velocidade (px/s)
};

let fighters = [];
let powerBoxes = [];
let running = false;
let lastTime = 0;
let boxTimer = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Cores para os jogadores adicionais
const playerColors = ["#ff6b6b", "#4ecdc4", "#7bd389", "#f7b32b"];

// Ajustar tamanho do canvas
function resize() {
  const size = canvas.parentElement.clientWidth;
  canvas.width = size;
  canvas.height = size;
}
window.onresize = resize;
resize();

// --- LÓGICA DE JOGADORES ---
document.getElementById("addPlayerBtn").onclick = () => {
  const container = document.getElementById("playerInputs");
  const current = container.querySelectorAll("input").length;
  if (current < CONFIG.maxPlayers) {
    const label = document.createElement("label");
    label.innerHTML = `P${current+1} <input class="player-name" type="text" value="Player ${current+1}" />`;
    container.appendChild(label);
  } else {
    alert("Máximo de 4 jogadores!");
  }
};

function initGame() {
  const names = document.querySelectorAll(".player-name");
  fighters = [];
  const hudLeft = document.getElementById("hud-left");
  const hudRight = document.getElementById("hud-right");
  hudLeft.innerHTML = ""; hudRight.innerHTML = "";

  names.forEach((input, i) => {
    const f = {
      id: i,
      name: input.value,
      color: playerColors[i],
      x: i % 2 === 0 ? canvas.width * 0.2 : canvas.width * 0.8,
      y: i < 2 ? canvas.height * 0.2 : canvas.height * 0.8,
      vx: (Math.random() - 0.5) * 400,
      vy: (Math.random() - 0.5) * 400,
      hp: CONFIG.maxHp,
      totalHp: CONFIG.maxHp,
      atk: 10,
      def: 2,
      speed: 1.2,
      radius: CONFIG.radius
    };
    fighters.push(f);
    
    const card = `
      <div class="fighter-card" id="card-${i}">
        <div class="name" style="color:${f.color}">${f.name}</div>
        <div class="bar"><div id="hp-${i}" class="fill"></div></div>
        <div class="stats-text">
          <span>ATK: <b id="atk-${i}">${f.atk}</b></span>
          <span>DEF: <b id="def-${i}">${f.def}</b></span>
        </div>
      </div>`;
    if (i % 2 === 0) hudLeft.innerHTML += card;
    else hudRight.innerHTML += card;
  });
}

// --- SISTEMA DE CAIXAS ---
function spawnBox() {
  const types = [
    { type: 'atk', color: '#ff6b6b' }, 
    { type: 'speed', color: '#4ecdc4' }, 
    { type: 'life', color: '#7bd389' }, 
    { type: 'def', color: '#f7b32b' }
  ];
  const t = types[Math.floor(Math.random() * types.length)];
  
  // Garante que a caixa nasce dentro da arena circular
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * (canvas.width/2 - 60);
  
  powerBoxes.push({
    x: canvas.width/2 + Math.cos(angle) * dist,
    y: canvas.height/2 + Math.sin(angle) * dist,
    ...t
  });
}

// --- FÍSICA E ATUALIZAÇÃO ---
function update(dt) {
  if (!running) return;

  // Gerador de caixas
  boxTimer += dt * 1000;
  if (boxTimer > CONFIG.spawnRate) {
    spawnBox();
    boxTimer = 0;
  }

  fighters.forEach(f => {
    if (f.hp <= 0) return;

    // Limites de velocidade para evitar explosões numéricas
    f.speed = clamp(f.speed, 0.2, CONFIG.maxSpeed);
    const vMag = Math.hypot(f.vx, f.vy);
    if (vMag > CONFIG.maxVelocity) {
      const scale = CONFIG.maxVelocity / vMag;
      f.vx *= scale;
      f.vy *= scale;
    }

    // Movimento com base na velocidade do atributo
    f.x += f.vx * dt * f.speed;
    f.y += f.vy * dt * f.speed;

    // IA Suave: Atração leve entre bolinhas para garantir que se encontrem
    const target = fighters.find(other => other !== f && other.hp > 0);
    if (target) {
        f.vx += (target.x - f.x) * 0.05 * dt;
        f.vy += (target.y - f.y) * 0.05 * dt;
    }

    // Ricochete na Arena Circular
    const cx = canvas.width/2, cy = canvas.height/2;
    const distCenter = Math.hypot(f.x - cx, f.y - cy);
    const arenaR = cx - f.radius;

    if (distCenter > arenaR) {
      const angle = Math.atan2(f.y - cy, f.x - cx);
      f.x = cx + Math.cos(angle) * arenaR;
      f.y = cy + Math.sin(angle) * arenaR;
      
      // Refletir o vetor de velocidade (ricochete real)
      const nx = Math.cos(angle), ny = Math.sin(angle);
      const dot = f.vx * nx + f.vy * ny;
      f.vx = (f.vx - 2 * dot * nx) * 1.02; // Ganha 2% de força ao bater
      f.vy = (f.vy - 2 * dot * ny) * 1.02;
    }

    // Apanhar Caixas
    powerBoxes.forEach((box, index) => {
      if (Math.hypot(f.x - box.x, f.y - box.y) < f.radius + 15) {
        if (box.type === 'atk') f.atk += 4;
        if (box.type === 'def') f.def += 1;
        if (box.type === 'speed') f.speed = clamp(f.speed + 0.15, 0.2, CONFIG.maxSpeed);
        if (box.type === 'life') {
          f.totalHp += 20;
          f.hp = Math.min(f.totalHp, f.hp + 40);
        }
        powerBoxes.splice(index, 1);
      }
    });
  });

  // Colisão entre Jogadores
  for (let i = 0; i < fighters.length; i++) {
    for (let j = i + 1; j < fighters.length; j++) {
      const a = fighters[i], b = fighters[j];
      if (a.hp <= 0 || b.hp <= 0) continue;

      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist < a.radius + b.radius) {
        // Troca de momento
        [a.vx, b.vx] = [b.vx * 1.3, a.vx * 1.3];
        [a.vy, b.vy] = [b.vy * 1.3, a.vy * 1.3];
        
        // Dano = Ataque do outro - Defesa própria
        a.hp -= Math.max(3, b.atk - a.def);
        b.hp -= Math.max(3, a.atk - b.def);
      }
    }
  }
}

// --- DESENHO ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Caixas de Power-up
  powerBoxes.forEach(box => {
    ctx.fillStyle = box.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = box.color;
    ctx.fillRect(box.x - 12, box.y - 12, 24, 24);
    ctx.shadowBlur = 0;
  });

  // Lutadores
  fighters.forEach(f => {
    if (f.hp <= 0) return;
    
    // Rastro simples
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI*2);
    const grad = ctx.createRadialGradient(f.x-5, f.y-5, 2, f.x, f.y, f.radius);
    grad.addColorStop(0, "white");
    grad.addColorStop(1, f.color);
    ctx.fillStyle = grad;
    ctx.fill();
    
    ctx.fillStyle = "#2a241e";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(f.name, f.x, f.y - f.radius - 8);
  });

  updateHUD();
}

function updateHUD() {
  fighters.forEach(f => {
    const bar = document.getElementById(`hp-${f.id}`);
    if (bar) {
      bar.style.width = `${Math.max(0, (f.hp / f.totalHp) * 100)}%`;
      document.getElementById(`atk-${f.id}`).textContent = f.atk;
      document.getElementById(`def-${f.id}`).textContent = f.def;
      if (f.hp <= 0) document.getElementById(`card-${f.id}`).style.opacity = "0.3";
    }
  });
}

function showBanner(text) {
  const b = document.getElementById("banner");
  b.textContent = text; b.classList.add("show");
  setTimeout(() => b.classList.remove("show"), 2500);
}

function loop(t) {
  const dt = Math.min(0.1, (t - lastTime) / 1000);
  lastTime = t;
  update(dt);
  draw();
  
  const alive = fighters.filter(f => f.hp > 0);
  if (running && alive.length > 1) {
    requestAnimationFrame(loop);
  } else if (running) {
    showBanner(alive.length === 1 ? `VITÓRIA DE ${alive[0].name}!` : "EMPATE!");
    running = false;
  }
}

document.getElementById("startBtn").onclick = () => {
  initGame();
  powerBoxes = [];
  running = true;
  lastTime = performance.now();
  showBanner("LUTEM!");
  requestAnimationFrame(loop);
};

document.getElementById("resetBtn").onclick = () => location.reload();
