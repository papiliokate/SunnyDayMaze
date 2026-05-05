import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";

let analytics;
try {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: "G-BJLK9339LN"
  };
  const app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
} catch(e) {}

const urlParams = new URLSearchParams(window.location.search);
const isCarousel = urlParams.get('carousel') === 'true';
const isEmbed = urlParams.get('mode') === 'embed';
const isWaitingRoom = urlParams.get('mode') === 'waiting-room';
const isCaptcha = urlParams.get('mode') === 'captcha';
const clientId = urlParams.get('clientId') || 'unknown';
const autoplayMode = urlParams.get('autoplay');
let playedGames = urlParams.get('played') ? urlParams.get('played').split(',').filter(Boolean) : [];
const CURRENT_GAME_ID = 'JM';

let publisherDomain = 'unknown';
if (document.referrer) {
    try {
        publisherDomain = new URL(document.referrer).hostname;
    } catch(e) {}
}

if (isCarousel && !playedGames.includes(CURRENT_GAME_ID)) {
    playedGames.push(CURRENT_GAME_ID);
}
if (isCarousel && typeof analytics !== 'undefined') logEvent(analytics, 'carousel_visit', { game_id: CURRENT_GAME_ID });
if (isEmbed && typeof analytics !== 'undefined') logEvent(analytics, 'embed_visit', { publisher_domain: publisherDomain });
if (isCaptcha && typeof analytics !== 'undefined') logEvent(analytics, 'captcha_visit', { client_id: clientId });
if (isWaitingRoom && typeof analytics !== 'undefined') logEvent(analytics, 'waiting_room_visit', { client_id: clientId });

window.getDailyCypher = function(gameIndex) {
    function mulberry32(a) {
        return function() {
          var t = a += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dateStr = formatter.format(new Date());
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) { hash = dateStr.charCodeAt(i) + ((hash << 5) - hash); }
    let rand = mulberry32(hash);
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let cyphers = [];
    for(let k=0; k<3; k++) {
        let str = "";
        for(let j=0; j<4; j++) { str += chars.charAt(Math.floor(rand() * chars.length)); }
        cyphers.push(str);
    }
    let assignment = [0,1,2];
    for (var i = assignment.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var temp = assignment[i];
        assignment[i] = assignment[j];
        assignment[j] = temp;
    }
    let result = ["","",""];
    result[assignment[0]] = cyphers[0];
    result[assignment[1]] = cyphers[1];
    result[assignment[2]] = cyphers[2];
    return result[gameIndex];
};

const LOGICAL_WIDTH = 450;
const LOGICAL_HEIGHT = 800;
const TRACK_WIDTH = 45;

let currentLevel = 1;
const times = [20, 30, 40];
let timeRemaining = times[0];
let timerInterval = null;
let isPlaying = false;

const container = document.getElementById('game-container');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timeVal = document.getElementById('time-val');
const levelNum = document.getElementById('level-num');
const seedVal = document.getElementById('seed-val');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const tutorialBtn = document.getElementById('tutorial-btn');
const tutorialModal = document.getElementById('tutorial-modal');
const btnCloseTutorial = document.getElementById('btn-close-tutorial');
const gameOverModal = document.getElementById('game-over-modal');
const endTitle = document.getElementById('end-title');
const endStats = document.getElementById('end-stats');

let scale = 1;
let totalSeedsCollected = 0;

// --- Audio System ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
}

function playSound(type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'bonk') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'seed') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'levelUp') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554, now + 0.1);
    osc.frequency.setValueAtTime(659, now + 0.2);
    osc.frequency.setValueAtTime(880, now + 0.3);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gainNode.gain.setValueAtTime(0.2, now + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    osc.start(now);
    osc.stop(now + 0.8);
  } else if (type === 'scurry') {
    // Variable duration for organic feel
    const duration = 0.06 + Math.random() * 0.04; 
    const bufferSize = audioCtx.sampleRate * duration; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    // Bandpass filter with randomized center frequency for variable tones
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000 + Math.random() * 1000; 
    filter.Q.value = 0.8;
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Soft attack eliminates the harsh "tick", and randomized gain adds variability
    const peakGain = 0.08 + Math.random() * 0.04;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peakGain, now + duration * 0.3); // Soft fade in
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);      // Soft fade out
    
    noiseSource.start(now);
    return;
  }
}

let lastBonkTime = 0;
function handleCollisionBonk() {
  let now = Date.now();
  if (now - lastBonkTime > 500) { 
    playSound('bonk');
    lastBonkTime = now;
  }
}

