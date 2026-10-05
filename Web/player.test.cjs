const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function boot(random = () => 0.99) {
  const listeners = {};
  const rectangles = [];
  const context = { fillStyle: '', fillRect(x, y, w, h) { rectangles.push({ color: this.fillStyle, x, y, w, h }); } };
  const elements = Object.fromEntries(['game', 'status', 'start', 'pause', 'restart', 'score', 'lives', 'wave', 'announcement', 'health', 'health-fill', 'start-help'].map(id => [id, {
    style: {}, setAttribute(name, value) { this[name] = value; }, width: 960, height: 600, getContext: () => context,
    addEventListener(type, fn) { this[type] = fn; },
  }]));
  let pending;
  let time = 0;
  const window = { addEventListener(type, fn) {
    assert.equal(listeners[type], undefined, `duplicate ${type} listener`);
    listeners[type] = fn;
  } };
  const document = { hidden: false, querySelector: selector => elements[selector.slice(1)],
    addEventListener(type, fn) { listeners[type] = fn; } };
  // Instrument only this test copy; no debug/cheat API is shipped to the browser.
  const source = fs.readFileSync(`${__dirname}/game.js`, 'utf8').replace(/\}\)\(\);\s*$/, `
    window.inspect = {
      get enemies() { return enemies; }, get enemyBullets() { return enemyBullets; },
      get bullets() { return bullets; }, get player() { return player; },
      get health() { return health; }, spawnWave, diveSpeedMultiplier, interceptBullets, get score() { return score; }, get lives() { return lives; },
      get wave() { return wave; }, get direction() { return direction; },
      get waveTimer() { return waveTimer; }, get state() { return state; },
      get explosions() { return explosions; }, get invulnerability() { return invulnerabilityRemaining; },
      get diver() { return activeDiver; }, get diveTimer() { return diveTimer; }, updateDive,
      hunterChance, get hunterNotice() { return hunterAnnouncementTimer; }, get config() { return CONFIG; }, enemyAttack, enemySpeed, enemyFireInterval,
      setWave(value) { wave = value; }, moveEnemies, damagePlayer, update,
    };
  })();`);
  vm.runInNewContext(source, {
    window, document, Math: Object.assign(Object.create(Math), { random }),
    requestAnimationFrame(fn) { assert.equal(pending, undefined, 'duplicate loop'); pending = fn; },
  });
  const step = (seconds = 0) => {
    time += seconds * 1000;
    rectangles.length = 0;
    const fn = pending;
    pending = undefined;
    fn(time);
  };
  const key = (code, down = true) => {
    let prevented = false;
    listeners[down ? 'keydown' : 'keyup']({ code, preventDefault() { prevented = true; } });
    assert.ok(prevented, `${code} must prevent scrolling`);
  };
  const shipX = () => Math.min(...rectangles.filter(r => r.color === '#00eddf').map(r => r.x));
  const bullets = () => rectangles.filter(r => r.color === '#fff');
  step();
  return { elements, listeners, document, key, step, shipX, bullets, sim: window.inspect,
    start() { elements.start.click(); step(); },
    advance(seconds, hz = 60) { for (let i = 0; i < Math.round(seconds * hz); i++) step(1 / hz); },
  };
}

test('active-only movement, opposing directions, key release and bounds', () => {
  const g = boot();
  const center = g.shipX();
  g.key('ArrowRight'); g.advance(1); assert.equal(g.shipX(), center);
  g.start(); g.key('KeyD'); g.advance(0.5); assert.equal(g.shipX(), center + 180);
  g.key('ArrowLeft'); g.advance(0.5); assert.equal(g.shipX(), center + 180);
  g.key('KeyD', false); g.advance(0.5); assert.equal(g.shipX(), center);
  g.key('ArrowLeft', false); g.advance(0.5); assert.equal(g.shipX(), center);
  g.key('KeyA'); g.advance(3); assert.equal(g.shipX(), 0);
  g.key('KeyA', false); g.key('ArrowRight'); g.advance(3); assert.equal(g.shipX(), 960 - 52);
});

test('movement speed agrees at 30, 60 and 144 fps', () => {
  for (const hz of [30, 60, 144]) {
    const g = boot(); g.start(); g.key('KeyD'); g.advance(0.5, hz);
    assert.equal(g.shipX(), 634);
  }
});

