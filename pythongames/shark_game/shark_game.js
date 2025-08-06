// === Shark Game JavaScript Port (Improved Spawning + Points + Orca Fix) ===

// Setup canvas
const canvas = document.createElement('canvas');
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Adjust canvas size based on window dimensions
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", function() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Canvas dimensions
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const AIR_COLOR = 'skyblue';
const WATER_COLOR = '#006992';

const SHARK_WIDTH = 120;
const SHARK_HEIGHT = 120;
const shark = { x: 100, y: HEIGHT / 2, width: SHARK_WIDTH, height: SHARK_HEIGHT };

let velocityY = 0;
const sharkSpeed = 7;
const gravityAir = 0.65;  // Reduced gravity for easier jumping
const dragWater = 0.1;
const swimForce = 1.1;
const jumpForce = 20;  // Increased jump force for higher jumps
const maxFallSpeed = 10;
let canJump = true;

let terrainHeights = [];
let terrainOffset = 0;

let fishes = [];
let crabs = [];
let seagulls = [];
let orcas = []; // Changed orca to an array to hold multiple orcas

let score = 0;
let gameTime = 60;
let gameOver = false;
let spawnTimer = 0;
let flashCounter = 0;
let lastScoreCheckpoint = 0;

// Load assets
const assets = {};
const imageSources = {
  shark: 'assets/shark.png',
  fish: 'assets/fish.png',
  crab: 'assets/crab.png',
  orca: 'assets/orca.png',
  seagull: 'assets/seagull.png'
};
const soundSources = {
  eat: 'assets/eat.wav',
  hit: 'assets/hit.wav',
  gameover: 'assets/gameover.wav'
};

for (const [key, src] of Object.entries(imageSources)) {
  const img = new Image();
  img.src = src;
  assets[key] = img;
}
for (const [key, src] of Object.entries(soundSources)) {
  const snd = new Audio(src);
  assets[key + 'Sound'] = snd;
}

// Mobile Controls
let moveLeft = false;
let moveRight = false;
let jump = false;

// Function to detect if the device is mobile
function isMobile() {
  return window.innerWidth <= 768;
}

// Switch between mobile and desktop controls based on the device
let isMobileDevice = isMobile();

if (isMobileDevice) {
  document.addEventListener("touchstart", handleTouchStart);
  document.addEventListener("touchend", handleTouchEnd);
}

function handleTouchStart(event) {
  const touch = event.touches[0];
  const screenWidth = window.innerWidth;

  // Detect left side for move left, right side for move right
  if (touch.clientX < screenWidth / 2) {
    moveLeft = true;
  } else {
    moveRight = true;
  }

  // Detect if the touch is in the lower half of the screen for jump
  if (touch.clientY > window.innerHeight / 2) {
    jump = true;
  }
}

function handleTouchEnd() {
  moveLeft = false;
  moveRight = false;
  jump = false;
}

function updateMobileMovement() {
  if (moveLeft) {
    shark.x -= sharkSpeed;  // Move left
  }
  if (moveRight) {
    shark.x += sharkSpeed;  // Move right
  }
  if (jump && shark.y + shark.height === HEIGHT) {
    velocityY = -jumpForce;  // Make shark jump
  }
}

// Desktop Controls (Arrow Keys)
let keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (gameOver && e.key === 'r') startGame();
});
document.addEventListener('keyup', e => keys[e.key] = false);

function updateDesktopMovement() {
  if (keys['ArrowUp']) {
    if (shark.y < HEIGHT / 3) {
      // In air — normal jump
      if (canJump) {
        velocityY = -jumpForce;
        canJump = false;
      }
    } else {
      // In water — swim upward
      velocityY -= swimForce;
    }
  }

  if (keys['ArrowDown']) velocityY += swimForce;
  if (keys['ArrowLeft']) shark.x -= sharkSpeed;
  if (keys['ArrowRight']) shark.x += sharkSpeed;
}