function resizeCanvas() {
  let effectiveHeight = window.innerHeight;
  if (autoplayMode === 'split') {
      effectiveHeight = window.innerHeight / 2;
  }
  const scaleWidth = window.innerWidth / LOGICAL_WIDTH;
  const scaleHeight = effectiveHeight / LOGICAL_HEIGHT;
  scale = Math.min(scaleWidth, scaleHeight);

  container.style.width = `${LOGICAL_WIDTH}px`;
  container.style.height = `${LOGICAL_HEIGHT}px`;
  container.style.transform = `scale(${scale})`;
  container.style.transformOrigin = 'center center';
  
  container.style.position = 'absolute';
  container.style.left = '50%';
  if (autoplayMode === 'split') {
      container.style.top = '25%';
  } else {
      container.style.top = '50%';
  }
  container.style.marginLeft = `-${LOGICAL_WIDTH / 2}px`;
  container.style.marginTop = `-${LOGICAL_HEIGHT / 2}px`;

  canvas.width = LOGICAL_WIDTH;
  canvas.height = LOGICAL_HEIGHT;
}
window.addEventListener('resize', resizeCanvas);

if (autoplayMode === 'split') {
    const asmrFile = urlParams.get('asmr');
    if (asmrFile) {
        const vid = document.createElement('video');
        vid.src = `/asmr/${asmrFile}`;
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.style.position = 'absolute';
        vid.style.bottom = '0';
        vid.style.left = '0';
        vid.style.width = '100%';
        vid.style.height = '50%';
        vid.style.objectFit = 'cover';
        document.body.appendChild(vid);
    }
    
    const banner = document.createElement('div');
    banner.innerText = "Sunny Day Puzzle from Oops-games";
    banner.style.position = 'absolute';
    banner.style.top = '50%';
    banner.style.left = '50%';
    banner.style.transform = 'translate(-50%, -50%)';
    banner.style.background = 'rgba(0, 0, 0, 0.85)';
    banner.style.color = '#fde047';
    banner.style.padding = '12px 24px';
    banner.style.borderRadius = '12px';
    banner.style.border = '2px solid #b45309';
    banner.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    banner.style.fontWeight = '800';
    banner.style.fontSize = '28px';
    banner.style.zIndex = '1000';
    banner.style.whiteSpace = 'nowrap';
    banner.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    banner.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    document.body.appendChild(banner);
}