test('held fire uses cooldown, removes offscreen bullets and resets on restart', () => {
  const g = boot(); g.key('Space'); g.advance(0.5); assert.equal(g.bullets().length, 0);
  g.start(); g.key('Space'); g.step(); assert.equal(g.bullets().length, 1);
  assert.equal(g.bullets()[0].x, 479);
  g.advance(0.1); assert.equal(g.bullets().length, 1);
  g.advance(0.15); assert.equal(g.bullets().length, 2);
  g.key('Space', false); g.advance(1); assert.equal(g.bullets().length, 0);
  g.key('Space'); g.key('KeyD'); g.advance(0.1);
  g.elements.restart.click(); g.step();
  assert.equal(g.shipX(), 454); assert.equal(g.bullets().length, 0);
  g.key('Space'); g.step(); assert.equal(g.bullets().length, 1);
});

test('pause and focus loss stop simulation and clear held inputs', () => {
  const g = boot(); g.start(); g.key('KeyD'); g.key('Space'); g.advance(0.1);
  const x = g.shipX(); const bulletY = g.bullets()[0].y;
  g.listeners.blur(); g.advance(0.5);
  assert.equal(g.elements.status.textContent, 'Paused');
  assert.equal(g.shipX(), x); assert.equal(g.bullets()[0].y, bulletY);
  g.start(); g.advance(0.1); assert.equal(g.shipX(), x);
  g.elements.pause.click(); g.key('KeyA'); g.advance(0.5); assert.equal(g.shipX(), x);
  g.start(); g.document.hidden = true; g.listeners.visibilitychange();
  assert.equal(g.elements.status.textContent, 'Paused');
});

test('formation is centered 5x8 with four yellow ships and reverses only once at either edge', () => {
  const g = boot(); const s = g.sim;
  assert.equal(s.enemies.length, 40);
  assert.equal(s.enemies.filter(e => e.type === 'yellow').length, 4);
  assert.equal(s.enemies.filter(e => e.type === 'red').length, 16);
  assert.equal(Math.min(...s.enemies.map(e => e.x)), 960 - Math.max(...s.enemies.map(e => e.x + e.width)));
  const shift = 944 - Math.max(...s.enemies.map(e => e.x + e.width));
  s.enemies.forEach(e => e.x += shift);
  const y = s.enemies[0].y;
  s.moveEnemies(0.1); assert.equal(s.direction, -1); assert.equal(s.enemies[0].y, y + 18);
  s.moveEnemies(0.1); assert.equal(s.enemies[0].y, y + 18);
  const left = Math.min(...s.enemies.map(e => e.x));
  s.enemies.forEach(e => e.x -= left - 16);
  s.moveEnemies(0.1); assert.equal(s.direction, 1); assert.equal(s.enemies[0].y, y + 36);
  s.moveEnemies(0.1); assert.equal(s.enemies[0].y, y + 36);
});

test('enemy firing selects the lowest survivor, honors shared timer and bullet cap', () => {
  const g = boot(); const s = g.sim; g.start();
  s.enemies.splice(s.enemies.findIndex(e => e.column === 7 && e.type === 'red' && e.y === 220), 1);
  const source = s.enemies.filter(e => e.column === 7).sort((a, b) => b.y - a.y)[0];
  s.enemyAttack(1.4);
  assert.equal(s.enemyBullets.length, 1);
  assert.equal(s.enemyBullets[0].y, source.y + source.height);
  s.enemyAttack(0.1); assert.equal(s.enemyBullets.length, 1);
  for (let i = 0; i < 10; i++) s.enemyAttack(1.4);
  assert.equal(s.enemyBullets.length, 4);
  s.enemyBullets.forEach(b => b.y = 601);
  s.update(0); assert.equal(s.enemyBullets.length, 0);
});

test('swept player shots destroy one nearest target and score each color exactly once', () => {
  const g = boot(); const s = g.sim; g.start();
  for (const [type, points] of [['red', 10], ['green', 20], ['yellow', 30]]) {
    s.enemies.splice(0, s.enemies.length,
      { x: 100, y: 180, width: 33, height: 24, column: 0, type },
      { x: 100, y: 140, width: 33, height: 24, column: 0, type });
    const before = s.score;
    s.bullets.push({ x: 110, y: 210 });
    s.update(0.1);
    assert.equal(s.score, before + points); assert.equal(s.enemies.length, 1);
    assert.equal(s.enemies[0].y, 140); assert.equal(s.bullets.length, 0);
    s.update(0); assert.equal(s.score, before + points);
    assert.ok(s.explosions.length > 0);
  }
});

