# Space Attack — Canvas 2D

Open `index.html` directly in a browser; no dependencies or build step are needed.
This is a standalone JavaScript and Canvas 2D project. `game.js` owns one animation loop and
registers inputs once. Start/resume/restart only change state.

## Test manually

1. Before clicking Start game, hold movement keys and Space: nothing should happen.
2. Start. Hold A/D or Left/Right: movement should be smooth. Release: immediate stop.
3. Hold both directions: stop. Release one: move in the remaining direction.
4. Hold against either edge: the entire ship stays inside the canvas.
5. Hold Space: white bullets leave the nose every 0.2 seconds and disappear above
   the canvas. Movement and Space should not scroll the page.
6. Pause: movement, bullets and flame freeze/disappear as appropriate. Resume:
   fresh key presses are required.
7. Switch tabs or windows while holding keys: the game pauses. Return and Resume:
   no stuck movement or shooting.
8. Move and shoot, then Restart: centered ship, no bullets, immediate shot available.
9. Resize the browser: the canvas keeps its aspect ratio and pixelated rendering.

Run automated checks from this folder: `node player.test.cjs`.
The tests simulate input, canvas drawing and frame timestamps, including 30/60/144 Hz.
They do not replace browser visual checks.
The automated browser preview was blocked by the tool's local-file URL policy;
manual browser verification remains required.

Tune `CONFIG` at the top of `game.js`: `playerSpeed`, `playerPixelSize` (integer
pixel-art scale), `bulletSpeed`, `bulletWidth`, `bulletHeight`, `firingCooldown`
(positive seconds), `playerBottomMargin`, and `engineFrameDuration`.
The ship dimensions derive from the sprite grid and pixel size. Keep the configured
ship smaller than the 960 × 600 logical play area. The idle state is `ready`;
`active` enables simulation, `paused` freezes it, and `gameover` requires Restart.

## Enemies, damage and waves

The centered 5 × 8 formation has red lower rows, green upper rows and four yellow
ships in the top row. A shared two-frame animation uses integer pixel rectangles.
The outermost surviving enemies determine the formation boundaries (16px inset).
Every boundary encounter reverses direction and descends 18px once.

Enemy attacks choose randomly among the bottommost survivors of nonempty columns.
Pink bullets are capped at four. Wave 1 starts at 30px/s and one firing opportunity
every 1.4 seconds. Each wave adds 7px/s (maximum 100) and subtracts 0.1 seconds
from the cooldown (minimum 0.45). These and all dimensions/timers are in CONFIG.

The minimal score system awards red 10, green 20 and yellow 30, once per kill.
The minimal damage system starts with three lives and grants 1.5 seconds of
blinking invulnerability after either a bullet hit or enemy contact. Hits during
invulnerability consume the bullet without losing another life. Zero lives or
an enemy touching the bottom ends the run. Restart resets everything.

Clearing a formation removes both bullet pools and displays the upcoming Wave N
for 1.5 seconds before spawning it. Simulation waits during this announcement;
pause and focus loss also pause the announcement timer. Lives and score carry
over to the next wave. The same single animation loop drives all systems.

## Enemy test checklist

- Start and watch the formation bounce: one descent per encounter on each side.
- Hold Space while moving: each white shot kills at most one alien; confirm
  red/green/yellow awards of 10/20/30 and a short pixel explosion.
- Watch pink shots originate from the lowest survivor in a column, with at most
  four on screen; they disappear offscreen or on contact with the player.
- Take a hit: one life lost, brief invulnerability; contact also causes damage.
  At zero lives (or a bottom breach), movement and shooting stop until Restart.
- Clear all enemies: bullets disappear, Wave 2 displays, then a faster formation
  appears. Pause during the announcement to check its timer freezes.
- Restart mid-wave and after game over: score 0, lives 3, wave 1, no old shots.

Automated tests cover formation layout, both boundaries, bottom-column selection,
bullet caps, swept collision and single scoring, invulnerability, game over,
wave transitions/difficulty limits, and the original player controls.