class PolarMaze {
  constructor(numRings) {
    this.rings = numRings;
    this.cells = [];
    this.walls = [];
    this.seeds = [];
    this.buildGrid();
    this.generateMaze();
    this.buildWalls();
  }

  
  solve() {
    let startCell = this.cells[this.rings][0];
    let queue = [[startCell]];
    let visited = new Set([startCell]);
    let pathCells = [];
    
    while (queue.length > 0) {
      let currentPath = queue.shift();
      let currentCell = currentPath[currentPath.length - 1];
      if (currentCell.ring === 0) {
        pathCells = currentPath;
        break;
      }
      for (let neighbor of currentCell.links) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...currentPath, neighbor]);
        }
      }
    }
    
    let targetPoints = [];
    for (let c of pathCells) {
      if (c.ring === 0) {
        targetPoints.push({ x: 0, y: 0 });
        continue;
      }
      let r = (c.ring + 0.5) * TRACK_WIDTH;
      let theta = Math.PI * 2 / this.cells[c.ring].length;
      let angle = (c.index + 0.5) * theta;
      targetPoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return targetPoints;
  }

  buildGrid() {
    this.cells.push([{ ring: 0, index: 0, neighbors: [], links: new Set() }]);
    let currentCells = 8;
    
    for (let r = 1; r <= this.rings; r++) {
      let ringCells = [];
      if (Math.PI * r / currentCells > 1) {
         currentCells *= 2;
      }
      for (let i = 0; i < currentCells; i++) {
        ringCells.push({ ring: r, index: i, neighbors: [], links: new Set(), cellCount: currentCells });
      }
      this.cells.push(ringCells);
    }

    for (let r = 1; r <= this.rings; r++) {
      let numCells = this.cells[r].length;
      let innerNumCells = this.cells[r-1].length;
      let ratio = numCells / innerNumCells;
      
      for (let i = 0; i < numCells; i++) {
        let cell = this.cells[r][i];
        let cw = (i + 1) % numCells;
        let ccw = (i - 1 + numCells) % numCells;
        cell.neighbors.push(this.cells[r][cw]);
        cell.neighbors.push(this.cells[r][ccw]);
        
        let innerIdx = Math.floor(i / ratio);
        let innerCell = this.cells[r-1][innerIdx];
        cell.neighbors.push(innerCell);
        innerCell.neighbors.push(cell);
      }
    }
  }

  generateMaze() {
    let startCell = this.cells[this.rings][0];
    let stack = [startCell];
    let visited = new Set();
    visited.add(startCell);

    while (stack.length > 0) {
      let current = stack[stack.length - 1];
      let unvisitedNeighbors = current.neighbors.filter(n => !visited.has(n));
      
      if (unvisitedNeighbors.length > 0) {
        let neighbor = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)];
        current.links.add(neighbor);
        neighbor.links.add(current);
        visited.add(neighbor);
        stack.push(neighbor);
      } else {
        stack.pop();
      }
    }

    for (let r = 1; r <= this.rings; r++) {
      for (let cell of this.cells[r]) {
        if (r === this.rings && cell.index === 0) continue;
        if (!isCaptcha && cell.links.size === 1 && Math.random() > 0.3) {
          let cR = (r + 0.5) * TRACK_WIDTH;
          let theta = Math.PI * 2 / this.cells[r].length;
          let cTheta = (cell.index + 0.5) * theta;
          this.seeds.push({
            x: Math.cos(cTheta) * cR,
            y: Math.sin(cTheta) * cR,
            radius: 12
          });
        }
      }
    }
  }

  buildWalls() {
    for (let r = 1; r <= this.rings; r++) {
      let count = this.cells[r].length;
      let theta = Math.PI * 2 / count;
      
      for (let i = 0; i < count; i++) {
        let c = this.cells[r][i];
        let a1 = i * theta;
        let a2 = (i + 1) * theta;
        let innerR = r * TRACK_WIDTH;
        let outerR = (r + 1) * TRACK_WIDTH;
        
        let innerNeighbor = this.cells[r-1][Math.floor(i / (count / this.cells[r-1].length))];
        if (!c.links.has(innerNeighbor)) {
          this.walls.push({ type: 'arc', r: innerR, a1: a1, a2: a2 });
        }
        
        let ccwNeighbor = this.cells[r][(i - 1 + count) % count];
        if (!c.links.has(ccwNeighbor)) {
          let p1 = { x: Math.cos(a1) * innerR, y: Math.sin(a1) * innerR };
          let p2 = { x: Math.cos(a1) * outerR, y: Math.sin(a1) * outerR };
          this.walls.push({ type: 'line', p1, p2 });
        }
        
        if (r === this.rings) {
           this.walls.push({ type: 'arc', r: outerR, a1: a1, a2: a2 });
        }
      }
    }
  }
}

let maze = null;
let player = { x: 0, y: 0, radius: 10, walkCycle: 0 };
let playerAngle = 0; 
let clouds = [];

function generateClouds() {
  clouds = [];
  for(let i = 0; i < 40; i++) {
    clouds.push({
      x: (Math.random() - 0.5) * LOGICAL_WIDTH * 4,
      y: (Math.random() - 0.5) * LOGICAL_HEIGHT * 4,
      size: 30 + Math.random() * 50,
      speed: 0.1 + Math.random() * 0.2
    });
  }
}


let autoplayPath = [];
let autoplayIndex = 0;

function generatePath(level) {

  let numRings = 4 + level * 2; 
  maze = new PolarMaze(numRings);
  
  let startR = (numRings + 0.5) * TRACK_WIDTH;
  let count = maze.cells[numRings].length;
  let startAngle = (0 + 0.5) * (Math.PI * 2 / count);
  
  player.x = Math.cos(startAngle) * startR;
  player.y = Math.sin(startAngle) * startR;
  playerAngle = startAngle + Math.PI; 
  player.walkCycle = 0;
  
  generateClouds();
  if (autoplayMode) {
    autoplayPath = maze.solve();
    autoplayIndex = 0;
  }

}

