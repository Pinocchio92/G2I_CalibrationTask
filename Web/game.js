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
    playerMaxHealth: 100,
    playerSpareLives: 2,
    enemyBulletDamage: 25,
    enemyContactDamage: 50,
    respawnSafeRadius: 150,
    invulnerabilityDuration: 1.5,
    enemyRows: 5,
    enemyColumns: 8,
    enemyPixelSize: 3,
    enemyColumnSpacing: 64,
    enemyRowSpacing: 42,
    enemyTop: 52,
    enemyBoundaryMargin: 16,
    enemySpeed: 30,
    enemySpeedGrowth: 0.1,
    enemySpeedMaxMultiplier: 2.5,
    diveSpeedGrowth: 0.08,
    diveSpeedMaxMultiplier: 2,
    enemySpawnDropPerWave: 12,
    enemySpawnPlayerGap: 180,
    enemyDownStep: 18,
    enemyAnimationDuration: 0.35,
    enemyFiringCooldown: 1.4,
    enemyCooldownReduction: 0.08,
    enemyMinFiringCooldown: 0.25,
    enemyBulletLimit: 4,
    enemyBulletSpeed: 240,
    enemyBulletWidth: 5,
    enemyBulletHeight: 12,
    explosionDuration: 0.3,
    sparkDuration: 0.12,
    waveAnnouncementDuration: 1.5,
    diveIntervalMin: 3,
    diveIntervalMax: 5,
    diveDownSpeed: 150,
    diveHorizontalSpeed: 180,
    diveSteeringResponse: 6,
    diveDirectionIntervalMin: 0.4,
    diveDirectionIntervalMax: 0.9,
    diveEdgeSteeringDistance: 40,
    diveFiringCooldown: 0.7,
    hunterFirstWave: 6,
    hunterBaseChance: 0.3,
    hunterChancePerWave: 0.05,
    hunterMaxChance: 0.6,
    hunterTrackingStrength: 2.5,
    hunterAcceleration: 420,
    hunterMaxSpeed: 230,
    hunterAnnouncementDuration: 2,
  });
  const HUNTER_SPRITE = [
    'X....X....X', '.X..XXX..X.', '..XXXXXXX..', '.XX..X..XX.',
    'XXXXXXXXXXX', '..XXXXXXX..', '.XX..X..XX.', 'XX.......XX',
  ];
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
  const healthDisplay = document.querySelector('#health');
  const healthFill = document.querySelector('#health-fill');
  const startHelp = document.querySelector('#start-help');
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
  let lives = CONFIG.playerSpareLives;
  let health = CONFIG.playerMaxHealth;
  let respawnCount = 0;
  let wave = 1;
  let direction = 1;
  let enemyFireTimer = CONFIG.enemyFiringCooldown;
  let invulnerabilityRemaining = 0;
  let waveTimer = 0;
  // The diver stays in enemies for rendering, collisions and wave accounting.
  let activeDiver = null;
  let diveTimer = 0;
  let hunterAnnounced = false;
  let hunterAnnouncementTimer = 0;
  const hunterChance = () => wave < CONFIG.hunterFirstWave ? 0 : Math.min(CONFIG.hunterMaxChance,
    CONFIG.hunterBaseChance + (wave - CONFIG.hunterFirstWave) * CONFIG.hunterChancePerWave);
  const randomBetween = (min, max) => min + Math.random() * (max - min);

  function clearDive() {
    if (activeDiver) enemies = enemies.filter(enemy => enemy !== activeDiver);
    activeDiver = null;
    diveTimer = 0;
  }

  function scheduleDive() {
    diveTimer = randomBetween(CONFIG.diveIntervalMin, CONFIG.diveIntervalMax);
  }

  function finishDive() {
    clearDive();
    scheduleDive();
  }

  function updateDive(dt) {
    if (!activeDiver) {
      diveTimer -= dt;
      if (diveTimer > 0 || !enemies.length) return;
      activeDiver = enemies[Math.floor(Math.random() * enemies.length)];
      activeDiver.hunter = hunterChance() > 0 && Math.random() < hunterChance();
      if (activeDiver.hunter && !hunterAnnounced) {
        hunterAnnounced = true;
        hunterAnnouncementTimer = CONFIG.hunterAnnouncementDuration;
      }
      const towardPlayer = Math.sign(player.x + player.width / 2 - activeDiver.x - activeDiver.width / 2);
      activeDiver.dive = {
        velocityX: 0,
        targetVelocityX: towardPlayer * CONFIG.diveHorizontalSpeed * diveSpeedMultiplier(),
        directionTimer: randomBetween(CONFIG.diveDirectionIntervalMin, CONFIG.diveDirectionIntervalMax),
        fireTimer: enemyFireInterval(CONFIG.diveFiringCooldown),
      };
      diveTimer = 0;
      return;
    }
    const enemy = activeDiver;
    const dive = enemy.dive;
    if (enemy.hunter) {
      // Tracking ends permanently once below the ship, even if the player respawns.
      if (enemy.y > player.y + player.height) dive.trackingEnded = true;
      const error = player.x + player.width / 2 - enemy.x - enemy.width / 2;
      const target = dive.trackingEnded ? 0 : Math.max(-CONFIG.hunterMaxSpeed,
        Math.min(CONFIG.hunterMaxSpeed, error * CONFIG.hunterTrackingStrength));
      const oldVelocity = dive.velocityX;
      const change = target - oldVelocity;
      const acceleration = Math.sign(change) * CONFIG.hunterAcceleration;
      const accelerationTime = Math.min(dt, Math.abs(change) / CONFIG.hunterAcceleration);
      dive.velocityX += acceleration * accelerationTime;
      enemy.x += oldVelocity * accelerationTime + 0.5 * acceleration * accelerationTime ** 2
        + dive.velocityX * (dt - accelerationTime);
      const maxX = canvas.width - enemy.width;
      enemy.x = Math.max(0, Math.min(maxX, enemy.x));
      if ((enemy.x === 0 && dive.velocityX < 0) || (enemy.x === maxX && dive.velocityX > 0)) dive.velocityX = 0;
      enemy.y += CONFIG.diveDownSpeed * diveSpeedMultiplier() * dt;
      if (enemy.y >= canvas.height) finishDive();
      return;
    }
    dive.directionTimer -= dt;
    if (dive.directionTimer <= 0) {
      dive.targetVelocityX = (Math.random() < 0.5 ? -1 : 1) * CONFIG.diveHorizontalSpeed * diveSpeedMultiplier();
      dive.directionTimer += randomBetween(CONFIG.diveDirectionIntervalMin, CONFIG.diveDirectionIntervalMax);
    }
    const maxX = canvas.width - enemy.width;
    if (enemy.x <= CONFIG.diveEdgeSteeringDistance) dive.targetVelocityX = CONFIG.diveHorizontalSpeed * diveSpeedMultiplier();
    else if (enemy.x >= maxX - CONFIG.diveEdgeSteeringDistance) dive.targetVelocityX = -CONFIG.diveHorizontalSpeed * diveSpeedMultiplier();
    // Exact exponential steering integration gives smooth, frame-independent turns.
    const decay = Math.exp(-CONFIG.diveSteeringResponse * dt);
    enemy.x += dive.targetVelocityX * dt + (dive.velocityX - dive.targetVelocityX) * (1 - decay) / CONFIG.diveSteeringResponse;
    dive.velocityX = dive.targetVelocityX + (dive.velocityX - dive.targetVelocityX) * decay;
    enemy.x = Math.max(0, Math.min(maxX, enemy.x));
    enemy.y += CONFIG.diveDownSpeed * diveSpeedMultiplier() * dt;
    if (enemy.y >= canvas.height) finishDive();
  }

  const enemySpeed = () => CONFIG.enemySpeed * Math.min(CONFIG.enemySpeedMaxMultiplier, 1 + (wave - 1) * CONFIG.enemySpeedGrowth);
  const diveSpeedMultiplier = () => Math.min(CONFIG.diveSpeedMaxMultiplier, 1 + (wave - 1) * CONFIG.diveSpeedGrowth);
  const enemyFireInterval = (base = CONFIG.enemyFiringCooldown) => Math.max(CONFIG.enemyMinFiringCooldown, base * (1 - (wave - 1) * CONFIG.enemyCooldownReduction));
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  function updateHUD() {
    scoreDisplay.textContent = String(score);
    // Reuse the player's pixel silhouette for the spare-ship icons.
    livesDisplay.innerHTML = Array.from({ length: lives }, () => `<svg class="spare-ship" viewBox="0 0 13 9" aria-hidden="true">${SHIP.flatMap((row, y) => [...row].map((pixel, x) => pixel === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1"/>`)).join('')}</svg>`).join('');
    livesDisplay.setAttribute('aria-label', `${lives} spare lives`);
    healthFill.style.width = `${100 * health / CONFIG.playerMaxHealth}%`;
    healthDisplay.setAttribute('aria-valuenow', String(health));
    healthDisplay.setAttribute('aria-valuemax', String(CONFIG.playerMaxHealth));
    startHelp.hidden = state !== 'ready';
    waveDisplay.textContent = String(wave);
    announcement.textContent = state === 'gameover' ? 'Game over — Restart to play again' : waveTimer > 0 ? `Wave ${wave}` : hunterAnnouncementTimer > 0 ? 'Hunters incoming!' : '';
  }

  function spawnWave() {
    clearDive();
    scheduleDive();
    const width = ALIENS[0][0].length * CONFIG.enemyPixelSize;
    const height = ALIENS[0].length * CONFIG.enemyPixelSize;
    const startX = (canvas.width - ((CONFIG.enemyColumns - 1) * CONFIG.enemyColumnSpacing + width)) / 2;
    const gap = Math.min(CONFIG.enemySpawnPlayerGap, canvas.height * 0.3);
    const availableHeight = Math.max(height, player.y - gap);
    const rowSpacing = Math.min(CONFIG.enemyRowSpacing, Math.max(0, (availableHeight - height) / Math.max(1, CONFIG.enemyRows - 1)));
    const formationHeight = height + rowSpacing * (CONFIG.enemyRows - 1);
    const top = Math.max(0, Math.min(CONFIG.enemyTop + (wave - 1) * CONFIG.enemySpawnDropPerWave, player.y - gap - formationHeight));
    enemies = [];
    for (let row = 0; row < CONFIG.enemyRows; row++) {
      for (let column = 0; column < CONFIG.enemyColumns; column++) {
        // A full 5x8 grid, with just four yellow commanders centered in the top row.
        const type = row >= 3 ? 'red' : row === 0 && column >= 2 && column <= 5 ? 'yellow' : 'green';
        enemies.push({ x: startX + column * CONFIG.enemyColumnSpacing, y: top + row * rowSpacing, width, height, column, type });
      }
    }
    direction = 1;
    enemyFireTimer = enemyFireInterval();
  }

  function gameOver() {
    if (state === 'gameover') return;
    clearDive();
    hunterAnnouncementTimer = 0;
    setState('gameover');
  }

  function damagePlayer(amount = CONFIG.enemyBulletDamage) {
    if (state !== 'active' || invulnerabilityRemaining > 0) return;
    health = Math.max(0, health - amount);
    invulnerabilityRemaining = CONFIG.invulnerabilityDuration;
    if (health > 0) return;
    if (lives === 0) { gameOver(); return; }
    lives--;
    health = CONFIG.playerMaxHealth;
    player.x = (canvas.width - player.width) / 2;
    player.y = canvas.height - CONFIG.playerBottomMargin - player.height;
    respawnCount++;
    // Clear incoming shots and nearby ships without awarding points.
    enemyBullets = [];
    const safeArea = { x: player.x - CONFIG.respawnSafeRadius, y: player.y - CONFIG.respawnSafeRadius,
      width: player.width + 2 * CONFIG.respawnSafeRadius, height: player.height + 2 * CONFIG.respawnSafeRadius };
    if (activeDiver && overlaps(activeDiver, safeArea)) finishDive();
    enemies = enemies.filter(enemy => !overlaps(enemy, safeArea));
  }

  function moveEnemies(dt) {
    const formation = enemies.filter(enemy => enemy !== activeDiver);
    if (!formation.length) return;
    const left = Math.min(...formation.map(enemy => enemy.x));
    const right = Math.max(...formation.map(enemy => enemy.x + enemy.width));
    const travel = direction * enemySpeed() * dt;
    const edge = direction > 0 ? canvas.width - CONFIG.enemyBoundaryMargin - right : CONFIG.enemyBoundaryMargin - left;
    const touchesEdge = direction > 0 ? travel >= edge : travel <= edge;
    const dx = touchesEdge ? edge : travel;
    for (const enemy of formation) {
      enemy.x += dx;
      if (touchesEdge) enemy.y += CONFIG.enemyDownStep;
    }
    // Clamp to the edge and turn away immediately: no repeated descent at one edge.
    if (touchesEdge) direction *= -1;
  }

  function enemyAttack(dt) {
    if (activeDiver) {
      const dive = activeDiver.dive;
      dive.fireTimer -= dt;
      if (dive.fireTimer <= 0) {
        dive.fireTimer += enemyFireInterval(CONFIG.diveFiringCooldown);
        if (activeDiver.y <= player.y + player.height) fireEnemyBullet(activeDiver);
      }
      return;
    }
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
    fireEnemyBullet(source);
  }

  function fireEnemyBullet(source) {
    if (enemyBullets.length >= CONFIG.enemyBulletLimit) return;
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
      if (target === activeDiver) finishDive();
      score += ENEMY_TYPES[target.type].points;
      explosions.push({ x: target.x + target.width / 2, y: target.y + target.height / 2,
        color: ENEMY_TYPES[target.type].color, remaining: CONFIG.explosionDuration });
      return false;
    });
  }

  function interceptBullets(dt) {
    const hits = [];
    for (const shot of bullets) {
      for (const hostile of enemyBullets) {
        if (shot.x >= hostile.x + hostile.width || shot.x + CONFIG.bulletWidth <= hostile.x) continue;
        const start = shot.startFraction || 0;
        const hostileStart = hostile.previousY + CONFIG.enemyBulletSpeed * dt * start;
        const relativeStart = shot.previousY - hostileStart;
        const relativeTravel = (shot.y - shot.previousY) - (hostile.y - hostileStart);
        const low = -CONFIG.bulletHeight;
        const high = hostile.height;
        let enter = 0;
        let exit = 1;
        if (relativeTravel === 0) {
          if (relativeStart < low || relativeStart > high) continue;
        } else {
          const a = (low - relativeStart) / relativeTravel;
          const b = (high - relativeStart) / relativeTravel;
          enter = Math.max(0, Math.min(a, b));
          exit = Math.min(1, Math.max(a, b));
          if (enter > exit) continue;
        }
        hits.push({ shot, hostile, time: start + enter * (1 - start) });
      }
    }
    const removed = new Set();
    for (const hit of hits.sort((a, b) => a.time - b.time)) {
      if (removed.has(hit.shot) || removed.has(hit.hostile)) continue;
      removed.add(hit.shot); removed.add(hit.hostile);
      explosions.push({ x: hit.hostile.x + hit.hostile.width / 2,
        y: hit.hostile.previousY + CONFIG.enemyBulletSpeed * dt * hit.time,
        color: '#fff2b0', remaining: CONFIG.sparkDuration, duration: CONFIG.sparkDuration, spark: true });
    }
    bullets = bullets.filter(bullet => !removed.has(bullet));
    enemyBullets = enemyBullets.filter(bullet => !removed.has(bullet));
  }

  function updateEnemyBullets() {
    const survivors = [];
    for (const bullet of enemyBullets) {
      const oldY = bullet.previousY;
      if (overlaps({ ...bullet, y: oldY, height: bullet.height + bullet.y - oldY }, player)) {
        const previousRespawns = respawnCount;
        damagePlayer();
        if (respawnCount !== previousRespawns) return; // Respawn already cleared all shots.
        continue;
      }
      if (bullet.y < canvas.height) survivors.push(bullet);
    }
    enemyBullets = survivors;
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
    lives = CONFIG.playerSpareLives;
    health = CONFIG.playerMaxHealth;
    respawnCount = 0;
    hunterAnnounced = false;
    hunterAnnouncementTimer = 0;
    wave = 1;
    waveTimer = 0;
    invulnerabilityRemaining = 0;
    spawnWave();
    updateHUD();
  }

  function fire(age = 0, dt = 0) {
    bullets.push({
      x: player.x + (player.width - CONFIG.bulletWidth) / 2,
      y: player.y - CONFIG.bulletHeight - CONFIG.bulletSpeed * age,
      previousY: player.y - CONFIG.bulletHeight,
      startFraction: dt > 0 ? 1 - age / dt : 0,
    });
  }

  function update(dt) {
    if (state !== 'active') return;
    animationTime += dt;
    hunterAnnouncementTimer = Math.max(0, hunterAnnouncementTimer - dt);
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
    if (enemies.some(enemy => enemy !== activeDiver && enemy.y + enemy.height >= canvas.height)) {
      gameOver();
      return;
    }
    updateDive(dt);
    for (const bullet of bullets) {
      bullet.previousY = bullet.y;
      bullet.startFraction = 0;
      bullet.y -= CONFIG.bulletSpeed * dt;
    }
    // Preserve sub-frame remainder so sustained fire stays consistent at 30/60/144 Hz.
    if (held.has('Space')) {
      let shotTime = cooldownRemaining;
      while (shotTime <= dt) {
        fire(dt - shotTime, dt);
        shotTime += CONFIG.firingCooldown;
      }
      cooldownRemaining = shotTime - dt;
    } else {
      cooldownRemaining = Math.max(0, cooldownRemaining - dt);
    }
    for (const bullet of enemyBullets) {
      bullet.previousY = bullet.y;
      bullet.y += CONFIG.enemyBulletSpeed * dt;
    }
    interceptBullets(dt);
    resolvePlayerShots();
    if (enemies.length === 0) {
      clearDive();
      bullets = [];
      enemyBullets = [];
      cooldownRemaining = 0;
      wave++;
      waveTimer = CONFIG.waveAnnouncementDuration;
      updateHUD();
      return;
    }
    updateEnemyBullets();
    if (state === 'active') {
      const contact = enemies.find(enemy => overlaps(enemy, player));
      if (activeDiver?.hunter && overlaps(activeDiver, player)) {
        finishDive(); // Consume the Hunter even while the player is invulnerable.
        damagePlayer(CONFIG.enemyContactDamage);
      } else if (contact) damagePlayer(CONFIG.enemyContactDamage);
    }
    if (state === 'active') enemyAttack(dt);
    updateHUD();
  }

  function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const alienSprite = ALIENS[Math.floor(animationTime / CONFIG.enemyAnimationDuration) % 2];
    for (const enemy of enemies) {
      const sprite = enemy.hunter ? HUNTER_SPRITE : alienSprite;
      context.fillStyle = enemy.hunter ? '#e64cff' : ENEMY_TYPES[enemy.type].color;
      for (let row = 0; row < sprite.length; row++) {
        for (let column = 0; column < sprite[row].length; column++) {
          if (sprite[row][column] === 'X') context.fillRect(Math.round(enemy.x) + column * CONFIG.enemyPixelSize,
            Math.round(enemy.y) + row * CONFIG.enemyPixelSize, CONFIG.enemyPixelSize, CONFIG.enemyPixelSize);
        }
      }
    }
    for (const explosion of explosions) {
      context.fillStyle = explosion.color;
      const radius = (explosion.spark ? 2 : 5) + (1 - explosion.remaining / (explosion.duration || CONFIG.explosionDuration)) * (explosion.spark ? 7 : 22);
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
