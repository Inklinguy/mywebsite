// === Shark Game with Full Joystick Support, Mobile Restart, and Moving Clouds ===

// Setup canvas
const canvas = document.createElement('canvas');
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

// Joystick UI
const joystick = document.createElement('div');
joystick.id = 'joystick';
document.body.appendChild(joystick);

const restartBtn = document.createElement('button');
restartBtn.innerText = 'Play Again';
restartBtn.id = 'restartBtn';
restartBtn.style.display = 'none';
document.body.appendChild(restartBtn);

const style = document.createElement('style');
style.innerHTML = `
  #joystick {
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 80px;
    height: 80px;
    background: rgba(255, 255, 255, 0.15);
    border: 2px solid white;
    border-radius: 50%;
    touch-action: none;
    z-index: 9999;
  }
  #restartBtn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 32px;
    padding: 20px 40px;
    background-color: #1E90FF;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.3);
    transition: background-color 0.3s ease;
    z-index: 10000;
  }
  #restartBtn:hover {
    background-color: #4682B4;
  }
  #restartBtn:active {
    background-color: #5A9BD5;
  }
`;
document.head.appendChild(style);

// Resize canvas based on window size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

let WIDTH = canvas.width;
let HEIGHT = canvas.height;
const AIR_COLOR = 'skyblue';
const WATER_COLOR = '#006992';

const SHARK_WIDTH = 120;
const SHARK_HEIGHT = 120;
const shark = { x: 100, y: HEIGHT / 2, width: SHARK_WIDTH, height: SHARK_HEIGHT };

let velocityY = 0;
const sharkSpeed = 7;
const gravityAir = 0.65;
const dragWater = 0.1;
const swimForce = 1.1;
const jumpForce = 20;
const maxFallSpeed = 10;
let canJump = true;

let terrainHeights = [], fishes = [], crabs = [], seagulls = [], orcas = [];
let score = 0, gameTime = 60, gameOver = false, spawnTimer = 0, flashCounter = 0, lastScoreCheckpoint = 0;

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

let joystickActive = false, joystickStartX = 0, joystickStartY = 0, joystickDX = 0, joystickDY = 0;

joystick.addEventListener('touchstart', e => {
  joystickActive = true;
  const touch = e.touches[0];
  joystickStartX = touch.clientX;
  joystickStartY = touch.clientY;
  joystickDX = 0;
  joystickDY = 0;
}, { passive: false });

joystick.addEventListener('touchmove', e => {
  if (!joystickActive) return;
  const touch = e.touches[0];
  joystickDX = touch.clientX - joystickStartX;
  joystickDY = touch.clientY - joystickStartY;
  e.preventDefault();
}, { passive: false });

joystick.addEventListener('touchend', () => {
  joystickActive = false;
  joystickDX = 0;
  joystickDY = 0;
}, { passive: false });

function updateMobileMovement() {
  // Left/Right movement
  if (joystickDX < -20) shark.x -= sharkSpeed;
  if (joystickDX > 20) shark.x += sharkSpeed;

  // Up/Down movement
  if (joystickDY < -30) {
    // Jump when in air
    if (shark.y < HEIGHT / 3) {
      if (canJump) {
        velocityY = -jumpForce;
        canJump = false;
      }
    } else {
      // Swim upwards when in water
      velocityY -= swimForce;
    }
  } else if (joystickDY > 30) {
    // Swim downwards
    velocityY += swimForce;
  }
}

let keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (gameOver && e.key === 'r') startGame(); // Restart on 'r' key press
});
document.addEventListener('keyup', e => keys[e.key] = false);

function updateDesktopMovement() {
  if (keys['ArrowUp']) {
    if (shark.y < HEIGHT / 3) {
      if (canJump) {
        velocityY = -jumpForce;
        canJump = false;
      }
    } else {
      velocityY -= swimForce;
    }
  }
  if (keys['ArrowDown']) velocityY += swimForce;
  if (keys['ArrowLeft']) shark.x -= sharkSpeed;
  if (keys['ArrowRight']) shark.x += sharkSpeed;
}

function generateTerrain() {
  const base = HEIGHT - 150;
  let last = base;
  terrainHeights = [];
  for (let x = 0; x < WIDTH; x++) {
    let change = Math.floor(Math.random() * 21) - 10;
    last = Math.max(HEIGHT / 2 + 15, Math.min(HEIGHT - 100, last + change));
    terrainHeights.push(last);
  }
}