function resolveCollision(player, walls) {
  let collided = false;
  for (let w of walls) {
    if (w.type === 'line') {
      let dx = w.p2.x - w.p1.x;
      let dy = w.p2.y - w.p1.y;
      let len2 = dx*dx + dy*dy;
      let t = Math.max(0, Math.min(1, ((player.x - w.p1.x) * dx + (player.y - w.p1.y) * dy) / len2));
      let closestX = w.p1.x + t * dx;
      let closestY = w.p1.y + t * dy;
      
      let distX = player.x - closestX;
      let distY = player.y - closestY;
      let dist = Math.hypot(distX, distY);
      if (dist < player.radius) {
        let pushOut = player.radius - dist;
        if (dist === 0) { distX = 1; distY = 0; dist = 1; }
        player.x += (distX / dist) * pushOut;
        player.y += (distY / dist) * pushOut;
        collided = true;
      }
    } else if (w.type === 'arc') {
      let px = player.x;
      let py = player.y;
      let pAngle = Math.atan2(py, px);
      if (pAngle < 0) pAngle += Math.PI * 2;
      
      let inBounds = pAngle >= w.a1 && pAngle <= w.a2;
      let closestX, closestY;
      
      if (inBounds) {
        closestX = Math.cos(pAngle) * w.r;
        closestY = Math.sin(pAngle) * w.r;
      } else {
        let e1x = Math.cos(w.a1) * w.r;
        let e1y = Math.sin(w.a1) * w.r;
        let e2x = Math.cos(w.a2) * w.r;
        let e2y = Math.sin(w.a2) * w.r;
        let d1 = Math.hypot(px - e1x, py - e1y);
        let d2 = Math.hypot(px - e2x, py - e2y);
        if (d1 < d2) {
          closestX = e1x; closestY = e1y;
        } else {
          closestX = e2x; closestY = e2y;
        }
      }
      
      let distX = player.x - closestX;
      let distY = player.y - closestY;
      let dist = Math.hypot(distX, distY);
      if (dist < player.radius) {
        let pushOut = player.radius - dist;
        if (dist === 0) { distX = px; distY = py; dist = Math.hypot(px, py); }
        player.x += (distX / dist) * pushOut;
        player.y += (distY / dist) * pushOut;
        collided = true;
      }
    }
  }
  return collided;
}

function checkSeeds() {
  for (let i = maze.seeds.length - 1; i >= 0; i--) {
    let s = maze.seeds[i];
    let dist = Math.hypot(player.x - s.x, player.y - s.y);
    if (dist < player.radius + s.radius) {
      maze.seeds.splice(i, 1);
      totalSeedsCollected++;
      seedVal.innerText = totalSeedsCollected;
      playSound('seed');
    }
  }
}

function drawPetal(ctx, length) {
  let width = length * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, 0); 
  ctx.bezierCurveTo(width, -length * 0.2, width, -length * 0.8, 0, -length); 
  ctx.bezierCurveTo(-width, -length * 0.8, -width, -length * 0.2, 0, 0); 
  
  let grad = ctx.createRadialGradient(0, 0, 0, 0, -length/2, length);
  grad.addColorStop(0, '#f59e0b'); // Amber Base
  grad.addColorStop(0.6, '#fde047'); // Bright Yellow middle
  grad.addColorStop(1, '#fef08a'); // Light Yellow tip
  
  ctx.fillStyle = grad;
  ctx.fill();
  
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -length * 0.5);
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSeed(ctx, size) {
  let w = size * 0.55;
  let h = size;
  ctx.beginPath();
  ctx.moveTo(0, -h/2); 
  ctx.bezierCurveTo(w/2, -h/4, w/2, h/2, 0, h/2); 
  ctx.bezierCurveTo(-w/2, h/2, -w/2, -h/4, 0, -h/2); 
  
  // Changed base color to lighter slate to pop off the brown floor
  ctx.fillStyle = '#475569'; 
  ctx.fill();
  
  // Make outline much more subtle
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.4)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  
  // Center stripe
  ctx.beginPath();
  ctx.moveTo(0, -h/2 + 3);
  ctx.lineTo(0, h/2 - 3);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.0;
  ctx.stroke();
}

