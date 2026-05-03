const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

// 1. Add top imports and params
const topCode = `import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
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
const autoplayMode = urlParams.get('autoplay');
let playedGames = urlParams.get('played') ? urlParams.get('played').split(',').filter(Boolean) : [];
const CURRENT_GAME_ID = 'JM';
if (isCarousel && !playedGames.includes(CURRENT_GAME_ID)) {
    playedGames.push(CURRENT_GAME_ID);
}
if (isCarousel && typeof analytics !== 'undefined') logEvent(analytics, 'carousel_visit', { game_id: CURRENT_GAME_ID });
if (isEmbed && typeof analytics !== 'undefined') logEvent(analytics, 'embed_visit');

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

`;
code = topCode + code;

// 2. Add solve() to PolarMaze
const solveCode = `
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
`;
code = code.replace(/buildGrid\(\) \{/, solveCode + '\n  buildGrid() {');

// 3. Autoplay logic variables and initialization
code = code.replace('function generatePath(level) {', `
let autoplayPath = [];
let autoplayIndex = 0;

function generatePath(level) {
`);

code = code.replace('generateClouds();', `generateClouds();
  if (autoplayMode) {
    autoplayPath = maze.solve();
    autoplayIndex = 0;
  }
`);

// 4. Overwrite game over modal to support buttons
const gameOverCode = `function gameOver(win) {
  isPlaying = false;
  isDragging = false;
  clearInterval(timerInterval);
  
  gameOverModal.classList.remove('hidden');
  
  if (win) {
    endTitle.innerText = "Victory!";
    endStats.innerText = \`Time left: \${timeRemaining.toFixed(1)}s\\nSeeds Collected: \${totalSeedsCollected}\`;
    document.getElementById('vic-cypher').innerText = window.getDailyCypher ? window.getDailyCypher(0) : '';
  } else {
    endTitle.innerText = "Time's Up!";
    endStats.innerText = \`You ran out of time.\\nSeeds Collected: \${totalSeedsCollected}\`;
    document.getElementById('vic-cypher').innerText = '';
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
  } else {
    standardBtns.style.display = 'flex';
    carouselBtns.style.display = 'none';
    embedBtns.style.display = 'none';
  }

  // Handle Video Generation Flag
  if (autoplayMode && win) {
     if (!window._VIDEO_RECORDING_DONE_TIMEOUT_SET) {
        window._VIDEO_RECORDING_DONE_TIMEOUT_SET = true;
        setTimeout(() => window._VIDEO_RECORDING_DONE = true, 4000);
     }
  }

  window.dispatchEvent(new CustomEvent('oops_game_over', { 
    detail: { win, timeRemaining, seeds: totalSeedsCollected } 
  }));
}`;
code = code.replace(/function gameOver\(win\) \{[\s\S]*?\}\s*function initGame/, gameOverCode + '\n\nfunction initGame');

// 5. Autoplay in loop()
code = code.replace(/if \(isPlaying\) \{[\s\S]*?if \(isDragging && targetInput\) \{/, `if (isPlaying) {
    if (autoplayMode) {
      if (autoplayIndex < autoplayPath.length) {
        const t = autoplayPath[autoplayIndex];
        targetInput = { x: t.x + (LOGICAL_WIDTH / 2), y: t.y + (LOGICAL_HEIGHT / 2) };
        let dx = t.x - player.x;
        let dy = t.y - player.y;
        if (Math.hypot(dx, dy) < TRACK_WIDTH * 0.8) {
           autoplayIndex++;
        }
        isDragging = true;
      }
    }

    if (isDragging && targetInput) {`);

// 6. UI event listeners
code += `
// Button Event Listeners for UI
document.getElementById('btn-hub')?.addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'hub_return_click');
    window.location.href = 'https://oops-games-hub.web.app/';
});

document.getElementById('btn-share')?.addEventListener('click', () => {
    const text = \`Sunny Day Maze 🌻\\nSeeds: \${totalSeedsCollected}\\nTime: \${timeRemaining.toFixed(1)}s\\nPlay free at https://sunny-day-maze.web.app\`;
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
            window.location.href = \`\${nextGame.url}?carousel=true&played=\${playedGames.join(',')}\`;
        } else {
            window.location.href = 'https://oops-games-hub.web.app/';
        }
    } catch(e) {
        window.location.href = 'https://oops-games-hub.web.app/';
    }
};

document.getElementById('btn-next')?.addEventListener('click', advanceCarousel);
`;

fs.writeFileSync('main.js', code);
console.log('Successfully injected integration logic into main.js');
