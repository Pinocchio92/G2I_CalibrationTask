# Space Attack — Canvas 2D

Open index.html in a browser. No build step or dependencies are required.
Move with A/D or Left/Right; hold Space to fire. Start, Pause/Resume and Restart
reuse one animation loop. Focus loss pauses play and clears held keys.

## Health and HUD

The HUD is below the 960 × 600 collision canvas: red E, green health bar, green
spare-ship icons and red wave number. It scales with the page. Start with 100
health and two spare ships. Enemy shots do 25 damage; contact does 50, followed
by 1.5 seconds of invulnerability. Impacting bullets disappear even while immune.
At zero health, consume a spare, restore 100 health and recenter. Respawning clears
all enemy shots and enemies within a 150px expanded player rectangle, without
points. With no spares, zero health ends the run. Formation bottom breach also
ends it. The initial screen explains health and spares.

## Difficulty

For n = wave - 1, each value derives from CONFIG's base value:
- Formation speed: base × min(2.5, 1 + 0.10n).
- Dive horizontal and downward speed: base × min(2, 1 + 0.08n).
- Formation/diver cooldown: max(0.25, respective base × (1 - 0.08n)).
- Formation top: base + 12n, clamped to leave 180px above the player.
  Smaller logical canvases use a gap of min(180, height × 0.3) and compress row
  spacing if necessary. Browser resizing scales the fixed logical canvas.

The 5 × 8 formation awards red 10, green 20 and yellow 30 points. One diver starts
after 3–5 seconds; only it may fire while diving. Existing bullets stay active.
The next dive wait starts after its destruction or escape. Escapes award no points.
Waves wait for every enemy, including the diver. Clearing a wave removes shots,
then shows Wave N for 1.5 seconds. Health, spares and score carry into the next wave.

## Bullet interception

Player/enemy bullet collisions use relative swept vertical motion and chronological
pair matching. A bullet can be consumed only once. Interceptions precede damage
and enemy-hit resolution, create a brief spark and award no score. A player shot
created partway through a frame only checks collisions after its spawn time.

## Testing

Run from Web: node player.test.cjs
The 16 automated tests cover controls, collisions, dive lifecycle, health,
invulnerability, respawning, difficulty limits, smaller-canvas spawn clearance,
interception, waves and restart. Browser visual verification remains manual.

Manual checklist:
1. Reach wave 2: faster/lower formation and faster dives; shorter shooting waits.
2. Take a pink bullet: health drops by 25; touch an enemy: drops by 50.
3. Exhaust health: one green icon disappears, full bar returns, player recenters.
4. Shoot pink bullets: both vanish with a spark, no points and no impact damage.
5. Restart after damage/a dive/a wave: score 0, health 100, two spares, wave 1,
   no old bullets/effects and original movement/firing difficulty.
6. Resize and pause: HUD stays below the canvas; simulation and timers freeze.

## Hunters (wave 6+)

Each new diver has a 30% Hunter chance on wave 6, plus five percentage points per
later wave, capped at 60%. The first actual Hunter displays Hunters incoming!
for two active seconds. Hunters use a magenta silhouette while retaining their
original score value. Normal divers retain random weaving.

Hunter tracking strength is 2.5, acceleration 420px/s², and maximum horizontal
speed 230px/s (player speed is 360px/s). These CONFIG values deliberately keep
tracking dodgeable. Hunters track the current player position until below the
ship, then stop tracking permanently and decelerate horizontally while descending.
Only the current diver fires, using the wave-scaled diver cooldown. Contact consumes
a Hunter even during invulnerability; vulnerable contact deals 50 damage without
points. Shot-down Hunters retain their original type's score. Escapes grant none.

Hunter checks: no magenta enemies during waves 1–5; from wave 6, observe dives
until one converts. Change movement direction and dodge its gradual turn. Confirm
it keeps descending after missing you, and only it fires while diving. Pause it,
resume, and restart to check freezing and cleanup. The suite now has 19 tests.