test('bullet and contact damage share invulnerability; death and bottom breach end play', () => {
  const g = boot(); const s = g.sim; g.start();
  const bullet = () => ({ x: s.player.x + 10, y: s.player.y - 30, width: 5, height: 12 });
  s.enemyBullets.push(bullet(), bullet()); s.update(0.1);
  assert.equal(s.lives, 2); assert.equal(s.enemyBullets.length, 0);
  s.enemies[0].x = s.player.x; s.enemies[0].y = s.player.y;
  s.update(0); assert.equal(s.lives, 2);
  s.enemies[0].y = 52; s.update(1.5);
  s.damagePlayer(100); assert.equal(s.lives, 1);
  s.update(1.5); s.damagePlayer(100); assert.equal(s.lives, 0); s.update(1.5); s.damagePlayer(100); assert.equal(s.state, 'gameover');
  s.damagePlayer(); assert.equal(s.lives, 0);
  const x = s.enemies[0].x; s.update(1); assert.equal(s.enemies[0].x, x);
  g.elements.start.click(); assert.equal(s.state, 'gameover');
  g.elements.restart.click();
  s.enemies[0].y = 600 - s.enemies[0].height;
  s.update(0); assert.equal(s.state, 'gameover');
  assert.equal(s.lives, 2);
});

test('final kill clears both bullet pools, announces a wave, pauses its timer and caps difficulty', () => {
  const g = boot(); const s = g.sim; g.start();
  s.enemies.splice(0, s.enemies.length, { x: 100, y: 100, width: 33, height: 24, column: 0, type: 'yellow' });
  s.bullets.push({ x: 110, y: 110 }, { x: 800, y: 400 });
  s.enemyBullets.push({ x: 800, y: 300, width: 5, height: 12 });
  s.update(0);
  assert.equal(s.wave, 2); assert.equal(s.score, 30);
  assert.equal(s.bullets.length, 0); assert.equal(s.enemyBullets.length, 0);
  assert.equal(g.elements.announcement.textContent, 'Wave 2');
  g.elements.pause.click(); const timer = s.waveTimer; s.update(2); assert.equal(s.waveTimer, timer);
  g.start(); s.update(1.5); assert.equal(s.enemies.length, 40);
  assert.equal(s.waveTimer, 0); assert.equal(s.enemySpeed(), 33); assert.ok(Math.abs(s.enemyFireInterval() - 1.288) < 1e-9);
  s.setWave(100); assert.equal(s.enemySpeed(), 75); assert.equal(s.enemyFireInterval(), 0.25);
  g.elements.restart.click();
  assert.equal(s.wave, 1); assert.equal(s.score, 0); assert.equal(s.lives, 2);
  assert.equal(s.enemySpeed(), 30); assert.equal(s.enemyFireInterval(), 1.4);
  assert.equal(s.explosions.length, 0); assert.equal(s.invulnerability, 0);
  assert.equal(s.direction, 1); assert.equal(s.enemies.length, 40);
});

test('dive detaches one enemy, freezes on pause and only the diver shoots', () => {
  const g = boot(); const s = g.sim; g.start();
  assert.ok(s.diveTimer >= 3 && s.diveTimer <= 5);
  s.updateDive(s.diveTimer);
  const diver = s.diver; const x = diver.x; const y = diver.y;
  assert.ok(diver); assert.equal(s.enemies.filter(e => e === diver).length, 1);
  s.moveEnemies(0.1); assert.equal(diver.x, x); assert.equal(diver.y, y);
  s.enemyAttack(0.7); assert.equal(s.enemyBullets.length, 1);
  assert.equal(s.enemyBullets[0].x, diver.x + (diver.width - 5) / 2);
  s.enemyAttack(0.1); assert.equal(s.enemyBullets.length, 1);
  const directionTimer = diver.dive.directionTimer;
  g.elements.pause.click(); s.update(1);
  assert.equal(diver.dive.directionTimer, directionTimer); assert.equal(diver.y, y);
  g.start(); s.updateDive(0.1);
  assert.equal(diver.y, y + 15); assert.ok(diver.x < x);
  assert.ok(Math.abs(diver.dive.velocityX) < s.config.diveHorizontalSpeed);
  diver.y = s.player.y + s.player.height + 1;
  s.enemyAttack(1); assert.equal(s.enemyBullets.length, 1);
});