function updateTerrain() {
  terrainHeights = terrainHeights.slice(2);
  let last = terrainHeights[terrainHeights.length - 1];
  for (let i = 0; i < 2; i++) {
    let change = Math.floor(Math.random() * 21) - 10;
    last = Math.max(HEIGHT / 2 + 20, Math.min(HEIGHT - 100, last + change));
    terrainHeights.push(last);
  }
}

function drawTerrain() {
  const terrainPoints = terrainHeights.map((y, x) => ({ x, y }));
  terrainPoints.push({ x: WIDTH, y: HEIGHT }, { x: 0, y: HEIGHT });
  ctx.beginPath();
  ctx.moveTo(terrainPoints[0].x, terrainPoints[0].y);
  terrainPoints.forEach(point => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = '#3C2C1E';
  ctx.fill();
}

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
  restartBtn.style.display = 'block';
}

// Clouds setup
let clouds = [];

function generateClouds() {
  if (spawnTimer % 150 === 0) {
    clouds.push({
      x: WIDTH,
      y: Math.random() * 100,
      speed: Math.random() * 0.5 + 0.5,
      width: 100 + Math.random() * 150,
      height: 40 + Math.random() * 30
    });
  }
}

function updateClouds() {
  clouds.forEach((cloud, index) => {
    cloud.x -= cloud.speed;
    if (cloud.x + cloud.width < 0) {
      // Reposition cloud to the right side once it goes off-screen
      clouds[index] = {
        x: WIDTH,
        y: Math.random() * 100,
        speed: Math.random() * 0.5 + 0.5,
        width: 100 + Math.random() * 150,
        height: 40 + Math.random() * 30
      };
    }
  });
}

function drawClouds() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  clouds.forEach(cloud => {
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function spawnEntities() {
  if (spawnTimer % 90 === 0)
    fishes.push({ x: WIDTH + 20, y: HEIGHT / 3 + Math.random() * (HEIGHT - HEIGHT / 3 - 120), width: 40, height: 40 });

  if (spawnTimer % 240 === 0)
    crabs.push({ x: WIDTH + 20, y: terrainHeights[WIDTH - 1] - 40, width: 40, height: 40 });

  if (spawnTimer % 400 === 0)
    seagulls.push({ x: WIDTH + 20, y: Math.random() * (HEIGHT / 3 - 40), width: 50, height: 40 });

  if (spawnTimer % 400 === 0) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const newOrca = {
      active: true,
      direction,
      x: direction === -1 ? WIDTH + 200 : -200,
      y: HEIGHT / 3 + Math.random() * (HEIGHT - HEIGHT / 3 - 120),
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
  orcas = orcas.filter(o => o.active);
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
      assets.eatSound.play();
      return false;
    }
    return true;
  });

  orcas.forEach(o => {
    if (collides(shark, o)) {
      flashCounter = 10;
      score = 0;
      assets.hitSound.play();
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
  updateClouds();

  if (score - lastScoreCheckpoint >= 30) {
    gameTime += 20;
    lastScoreCheckpoint = score;
  }

  if (shark.y < HEIGHT / 3) velocityY += gravityAir;
  else velocityY += gravityAir * 0.15, velocityY *= 1 - dragWater;

  velocityY = Math.max(-25, Math.min(velocityY, maxFallSpeed));
  shark.y += velocityY;

  while (sharkCollidesWithTerrain()) shark.y--, velocityY = 0, canJump = true;

  if (joystickActive) updateMobileMovement();
  else updateDesktopMovement();

  if (shark.y + shark.height > HEIGHT) shark.y = HEIGHT - shark.height, velocityY = 0;
  if (shark.y < 0) shark.y = 0;
  if (shark.x < 0) shark.x = 0;
  if (shark.x + shark.width > WIDTH) shark.x = WIDTH - shark.width;

  gameTime -= 1 / 60;
  if (gameTime <= 0) {
    gameOver = true;
    assets.gameoverSound.play();
  }

  drawScene();
  drawScore();
  drawClouds();
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
  orcas = [];
  generateTerrain();
  clouds = [];
  restartBtn.style.display = 'none';
  gameLoop();
}

startGame(); // This line starts the game loop