function drawAphid(ctx, radius, cycle) {
  let s1 = Math.sin(cycle) * radius * 0.4;
  let s2 = Math.cos(cycle) * radius * 0.4;
  
  // Legs (Animated)
  ctx.strokeStyle = '#4d7c0f'; // Lime 700
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  
  // Front legs
  ctx.moveTo(-radius * 0.5, -radius * 0.5); ctx.lineTo(-radius * 1.3, -radius * 0.8 + s1);
  ctx.moveTo(radius * 0.5, -radius * 0.5);  ctx.lineTo(radius * 1.3, -radius * 0.8 - s1);
  // Mid legs
  ctx.moveTo(-radius * 0.6, 0); ctx.lineTo(-radius * 1.4, s2);
  ctx.moveTo(radius * 0.6, 0);  ctx.lineTo(radius * 1.4, -s2);
  // Back legs
  ctx.moveTo(-radius * 0.5, radius * 0.5); ctx.lineTo(-radius * 1.3, radius * 0.8 - s1);
  ctx.moveTo(radius * 0.5, radius * 0.5);  ctx.lineTo(radius * 1.3, radius * 0.8 + s1);
  ctx.stroke();

  // Antennae
  ctx.beginPath();
  ctx.moveTo(-radius * 0.2, -radius * 1.0);
  ctx.quadraticCurveTo(-radius * 0.6, -radius * 1.5, -radius * 0.9, -radius * 1.7);
  ctx.moveTo(radius * 0.2, -radius * 1.0);
  ctx.quadraticCurveTo(radius * 0.6, -radius * 1.5, radius * 0.9, -radius * 1.7);
  ctx.stroke();

  // Body
  ctx.fillStyle = '#84cc16'; // Lime 500
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.8, radius * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  let grad = ctx.createRadialGradient(-radius*0.2, -radius*0.3, 0, 0, 0, radius);
  grad.addColorStop(0, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.8, radius * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Head
  ctx.fillStyle = '#65a30d'; // Lime 600
  ctx.beginPath();
  ctx.arc(0, -radius * 1.0, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = '#1e293b'; 
  ctx.beginPath();
  ctx.arc(-radius * 0.25, -radius * 1.25, radius * 0.15, 0, Math.PI * 2);
  ctx.arc(radius * 0.25, -radius * 1.25, radius * 0.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx, cx, cy, size) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.8, cy - size * 0.3, size * 0.8, 0, Math.PI * 2);
  ctx.arc(cx - size * 0.8, cy - size * 0.1, size * 0.7, 0, Math.PI * 2);
  ctx.arc(cx + size * 1.4, cy + size * 0.2, size * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  // Draw Sky Background (Fixed relative to camera)
  let skyGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
  skyGrad.addColorStop(0, '#38bdf8'); // Sky 400
  skyGrad.addColorStop(1, '#bae6fd'); // Sky 200
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  
  if (!maze) return;

  // Draw Parallax Clouds
  ctx.save();
  // 0.2 factor gives the clouds depth (they move slower than the maze)
  ctx.translate(LOGICAL_WIDTH / 2 - player.x * 0.2, LOGICAL_HEIGHT / 2 - player.y * 0.2);
  for (let c of clouds) {
    c.x -= c.speed; // Drift slowly
    drawCloud(ctx, c.x, c.y, c.size);
  }
  ctx.restore();

  // Draw Maze Layer
  ctx.save();
  ctx.translate(LOGICAL_WIDTH / 2 - player.x, LOGICAL_HEIGHT / 2 - player.y);

  let mazeRadius = (maze.rings + 1) * TRACK_WIDTH;

  // Petals
  let numPetalsBack = 48;
  for (let i = 0; i < numPetalsBack; i++) {
    let angle = (i / numPetalsBack) * Math.PI * 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(mazeRadius - 10, 0); 
    ctx.rotate(Math.PI / 2); 
    drawPetal(ctx, 160);
    ctx.restore();
  }
  
  let numPetalsFront = 48;
  for (let i = 0; i < numPetalsFront; i++) {
    let angle = (i / numPetalsFront) * Math.PI * 2 + (Math.PI / numPetalsFront); 
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(mazeRadius - 25, 0); 
    ctx.rotate(Math.PI / 2);
    drawPetal(ctx, 130);
    ctx.restore();
  }

  // Maze Floor
  ctx.fillStyle = '#38220f'; 
  ctx.beginPath();
  ctx.arc(0, 0, mazeRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  // Walls
  ctx.strokeStyle = '#603813'; 
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let w of maze.walls) {
    if (w.type === 'line') {
      ctx.moveTo(w.p1.x, w.p1.y);
      ctx.lineTo(w.p2.x, w.p2.y);
    } else if (w.type === 'arc') {
      ctx.moveTo(Math.cos(w.a1) * w.r, Math.sin(w.a1) * w.r);
      ctx.arc(0, 0, w.r, w.a1, w.a2);
    }
  }
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#795548'; 
  ctx.lineWidth = 6;
  ctx.stroke(); 

  // Center Goal
  ctx.fillStyle = '#fde047'; 
  ctx.beginPath();
  ctx.arc(0, 0, TRACK_WIDTH * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#eab308'; 
  ctx.lineWidth = 4;
  ctx.stroke();

  // Seeds
  for (let s of maze.seeds) {
    ctx.save();
    ctx.translate(s.x, s.y);
    let rot = (s.x * 12.9898 + s.y * 78.233) % (Math.PI * 2);
    ctx.rotate(rot);
    drawSeed(ctx, 32);
    ctx.restore();
  }

  // Aphid
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(playerAngle);
  ctx.rotate(Math.PI / 2); 
  drawAphid(ctx, player.radius * 0.8, player.walkCycle);
  ctx.restore();

  ctx.restore();
}

function getEventPoint(e) {
  const rect = container.getBoundingClientRect();
  const rawX = e.touches ? e.touches[0].clientX : e.clientX;
  const rawY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (rawX - rect.left) / scale,
    y: (rawY - rect.top) / scale
  };
}

let isDragging = false;
let targetInput = null;
let telemetry = [];
let captchaStartTime = 0;
let PLAYER_SPEED = 6;
if (autoplayMode === 'split') {
    PLAYER_SPEED = 15; // Zoom through the maze to solve it quickly within the 15-25s time limit!
}
let lastScurryTime = 0;
let stuckFrames = 0;
let lastPlayerPos = {x: 0, y: 0};

function handleInputDown(e) {
  if (!isPlaying) return;
  isDragging = true;
  targetInput = getEventPoint(e);
  if (isCaptcha) telemetry.push({ t: 'down', x: targetInput.x, y: targetInput.y, ts: Date.now() });
}

function handleInputUp(e) {
  isDragging = false;
  if (isCaptcha) telemetry.push({ t: 'up', ts: Date.now() });
}

function handleInputMove(e) {
  if (!isPlaying || !isDragging) return;
  targetInput = getEventPoint(e);
  if (isCaptcha) telemetry.push({ t: 'move', x: targetInput.x, y: targetInput.y, ts: Date.now() });
}

function loop() {
  if (isPlaying) {
    if (autoplayMode) {
      if (autoplayIndex < autoplayPath.length) {
        if (autoplayMode === 'interactive' && autoplayIndex > autoplayPath.length * 0.6) {
            isDragging = false;
        } else {
            let t = autoplayPath[autoplayIndex];
            if (autoplayMode === 'fail' && autoplayIndex > autoplayPath.length * 0.4) {
                t = { x: t.x * 1.5, y: -t.y }; 
            } else if (autoplayMode === 'glitch') {
                t = { x: t.x + (Math.random() * 80 - 40), y: t.y + (Math.random() * 80 - 40) };
            }
            targetInput = { x: (t.x - player.x) + (LOGICAL_WIDTH / 2), y: (t.y - player.y) + (LOGICAL_HEIGHT / 2) };
            let dx = t.x - player.x;
            let dy = t.y - player.y;
            if (Math.hypot(dx, dy) < TRACK_WIDTH * 0.8) {
               autoplayIndex++;
               stuckFrames = 0;
            } else if (Math.hypot(player.x - lastPlayerPos.x, player.y - lastPlayerPos.y) < 0.5) {
               stuckFrames++;
               if (stuckFrames > 10) {
                   autoplayIndex++;
                   stuckFrames = 0;
               }
            } else {
               stuckFrames = 0;
            }
            lastPlayerPos = {x: player.x, y: player.y};
            
            if (Math.random() < 0.05) console.log(`[AUTOPLAY] Index: ${autoplayIndex}, Player: (${player.x.toFixed(1)}, ${player.y.toFixed(1)}), Target: (${t.x.toFixed(1)}, ${t.y.toFixed(1)}), Dist: ${Math.hypot(dx, dy).toFixed(1)}`);
            isDragging = true;
        }
      }
    }

    if (isDragging && targetInput) {
      let dx = targetInput.x - (LOGICAL_WIDTH / 2);
      let dy = targetInput.y - (LOGICAL_HEIGHT / 2);
      let dist = Math.hypot(dx, dy);
      
      if (dist > 5) {
        let moveDist = Math.min(PLAYER_SPEED, dist);
        let moveX = (dx / dist) * moveDist;
        let moveY = (dy / dist) * moveDist;
        
        playerAngle = Math.atan2(moveY, moveX);
        player.walkCycle += moveDist * 0.5; 
        
        let now = Date.now();
        if (now - lastScurryTime > 100) {
          playSound('scurry');
          lastScurryTime = now;
        }
        
        let steps = Math.max(1, Math.ceil(moveDist / 2)); 
        let stepX = moveX / steps;
        let stepY = moveY / steps;
        
        let didCollide = false;
        for (let s = 0; s < steps; s++) {
          player.x += stepX;
          player.y += stepY;
          for (let i = 0; i < 3; i++) {
            if (resolveCollision(player, maze.walls)) {
              didCollide = true;
            }
          }
        }
        
        if (didCollide) {
          handleCollisionBonk();
        }
        
        checkSeeds();
        
        if (Math.hypot(player.x, player.y) < TRACK_WIDTH) {
          levelComplete();
        }
      }
    }
    draw();
  }
  requestAnimationFrame(loop);
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeRemaining -= 0.1;
    if (timeRemaining <= 0) {
      timeRemaining = 0;
      updateTimeDisplay();
      gameOver(false);
    } else {
      updateTimeDisplay();
    }
  }, 100);
}

