(() => {
  'use strict';

  // All distances are in logical canvas pixels; all times are in seconds.
  const CONFIG = Object.freeze({
    playerSpeed: 360,
    playerPixelSize: 4,
    playerBottomMargin: 32,
    bulletSpeed: 660,
    bulletWidth: 2,
    bulletHeight: 14,
    firingCooldown: 0.2,
    engineFrameDuration: 0.09,
    playerLives: 3,
    invulnerabilityDuration: 1.5,
    enemyRows: 5,
    enemyColumns: 8,
    enemyPixelSize: 3,
    enemyColumnSpacing: 64,
    enemyRowSpacing: 42,
    enemyTop: 52,
    enemyBoundaryMargin: 16,
    enemySpeed: 30,
    enemySpeedPerWave: 7,
    enemyMaxSpeed: 100,
    enemyDownStep: 18,
    enemyAnimationDuration: 0.35,
    enemyFiringCooldown: 1.4,
    enemyCooldownPerWave: 0.1,
    enemyMinFiringCooldown: 0.45,
    enemyBulletLimit: 4,
    enemyBulletSpeed: 240,
    enemyBulletWidth: 5,
    enemyBulletHeight: 12,
    explosionDuration: 0.3,
    waveAnnouncementDuration: 1.5,
  });
  const ALIENS = [
    ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
    ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', '.XXXXXXXXX.', '..XXXXXXX..', '..X.....X..', '.XX.....XX.'],
  ];
  const ENEMY_TYPES = {
    red: { color: '#ff354f', points: 10 },
    green: { color: '#48ef55', points: 20 },
    yellow: { color: '#f5ed40', points: 30 },
  };
  const SHIP = [
    '......C......',
    '.....CCC.....',
    '....CCWCC....',
    '...CCCWCCC...',
    '......C......',
    'C....CCC....C',
    'CC..CCCCC..CC',
    'CCCCCCCCCCCCC',
    'CCC.......CCC',
  ];
  const canvas = document.querySelector('#game');
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  const status = document.querySelector('#status');
  const startButton = document.querySelector('#start');
  const pauseButton = document.querySelector('#pause');
  const restartButton = document.querySelector('#restart');
  const scoreDisplay = document.querySelector('#score');
  const livesDisplay = document.querySelector('#lives');
  const waveDisplay = document.querySelector('#wave');
  const announcement = document.querySelector('#announcement');
  const held = new Set();
  const movementKeys = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space']);
  const player = { x: 0, y: 0, width: SHIP[0].length * CONFIG.playerPixelSize, height: SHIP.length * CONFIG.playerPixelSize };
  let bullets = [];
  let cooldownRemaining = 0;
  let animationTime = 0;
  let state = 'ready';
  let previousTime = null;
  let enemies = [];
  let enemyBullets = [];
  let explosions = [];
  let score = 0;
  let lives = CONFIG.playerLives;
  let wave = 1;
  let direction = 1;
  let enemyFireTimer = CONFIG.enemyFiringCooldown;
  let invulnerabilityRemaining = 0;
  let waveTimer = 0;

  const enemySpeed = () => Math.min(CONFIG.enemyMaxSpeed, CONFIG.enemySpeed + (wave - 1) * CONFIG.enemySpeedPerWave);
  const enemyFireInterval = () => Math.max(CONFIG.enemyMinFiringCooldown, CONFIG.enemyFiringCooldown - (wave - 1) * CONFIG.enemyCooldownPerWave);
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  function updateHUD() {
    scoreDisplay.textContent = String(score);
    livesDisplay.textContent = String(lives);
    waveDisplay.textContent = String(wave);
    announcement.textContent = state === 'gameover' ? 'Game over — Restart to play again' : waveTimer > 0 ? `Wave ${wave}` : '';
  }

  function spawnWave() {
    const width = ALIENS[0][0].length * CONFIG.enemyPixelSize;
    const height = ALIENS[0].length * CONFIG.enemyPixelSize;
    const startX = (canvas.width - ((CONFIG.enemyColumns - 1) * CONFIG.enemyColumnSpacing + width)) / 2;
    enemies = [];
    for (let row = 0; row < CONFIG.enemyRows; row++) {
      for (let column = 0; column < CONFIG.enemyColumns; column++) {
        // A full 5x8 grid, with just four yellow commanders centered in the top row.
        const type = row >= 3 ? 'red' : row === 0 && column >= 2 && column <= 5 ? 'yellow' : 'green';
        enemies.push({ x: startX + column * CONFIG.enemyColumnSpacing, y: CONFIG.enemyTop + row * CONFIG.enemyRowSpacing, width, height, column, type });
      }
    }
    direction = 1;
    enemyFireTimer = enemyFireInterval();
  }

  function gameOver() {
    if (state === 'gameover') return;
    setState('gameover');
  }

  function damagePlayer() {
    if (state !== 'active' || invulnerabilityRemaining > 0) return;
    lives = Math.max(0, lives - 1);
    invulnerabilityRemaining = CONFIG.invulnerabilityDuration;
    if (lives === 0) gameOver();
  }

  function moveEnemies(dt) {
    if (!enemies.length) return;
    const left = Math.min(...enemies.map(enemy => enemy.x));
    const right = Math.max(...enemies.map(enemy => enemy.x + enemy.width));
    const travel = direction * enemySpeed() * dt;
    const edge = direction > 0 ? canvas.width - CONFIG.enemyBoundaryMargin - right : CONFIG.enemyBoundaryMargin - left;
    const touchesEdge = direction > 0 ? travel >= edge : travel <= edge;
    const dx = touchesEdge ? edge : travel;
    for (const enemy of enemies) {
      enemy.x += dx;
      if (touchesEdge) enemy.y += CONFIG.enemyDownStep;
    }
    // Clamp to the edge and turn away immediately: no repeated descent at one edge.
    if (touchesEdge) direction *= -1;
  }

  function enemyAttack(dt) {
    enemyFireTimer -= dt;
    if (enemyFireTimer > 0) return;
    enemyFireTimer = enemyFireInterval();
    if (enemyBullets.length >= CONFIG.enemyBulletLimit || !enemies.length) return;
    const bottomByColumn = new Map();
    for (const enemy of enemies) {
      const bottom = bottomByColumn.get(enemy.column);
      if (!bottom || enemy.y > bottom.y) bottomByColumn.set(enemy.column, enemy);
    }
    const candidates = [...bottomByColumn.values()];
    const source = candidates[Math.floor(Math.random() * candidates.length)];
    enemyBullets.push({ x: source.x + (source.width - CONFIG.enemyBulletWidth) / 2,
      y: source.y + source.height, width: CONFIG.enemyBulletWidth, height: CONFIG.enemyBulletHeight });
  }

  function resolvePlayerShots() {
    bullets = bullets.filter(bullet => {
      // Sweep vertically to avoid tunneling through thin sprites on slow frames.
      const sweep = { x: bullet.x, y: bullet.y, width: CONFIG.bulletWidth,
        height: Math.max(0, bullet.previousY - bullet.y) + CONFIG.bulletHeight };
      let target = null;
      for (const enemy of enemies) {
        if (overlaps(sweep, enemy) && (!target || enemy.y > target.y)) target = enemy;
      }
      if (!target) return bullet.y + CONFIG.bulletHeight > 0;
      enemies.splice(enemies.indexOf(target), 1);
      score += ENEMY_TYPES[target.type].points;
      explosions.push({ x: target.x + target.width / 2, y: target.y + target.height / 2,
        color: ENEMY_TYPES[target.type].color, remaining: CONFIG.explosionDuration });
      return false;
    });
  }

  function updateEnemyBullets(dt) {
    enemyBullets = enemyBullets.filter(bullet => {
      const oldY = bullet.y;
      bullet.y += CONFIG.enemyBulletSpeed * dt;
      if (overlaps({ ...bullet, y: oldY, height: bullet.height + bullet.y - oldY }, player)) {
        damagePlayer();
        return false;
      }
      return bullet.y < canvas.height;
    });
  }

  function setState(next) {
    state = next;
    held.clear();
    previousTime = null;
    status.textContent = { ready: 'Ready', active: 'Playing', paused: 'Paused', gameover: 'Game over' }[state];
    startButton.disabled = state === 'active' || state === 'gameover';
    startButton.textContent = state === 'paused' ? 'Resume' : 'Start game';
    pauseButton.disabled = state !== 'active';
    updateHUD();
  }

  function reset() {
    player.x = (canvas.width - player.width) / 2;
    player.y = canvas.height - CONFIG.playerBottomMargin - player.height;
    bullets = [];
    cooldownRemaining = 0;
    animationTime = 0;
    held.clear();
    previousTime = null;
    enemyBullets = [];
    explosions = [];
    score = 0;
    lives = CONFIG.playerLives;
    wave = 1;
    waveTimer = 0;
    invulnerabilityRemaining = 0;
    spawnWave();
    updateHUD();
  }

  function fire(age = 0) {
    bullets.push({
      x: player.x + (player.width - CONFIG.bulletWidth) / 2,
      y: player.y - CONFIG.bulletHeight - CONFIG.bulletSpeed * age,
      previousY: player.y - CONFIG.bulletHeight,
    });
  }

  function update(dt) {
    if (state !== 'active') return;
    animationTime += dt;
    explosions = explosions.filter(explosion => (explosion.remaining -= dt) > 0);
    invulnerabilityRemaining = Math.max(0, invulnerabilityRemaining - dt);
    if (waveTimer > 0) {
      waveTimer = Math.max(0, waveTimer - dt);
      if (waveTimer === 0) spawnWave();
      updateHUD();
      return;
    }
    const left = held.has('ArrowLeft') || held.has('KeyA');
    const right = held.has('ArrowRight') || held.has('KeyD');
    player.x = Math.max(0, Math.min(canvas.width - player.width,
      player.x + (Number(right) - Number(left)) * CONFIG.playerSpeed * dt));

    moveEnemies(dt);
    // Reaching the bottom ends the run even if a shot would hit this frame.
    if (enemies.some(enemy => enemy.y + enemy.height >= canvas.height)) {
      gameOver();
      return;
    }
    for (const bullet of bullets) {
      bullet.previousY = bullet.y;
      bullet.y -= CONFIG.bulletSpeed * dt;
    }
    // Preserve sub-frame remainder so sustained fire stays consistent at 30/60/144 Hz.
    if (held.has('Space')) {
      let shotTime = cooldownRemaining;
      while (shotTime <= dt) {
        fire(dt - shotTime);
        shotTime += CONFIG.firingCooldown;
      }
      cooldownRemaining = shotTime - dt;
    } else {
      cooldownRemaining = Math.max(0, cooldownRemaining - dt);
    }
    resolvePlayerShots();
    if (enemies.length === 0) {
      bullets = [];
      enemyBullets = [];
      cooldownRemaining = 0;
      wave++;
      waveTimer = CONFIG.waveAnnouncementDuration;
      updateHUD();
      return;
    }
    updateEnemyBullets(dt);
    if (state === 'active' && enemies.some(enemy => overlaps(enemy, player))) damagePlayer();
    if (state === 'active') enemyAttack(dt);
    updateHUD();
  }

  function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const alienSprite = ALIENS[Math.floor(animationTime / CONFIG.enemyAnimationDuration) % 2];
    for (const enemy of enemies) {
      context.fillStyle = ENEMY_TYPES[enemy.type].color;
      for (let row = 0; row < alienSprite.length; row++) {
        for (let column = 0; column < alienSprite[row].length; column++) {
          if (alienSprite[row][column] === 'X') context.fillRect(Math.round(enemy.x) + column * CONFIG.enemyPixelSize,
            Math.round(enemy.y) + row * CONFIG.enemyPixelSize, CONFIG.enemyPixelSize, CONFIG.enemyPixelSize);
        }
      }
    }
    for (const explosion of explosions) {
      context.fillStyle = explosion.color;
      const radius = 5 + (1 - explosion.remaining / CONFIG.explosionDuration) * 22;
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        context.fillRect(Math.round(explosion.x + Math.cos(angle) * radius), Math.round(explosion.y + Math.sin(angle) * radius), 3, 3);
      }
    }
    context.fillStyle = '#ff84ed';
    for (const bullet of enemyBullets) context.fillRect(Math.round(bullet.x), Math.round(bullet.y), bullet.width, bullet.height);
    const scale = CONFIG.playerPixelSize;
    const x = Math.round(player.x);
    const y = Math.round(player.y);
    if (state === 'active') {
      const flameLength = 2 + Math.floor(animationTime / CONFIG.engineFrameDuration) % 3;
      context.fillStyle = '#ff9e35';
      context.fillRect(x + 6 * scale, y + 8 * scale, scale, flameLength * scale);
      context.fillStyle = '#fff2b0';
      context.fillRect(x + 6 * scale, y + 8 * scale, scale, scale);
    }
    for (let row = 0; row < SHIP.length; row++) {
      for (let column = 0; column < SHIP[row].length; column++) {
        const pixel = SHIP[row][column];
        if (pixel === '.') continue;
        context.fillStyle = invulnerabilityRemaining > 0 && Math.floor(animationTime * 12) % 2 === 0
          ? '#466f79' : pixel === 'W' ? '#bdfff9' : '#00eddf';
        context.fillRect(x + column * scale, y + row * scale, scale, scale);
      }
    }
    context.fillStyle = '#fff';
    for (const bullet of bullets) {
      context.fillRect(Math.round(bullet.x), Math.round(bullet.y), CONFIG.bulletWidth, CONFIG.bulletHeight);
    }
  }

  window.addEventListener('keydown', event => {
    if (!movementKeys.has(event.code)) return;
    event.preventDefault();
    if (state === 'active') held.add(event.code);
  });
  window.addEventListener('keyup', event => {
    if (!movementKeys.has(event.code)) return;
    event.preventDefault();
    held.delete(event.code);
  });
  function loseFocus() {
    held.clear();
    if (state === 'active') setState('paused');
  }
  window.addEventListener('blur', loseFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loseFocus();
  });
  startButton.addEventListener('click', () => { if (state === 'ready' || state === 'paused') setState('active'); });
  pauseButton.addEventListener('click', () => setState('paused'));
  restartButton.addEventListener('click', () => { reset(); setState('active'); });

  function frame(timestamp) {
    // Discard long stalls rather than teleporting or emitting a backlog of shots.
    const dt = previousTime === null ? 0 : Math.min((timestamp - previousTime) / 1000, 0.1);
    previousTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  reset();
  requestAnimationFrame(frame);
})();