// Function to generate terrain heights
function generateTerrain() {
  const base = HEIGHT - 150;  // Start the terrain further down (lower base)
  let last = base;
  terrainHeights = [];
  for (let x = 0; x < WIDTH; x++) {
    let change = Math.floor(Math.random() * 21) - 10;  // Random fluctuation
    last = Math.max(HEIGHT / 2 + 15, Math.min(HEIGHT - 100, last + change)); // Keep it within a lower range
    terrainHeights.push(last);
  }
}

// Function to update terrain (for scrolling/animating terrain)
function updateTerrain() {
  terrainHeights = terrainHeights.slice(2);
  let last = terrainHeights[terrainHeights.length - 1];
  for (let i = 0; i < 2; i++) {
    let change = Math.floor(Math.random() * 21) - 10; 
    last = Math.max(HEIGHT / 2 + 20, Math.min(HEIGHT - 100, last + change));  // Keep it consistently lower
    terrainHeights.push(last);
  }
}

// Function to draw terrain
function drawTerrain() {
  const terrainPoints = terrainHeights.map((y, x) => ({ x, y }));
  terrainPoints.push({ x: WIDTH, y: HEIGHT }, { x: 0, y: HEIGHT });
  ctx.beginPath();
  ctx.moveTo(terrainPoints[0].x, terrainPoints[0].y);
  terrainPoints.forEach(point => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = '#3C2C1E';  // Terrain color
  ctx.fill();
}

// Function to check if shark collides with terrain
function sharkCollidesWithTerrain() {
  const sharkBottom = shark.y + shark.height;
  for (let x = Math.floor(shark.x); x < shark.x + shark.width; x++) {
    if (x >= 0 && x < terrainHeights.length && sharkBottom >= terrainHeights[Math.floor(x)]) {
      return true;
    }
  }
  return false;
}

function collides(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function drawScene() {
  ctx.fillStyle = AIR_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = WATER_COLOR;
  ctx.fillRect(0, HEIGHT / 3, WIDTH, HEIGHT);
  drawTerrain();
  ctx.drawImage(assets.shark, shark.x, shark.y, SHARK_WIDTH, SHARK_HEIGHT);
  fishes.forEach(f => ctx.drawImage(assets.fish, f.x, f.y, 40, 40));
  crabs.forEach(c => ctx.drawImage(assets.crab, c.x, c.y, 40, 40));
  seagulls.forEach(s => ctx.drawImage(assets.seagull, s.x, s.y, 50, 40));
  orcas.forEach(o => {
    ctx.save();
    if (o.direction === -1) ctx.scale(-1, 1);
    ctx.drawImage(assets.orca, o.direction === -1 ? -o.x - o.width : o.x, o.y, o.width, o.height);
    ctx.restore();
  });
  if (flashCounter > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    flashCounter--;
  }
}

function drawScore() {
  ctx.fillStyle = 'black';
  ctx.font = '24px Arial';
  ctx.fillText(`Score: ${score}`, 10, 30);
  ctx.font = '32px Arial';
  ctx.fillText(`Time: ${Math.max(0, Math.floor(gameTime))}`, WIDTH - 150, 30);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = 'white';
  ctx.font = '48px Arial';
  ctx.fillText('Game Over', WIDTH / 2 - 120, HEIGHT / 2 - 20);
  ctx.font = '32px Arial';
  ctx.fillText(`Final Score: ${score}`, WIDTH / 2 - 100, HEIGHT / 2 + 30);
  ctx.fillText('Press R to Restart', WIDTH / 2 - 110, HEIGHT / 2 + 70);
}

// Updated spawnEntities function
function spawnEntities() {
  if (spawnTimer % 90 === 0) 
    fishes.push({ x: WIDTH + 20, y: HEIGHT / 3 + Math.random() * (HEIGHT - HEIGHT / 3 - 120), width: 40, height: 40 });
  
  if (spawnTimer % 240 === 0) 
    crabs.push({ x: WIDTH + 20, y: terrainHeights[WIDTH - 1] - 40, width: 40, height: 40 });

  if (spawnTimer % 400 === 0) 
    seagulls.push({ x: WIDTH + 20, y: Math.random() * (HEIGHT / 3 - 40), width: 50, height: 40 });

  // Spawn Orcas one at a time and alternate direction
  if (spawnTimer % 400 === 0) {
    const direction = Math.random() < 0.5 ? -1 : 1; // Randomly decide left (-1) or right (1)
    const newOrca = {
      active: true,
      direction: direction,
      x: direction === -1 ? WIDTH + 200 : -200, // Spawn from the correct direction
      y: HEIGHT / 3 + Math.random() * (HEIGHT - HEIGHT / 3 - 120), // Adjust vertical spawn height
      width: 160,
      height: 100
    };
    orcas.push(newOrca);
  }
}

function updateEntities() {
  const speed = 4;
  fishes.forEach(f => f.x -= speed);
  crabs.forEach(c => c.x -= speed);
  seagulls.forEach(s => s.x -= speed);
  orcas.forEach(o => {
    o.x += speed * o.direction;
    if ((o.direction === 1 && o.x > WIDTH + 200) || (o.direction === -1 && o.x < -200)) {
      o.active = false;
    }
  });

  fishes = fishes.filter(f => f.x + f.width > 0);
  crabs = crabs.filter(c => c.x + c.width > 0);
  seagulls = seagulls.filter(s => s.x + s.width > 0);
  orcas = orcas.filter(o => o.active); // Filter out inactive orcas
}

function handleCollisions() {
  fishes = fishes.filter(f => {
    if (collides(shark, f)) {
      score += 1;
      assets.eatSound.play();
      return false;
    }
    return true;
  });

  crabs = crabs.filter(c => {
    if (collides(shark, c)) {
      flashCounter = 5;
      score = Math.max(0, score - 1);
      assets.hitSound.play();
      return false;
    }
    return true;
  });

  seagulls = seagulls.filter(s => {
    if (collides(shark, s)) {
      score += 4;
      flashCounter = 0;
      assets.eatSound.play();
      return false;
    }
    return true;
  });

  orcas.forEach(o => {
    if (collides(shark, o)) {
      flashCounter = 10;
      score = 0; // Reset the score when colliding with orca
      assets.hitSound.play(); // Play hit sound
    }
  });
}

function gameLoop() {
  if (gameOver) {
    drawScene();
    drawScore();
    drawGameOver();
    return;
  }

  updateTerrain();
  spawnEntities();
  updateEntities();
  handleCollisions();

  if (score - lastScoreCheckpoint >= 30) {
    gameTime += 20;
    lastScoreCheckpoint = score;
  }

  if (shark.y < HEIGHT / 3) velocityY += gravityAir;
  else velocityY += gravityAir * 0.15, velocityY *= 1 - dragWater;
  velocityY = Math.max(-25, Math.min(velocityY, maxFallSpeed));
  shark.y += velocityY;
  if (shark.y + shark.height > HEIGHT) shark.y = HEIGHT - shark.height, velocityY = 0;

  while (sharkCollidesWithTerrain()) shark.y--, velocityY = 0, canJump = true;

  if (isMobileDevice) {
    updateMobileMovement();  // Use mobile controls
  } else {
    updateDesktopMovement(); // Use desktop controls
  }

  gameTime -= 1 / 60;
  if (gameTime <= 0) {
    gameOver = true;
    assets.gameoverSound.play();
  }

  drawScene();
  drawScore();
  spawnTimer++;
  requestAnimationFrame(gameLoop);
}

function startGame() {
  score = 0;
  lastScoreCheckpoint = 0;
  gameTime = 60;
  gameOver = false;
  fishes = [];
  crabs = [];
  seagulls = [];
  orcas = []; // Reset orca array at the start
  generateTerrain();
  gameLoop();
}

startGame();