function updateTimeDisplay() {
  timeVal.innerText = timeRemaining.toFixed(1);
}

function levelComplete() {
  isPlaying = false;
  clearInterval(timerInterval);
  isDragging = false;
  
  if (currentLevel === 3 || isCaptcha || isWaitingRoom) {
    gameOver(true);
  } else {
    doTransitionToNextLevel();
  }
}

function doTransitionToNextLevel() {
  playSound('levelUp');
  container.style.transition = 'transform 0.8s ease-in, opacity 0.8s ease-in';
  container.style.transform = `scale(${scale * 0.3})`;
  container.style.opacity = '0';
  
  setTimeout(() => {
    currentLevel++;
    timeRemaining += times[currentLevel - 1]; 
    levelNum.innerText = currentLevel;
    updateTimeDisplay();
    generatePath(currentLevel);
    draw();
    
    container.style.transition = 'none'; 
    container.style.transform = `scale(${scale * 3})`;
    
    void container.offsetWidth;
    
    container.style.transition = 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.8s ease-out';
    container.style.transform = `scale(${scale})`;
    container.style.opacity = '1';
    
    setTimeout(() => {
      isPlaying = true;
      startTimer();
    }, 800);
    
  }, 800);
}

function gameOver(win) {
  isPlaying = false;
  isDragging = false;
  clearInterval(timerInterval);
  
  gameOverModal.classList.remove('hidden');
  
  if (win) {
    endTitle.innerText = "Victory!";
    endStats.innerText = `Time left: ${timeRemaining.toFixed(1)}s\nSeeds Collected: ${totalSeedsCollected}`;
    document.getElementById('vic-cypher').innerText = window.getDailyCypher ? window.getDailyCypher(0) : '';
  } else {
    endTitle.innerText = "Time's Up!";
    endStats.innerText = `You ran out of time.\nSeeds Collected: ${totalSeedsCollected}`;
    document.getElementById('vic-cypher').innerText = '';
  }

  if (isCaptcha && win) {
    endTitle.innerText = "Verifying Human...";
    endStats.innerText = "Please wait.";
    document.getElementById('vic-cypher').innerText = '';
    const payload = {
      type: 'oops_captcha_solved',
      clientId,
      solveTimeMs: Date.now() - captchaStartTime,
      telemetry
    };
    window.parent.postMessage(payload, '*');
  }

  const standardBtns = document.getElementById('standard-buttons');
  const carouselBtns = document.getElementById('carousel-buttons');
  const embedBtns = document.getElementById('embed-buttons');
  
  if (isEmbed) {
    standardBtns.style.display = 'none';
    carouselBtns.style.display = 'none';
    embedBtns.style.display = 'flex';
  } else if (isCarousel) {
    standardBtns.style.display = 'none';
    carouselBtns.style.display = 'flex';
    embedBtns.style.display = 'none';
  } else if (isWaitingRoom) {
    standardBtns.style.display = 'none';
    carouselBtns.style.display = 'none';
    embedBtns.style.display = 'none';
    let wrReturnBtn = document.getElementById('btn-wr-return-final');
    if (!wrReturnBtn) {
      wrReturnBtn = document.createElement('button');
      wrReturnBtn.id = 'btn-wr-return-final';
      wrReturnBtn.style = "background: #38bdf8; color: white; width: 100%; font-size: 1.3rem; padding: 15px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 20px;";
      wrReturnBtn.innerText = "➡️ Proceed to App";
      wrReturnBtn.onclick = () => {
        window.parent.postMessage({ type: 'PROCEED_TO_APP', clientId }, '*');
      };
      document.querySelector('#game-over-modal .modal-content').appendChild(wrReturnBtn);
    }
    wrReturnBtn.style.display = 'block';
  } else {
    standardBtns.style.display = 'flex';
    carouselBtns.style.display = 'none';
    embedBtns.style.display = 'none';
  }

  // Handle Video Generation Flag
  if (autoplayMode) {
     if (!window._VIDEO_RECORDING_DONE_TIMEOUT_SET) {
        window._VIDEO_RECORDING_DONE_TIMEOUT_SET = true;
        setTimeout(() => window._VIDEO_RECORDING_DONE = true, 4000);
     }
  }

  if (typeof analytics !== 'undefined') {
      let eventParams = { win: win, timeRemaining: timeRemaining, seeds: totalSeedsCollected };
      if (isEmbed) eventParams.publisher_domain = publisherDomain;
      logEvent(analytics, 'game_over', eventParams);
  }

  window.dispatchEvent(new CustomEvent('oops_game_over', { 
    detail: { win, timeRemaining, seeds: totalSeedsCollected } 
  }));
}

