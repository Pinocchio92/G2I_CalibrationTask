const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function boot() {
  const listeners = {};
  const rectangles = [];
  const context = { fillStyle: '', fillRect(x, y, w, h) { rectangles.push({ color: this.fillStyle, x, y, w, h }); } };
  const elements = Object.fromEntries(['game', 'status', 'start', 'pause', 'restart', 'score', 'lives', 'wave', 'announcement'].map(id => [id, {
    width: 960, height: 600, getContext: () => context,
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
      get score() { return score; }, get lives() { return lives; },
      get wave() { return wave; }, get direction() { return direction; },
      get waveTimer() { return waveTimer; }, get state() { return state; },
      get explosions() { return explosions; }, get invulnerability() { return invulnerabilityRemaining; },
      get config() { return CONFIG; }, enemyAttack, enemySpeed, enemyFireInterval,
      setWave(value) { wave = value; }, moveEnemies, damagePlayer, update,
    };
  })();`);
  vm.runInNewContext(source, {
    window, document, Math: Object.assign(Object.create(Math), { random: () => 0.99 }),
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
  s.damagePlayer(); assert.equal(s.lives, 1);
  s.update(1.5); s.damagePlayer(); assert.equal(s.state, 'gameover');
  s.damagePlayer(); assert.equal(s.lives, 0);
  const x = s.enemies[0].x; s.update(1); assert.equal(s.enemies[0].x, x);
  g.elements.start.click(); assert.equal(s.state, 'gameover');
  g.elements.restart.click();
  s.enemies[0].y = 600 - s.enemies[0].height;
  s.update(0); assert.equal(s.state, 'gameover');
  assert.equal(s.lives, 3);
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
  assert.equal(s.waveTimer, 0); assert.equal(s.enemySpeed(), 37); assert.ok(Math.abs(s.enemyFireInterval() - 1.3) < 1e-9);
  s.setWave(100); assert.equal(s.enemySpeed(), 100); assert.equal(s.enemyFireInterval(), 0.45);
  g.elements.restart.click();
  assert.equal(s.wave, 1); assert.equal(s.score, 0); assert.equal(s.lives, 3);
  assert.equal(s.enemySpeed(), 30); assert.equal(s.enemyFireInterval(), 1.4);
  assert.equal(s.explosions.length, 0); assert.equal(s.invulnerability, 0);
  assert.equal(s.direction, 1); assert.equal(s.enemies.length, 40);
});