test('diver stays within edges, descends and escapes without score or game over', () => {
  const g = boot(); const s = g.sim; g.start(); s.updateDive(s.diveTimer);
  const diver = s.diver;
  diver.x = 0; diver.dive.velocityX = -180;
  s.updateDive(0.1); assert.ok(diver.x >= 0); assert.ok(diver.dive.targetVelocityX > 0);
  diver.x = 960 - diver.width; diver.dive.velocityX = 180;
  s.updateDive(0.1); assert.ok(diver.x + diver.width <= 960); assert.ok(diver.dive.targetVelocityX < 0);
  diver.y = 590; s.update(0.1);
  assert.equal(s.diver, null); assert.equal(s.enemies.length, 39);
  assert.equal(s.score, 0); assert.equal(s.state, 'active');
  assert.ok(s.diveTimer >= 3 && s.diveTimer <= 5);
  s.enemyAttack(2); assert.equal(s.enemyBullets.length, 1);
});

test('diver reuses kill scoring and contact invulnerability; lifecycle clears dive state', () => {
  const g = boot(); const s = g.sim; g.start(); s.updateDive(s.diveTimer);
  const diver = s.diver;
  diver.x = s.player.x; diver.y = s.player.y;
  s.update(0); assert.equal(s.lives, 2);
  s.update(0); assert.equal(s.lives, 2);
  s.bullets.push({ x: diver.x + 10, y: diver.y }, { x: diver.x + 10, y: diver.y });
  s.update(0); assert.equal(s.diver, null); assert.equal(s.score, 10);
  s.update(0); assert.equal(s.score, 10);
  s.updateDive(s.diveTimer); assert.ok(s.diver);
  g.elements.restart.click(); assert.equal(s.diver, null); assert.equal(s.enemies.length, 40);
  assert.ok(s.diveTimer >= 3 && s.diveTimer <= 5);
  s.updateDive(s.diveTimer);
  s.enemies.find(e => e !== s.diver).y = 600;
  s.update(0); assert.equal(s.state, 'gameover'); assert.equal(s.diver, null); assert.equal(s.diveTimer, 0);
});

test('last living diver holds wave open, then escape transitions without points', () => {
  const g = boot(); const s = g.sim; g.start(); s.updateDive(s.diveTimer);
  const diver = s.diver;
  s.enemies.splice(0, s.enemies.length, diver);
  s.update(0); assert.equal(s.wave, 1); assert.equal(s.waveTimer, 0);
  diver.y = 600; s.update(0);
  assert.equal(s.wave, 2); assert.equal(s.score, 0);
  assert.equal(s.diver, null); assert.equal(s.diveTimer, 0);
  assert.equal(s.enemyBullets.length, 0);
});


test('wave scaling derives from bases, clamps spawn height and resets', () => {
  const g = boot(); const s = g.sim;
  s.setWave(2); s.spawnWave();
  assert.equal(s.enemySpeed(), 33); assert.equal(s.diveSpeedMultiplier(), 1.08);
  assert.ok(Math.abs(s.enemyFireInterval(0.7) - 0.644) < 1e-9);
  assert.equal(Math.min(...s.enemies.map(e => e.y)), 64);
  s.setWave(99); s.spawnWave();
  assert.equal(s.enemySpeed(), 75); assert.equal(s.diveSpeedMultiplier(), 2);
  assert.equal(s.enemyFireInterval(0.7), 0.25);
  assert.ok(Math.max(...s.enemies.map(e => e.y + e.height)) <= s.player.y - 180);
  g.elements.game.height = 360; s.player.y = 292; s.spawnWave();
  assert.ok(Math.max(...s.enemies.map(e => e.y + e.height)) <= s.player.y - 108 + 1e-9);
  g.elements.restart.click(); assert.equal(s.wave, 1); assert.equal(s.health, 100);
  assert.equal(s.lives, 2); assert.equal(s.enemySpeed(), 30); assert.equal(s.diveSpeedMultiplier(), 1);
});

test('health damage, invulnerable impacts and safe spare-life respawn', () => {
  const g = boot(); const s = g.sim; g.start();
  const hit = () => s.enemyBullets.push({ x: s.player.x + 10, y: s.player.y, width: 5, height: 12 });
  hit(); s.update(0); assert.equal(s.health, 75); assert.equal(s.lives, 2);
  hit(); s.update(0); assert.equal(s.health, 75); assert.equal(s.enemyBullets.length, 0);
  s.update(1.5);
  s.enemies[0].x = s.player.x; s.enemies[0].y = s.player.y;
  s.update(0); assert.equal(s.health, 25); assert.equal(s.lives, 2);
  s.enemies[0].y = 52; s.update(1.5);
  s.player.x = 200;
  const near = s.enemies[0]; near.x = 460; near.y = 500;
  hit(); s.update(0);
  assert.equal(s.health, 100); assert.equal(s.lives, 1); assert.equal(s.player.x, 454);
  assert.equal(s.enemyBullets.length, 0); assert.ok(!s.enemies.includes(near));
  assert.ok(s.invulnerability > 0); assert.equal(s.score, 0);
  assert.equal(g.elements['health-fill'].style.width, '100%');
  assert.equal(g.elements.lives['aria-label'], '1 spare lives');
});