function initGame() {
  currentLevel = 1;
  timeRemaining = times[0];
  totalSeedsCollected = 0;
  seedVal.innerText = '0';
  levelNum.innerText = currentLevel;
  updateTimeDisplay();
  startScreen.classList.add('hidden');
  
  if (isCaptcha) {
      const levelCont = document.getElementById('ui-level-container');
      const seedsCont = document.getElementById('ui-seeds-container');
      if (levelCont) levelCont.style.display = 'none';
      if (seedsCont) seedsCont.style.display = 'none';
      captchaStartTime = Date.now();
      telemetry = [];
  }
  
  container.style.transition = 'none';
  container.style.transform = `scale(${scale})`;
  container.style.opacity = '1';
  
  generatePath(currentLevel);
  isPlaying = true;
  isDragging = false;
  startTimer();
}

startBtn.addEventListener('click', initGame);

tutorialBtn.addEventListener('click', () => {
  tutorialModal.classList.remove('hidden');
});

btnCloseTutorial.addEventListener('click', () => {
  tutorialModal.classList.add('hidden');
});

window.addEventListener('mousedown', (e) => {
  initAudio();
  if (e.target === canvas) handleInputDown(e);
});
window.addEventListener('mousemove', handleInputMove);
window.addEventListener('mouseup', handleInputUp);