test('fast crossing bullets intercept once, with no score or same-frame player damage', () => {
  const g = boot(); const s = g.sim; g.start();
  const x = s.player.x + 10;
  s.bullets.push({ x, y: 570 });
  s.enemyBullets.push({ x, y: 515, width: 5, height: 12 });
  s.update(0.1);
  assert.equal(s.bullets.length, 0); assert.equal(s.enemyBullets.length, 0);
  assert.equal(s.health, 100); assert.equal(s.score, 0);
  assert.ok(s.explosions.some(e => e.spark));
  s.bullets.push({ x: 100, y: 400 });
  s.enemyBullets.push({ x: 100, y: 360, width: 5, height: 12 }, { x: 100, y: 350, width: 5, height: 12 });
  s.update(0.1); assert.equal(s.bullets.length, 0); assert.equal(s.enemyBullets.length, 1);
  g.elements.restart.click(); assert.equal(s.explosions.length, 0); assert.equal(s.health, 100);
});


test('Hunters unlock at wave 6, chance caps, and appearance begins on selection', () => {
  const g = boot(() => 0); const s = g.sim; g.start();
  s.setWave(5); assert.equal(s.hunterChance(), 0); s.updateDive(s.diveTimer);
  assert.equal(s.diver.hunter, false);
  g.elements.restart.click(); s.setWave(6); assert.equal(s.hunterChance(), 0.3);
  s.updateDive(s.diveTimer); assert.equal(s.diver.hunter, true);
  s.update(0); assert.equal(g.elements.announcement.textContent, 'Hunters incoming!');
  s.setWave(7); assert.equal(s.hunterChance(), 0.35);
  s.setWave(100); assert.equal(s.hunterChance(), 0.6);
  g.elements.restart.click(); assert.equal(s.hunterChance(), 0); assert.equal(s.hunterNotice, 0);
});

test('Hunter tracks smoothly, stops below player, pauses, and retains exclusive shooting', () => {
  const g = boot(() => 0); const s = g.sim; g.start(); s.setWave(6); s.updateDive(s.diveTimer);
  const h = s.diver; h.x = 300; s.player.x = 600;
  s.updateDive(0.1); assert.ok(h.dive.velocityX > 0); assert.ok(h.dive.velocityX <= 42);
  assert.ok(h.x > 300 && h.x < 305);
  s.player.x = 0; s.updateDive(0.1); assert.ok(Math.abs(h.dive.velocityX) < 1e-9);
  s.enemyAttack(s.enemyFireInterval(0.7)); assert.equal(s.enemyBullets.length, 1);
  assert.equal(s.enemyBullets[0].x, h.x + (h.width - 5) / 2);
  const y = h.y; const timer = s.hunterNotice; g.elements.pause.click(); s.update(1);
  assert.equal(h.y, y); assert.equal(s.hunterNotice, timer);
  g.start(); h.y = s.player.y + s.player.height + 1; s.updateDive(0.01);
  assert.equal(h.dive.trackingEnded, true);
  s.enemyAttack(1); assert.equal(s.enemyBullets.length, 1);
});

test('Hunter contact consumes it without score, even while invulnerable; shooting keeps original score', () => {
  for (const immune of [false, true]) {
    const g = boot(() => 0); const s = g.sim; g.start(); s.setWave(6); s.updateDive(s.diveTimer);
    if (immune) s.damagePlayer(25);
    const health = s.health;
    s.diver.x = s.player.x; s.diver.y = s.player.y; s.update(0);
    assert.equal(s.diver, null); assert.equal(s.score, 0);
    assert.equal(s.health, immune ? health : health - 50);
  }
  const g = boot(() => 0); const s = g.sim; g.start(); s.setWave(6); s.updateDive(s.diveTimer);
  const h = s.diver; h.x = 100; h.y = 400; const type = h.type;
  s.bullets.push({ x: 110, y: 410 }, { x: 110, y: 410 }); s.update(0);
  assert.equal(s.diver, null); assert.equal(s.score, {red:10, green:20, yellow:30}[type]);
});