window.addEventListener('touchstart', (e) => {
  initAudio();
  if (e.target === canvas) {
    e.preventDefault();
    handleInputDown(e);
  }
}, {passive: false});

window.addEventListener('touchmove', (e) => {
  if (isDragging) e.preventDefault();
  handleInputMove(e);
}, {passive: false});

window.addEventListener('touchend', handleInputUp);

resizeCanvas();
currentLevel = 1;
timeRemaining = times[0];
generatePath(currentLevel);
draw();
requestAnimationFrame(loop);

// Button Event Listeners for UI
document.getElementById('btn-hub')?.addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'hub_return_click');
    window.location.href = 'https://oops-games-hub.web.app/';
});

document.getElementById('btn-share')?.addEventListener('click', () => {
    const text = `Sunny Day Maze 🌻\nSeeds: ${totalSeedsCollected}\nTime: ${timeRemaining.toFixed(1)}s\nPlay free at https://sunny-day-maze.web.app`;
    if (navigator.share) {
        navigator.share({ title: 'Sunny Day Maze', text });
    } else {
        navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard!"));
    }
});

document.getElementById('btn-embed-hook')?.addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'embed_hook_clicked');
    window.open('https://oops-games-hub.web.app/', '_blank');
});

const advanceCarousel = async () => {
    try {
        const res = await fetch('https://oops-games-hub.web.app/carousel_config.json');
        const configList = await res.json();
        const unplayed = configList.filter(g => !playedGames.includes(g.id));
        if (unplayed.length > 0) {
            const nextGame = unplayed[Math.floor(Math.random() * unplayed.length)];
            window.location.href = `${nextGame.url}?carousel=true&played=${playedGames.join(',')}`;
        } else {
            window.location.href = 'https://oops-games-hub.web.app/';
        }
    } catch(e) {
        window.location.href = 'https://oops-games-hub.web.app/';
    }
};

document.getElementById('btn-next')?.addEventListener('click', advanceCarousel);

if (autoplayMode || isCaptcha) {
    setTimeout(() => {
        initGame();
    }, 500);
}

// Waiting Room Logic
if (isWaitingRoom) {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'TASK_COMPLETED') {
      isPlaying = false;
      isDragging = false;
      clearInterval(timerInterval);
      const modal = document.getElementById('waiting-room-modal');
      if (modal) modal.style.display = 'flex';
      
      const btnFinish = document.getElementById('btn-wr-finish');
      if (btnFinish) btnFinish.onclick = () => {
        if (modal) modal.style.display = 'none';
        isPlaying = true;
        startTimer();
      };
      
      const btnProceed = document.getElementById('btn-wr-proceed');
      if (btnProceed) btnProceed.onclick = () => {
        window.parent.postMessage({ type: 'PROCEED_TO_APP', clientId }, '*');
      };
    }
  });
}
