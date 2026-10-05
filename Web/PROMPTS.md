# Project prompt history

User requests from this conversation in chronological order. Original wording is preserved, including typos and the truncated diving prompt. Automatic browser/environment context and attachment metadata are omitted; reference images were supplied with the player and enemy requests.

## 1. Analyze project

analyze the project folder

## 2. Set up web-ready scene

ok setup a new game scene optimal for web platform. 

## 3. Player spacecraft, controls and shooting

now create the player spacecraft and its keyboard controls for our Space Attack browser game using JavaScript and Canvas 2D.

Appearance:

- Draw a cyan pixel-art spacecraft inspired by the reference screenshot, with a pointed center, symmetrical wings and a small animated engine flame.
- Position it near the bottom center of the play area.
- Keep its pixel edges sharp when scaling.

Movement:

- Use Left/Right arrows or A/D for horizontal movement.
- Move smoothly while a key is held, using delta time for consistent speed across frame rates.
- Stop immediately when the key is released.
- If both directions are held, stop horizontal movement.
- Keep the entire spacecraft within the play area.
- Prevent the movement keys and Space from scrolling the page.
- Clear held inputs when the window loses focus to prevent stuck movement.

Shooting:

- Hold Space to fire narrow white bullets upward from the spacecraft’s nose.
- Use a configurable firing cooldown, initially 0.2 seconds.
- Remove bullets when they leave the screen.

Integration:

- Enable movement and shooting only during active gameplay.
- Reset the spacecraft’s position, bullets and firing cooldown when restarting.
- Keep player speed, size, bullet speed and firing cooldown in clearly named configuration values.
- Integrate with the existing game loop and input handling without creating duplicate loops or listeners.
- Display “Move: A/D or ←/→ | Fire: Hold Space” below the play area.

Implement this directly in the project. Limit this step to the player, controls and shooting. Append this prompt verbatim to PROMPTS.md and tell me how to test the result.

## 4. Remove Unity project

remove the unity prject ad related files.. only maitaing the web folder 

## 5. Enemy formations and waves

Create the enemies for our Space Attack browser game using JavaScript and Canvas 2D. Integrate with the existing player, bullets and game loop.

Appearance and formation:

- Draw crisp pixel-art alien spacecraft inspired by the reference screenshot.
- Use red enemies in the lower rows, green enemies above them and a few yellow enemies at the top.
- Start with a centered formation of 5 rows and 8 columns, with consistent spacing.
- Add a simple two-frame sprite animation.

Movement:

- Move the formation horizontally as a group using delta time.
- When the outermost living enemy reaches a screen boundary, reverse direction and move the formation down one small step.
- Trigger the reversal and downward step only once per boundary encounter.
- Keep movement speed and downward step size configurable.

Attacks:

- Randomly select a bottommost living enemy from a column to fire a bullet downward.
- Use a shared firing cooldown and limit active enemy bullets.
- Make enemy bullets visually distinct from player bullets.
- Remove bullets when they leave the play area.

Collisions and scoring:

- A player bullet destroys one enemy and is then removed.
- Award points exactly once: red 10, green 20, yellow 30.
- Add a brief pixel explosion when an enemy is destroyed.
- Connect enemy bullets and enemy/player contact to the existing player damage system, respecting invulnerability.
- If an enemy reaches the bottom of the play area, trigger game over once.

Waves:

- When all enemies are destroyed, clear remaining bullets and show a brief “Wave N” announcement before spawning the next formation.
- Increase movement speed and firing frequency gradually each wave, with sensible maximum limits.
- Keep the first wave approachable.

Integration:

- Update enemies and bullets only during active gameplay.
- Reset enemies, bullets, timers and wave difficulty on restart.
- Reuse the existing game loop without adding duplicate animation loops.
- If a required score or damage system is missing, add the minimal implementation and explain it.

Implement this directly in the project. Append this prompt verbatim to PROMPTS.md and give me a short checklist to test movement, shooting, collisions, scoring and wave transitions.

## 6. Move into Git repository

can you move everything in side G2I\_CalibrationTask folder I setup the git repo there 

## 7. Diving attacks

Add a diving enemy attack behavior to the existing Space Attack game.

Dive selection:

- After a random interval of 3–5 seconds, select one living enemy from the formation to dive toward the player.
- Allow only one diving enemy at a time.
- Keep the remaining enemies moving in formation.
- Start the next dive timer after the current diver is destroyed or leaves the screen.

Diving movement:

- Detach the selected enemy from formation movement.
- Move it downward toward the player’s vertical position while weaving horizontally.
- Initially steer toward the player’s horizontal position.
- During the dive, choose a new random horizontal direction every 0.4–0.9 seconds.
- Smoothly transition horizontal velocity when changing direction to avoid teleporting or jitter.
- Keep the enemy inside the horizontal play-area boundaries, steering inward at the edges.
- Maintain downward movement so the dive always finishes.
- Use delta time and keep movement speeds and direction-change intervals configurable.

Shooting:

- While an enemy is diving, ONLY that enemy may fire new bullets. All formation enemies must stop firing.
- Let the diving enemy shoot downward using a configurable cooldown, initially 0.7 seconds.
- Stop it firing once it passes below the player.
- Existing bullets remain active.
- When no enemy is diving, resume the normal formation shooting behavior.

Collisions and lifecycle:

- Reuse the existing bullet collisions, score awards and player damage system.
- Respect player invulnerability during contact damage.
- If the diver is destroyed, award points exactly once and clear the active-diver reference.
- If it escapes below the screen, remove it without awarding points or triggering the formation’s bottom-boundary game-over rule.
- Count the diver as a living enemy: the wave ends only when both the formation and the diver are gone.
- Ensure the diver is updated and rendered exactly once per frame.
- Clear all dive state and timers on restart, game over and wave transitions. Freeze dive timers while paused.

Implement this in the existing project without rewriting unrelated systems. Append this prompt verbatim to PROM

## 8. Progressive difficulty, health and interception

Update our existing Space Attack game with progressive wave difficulty, a reference-inspired health/lives HUD, and the ability to destroy enemy bullets.

1. Increase difficulty each wave

Calculate difficulty from the wave number using configurable values:

- Increase enemy formation movement speed by 10% of the base speed per wave, capped at 2.5× the base speed.
- Increase diving enemy movement speed by 8% per wave, capped at 2× the base speed.
- Reduce enemy firing cooldown by 8% per wave, with a minimum cooldown of 0.25 seconds.
- Spawn the formation slightly lower each wave, initially 12 logical canvas pixels lower per wave. Clamp its position so the lowest enemy starts at least 180 logical pixels above the player. Adapt this gap if the logical canvas is smaller.
- Keep the first wave approachable.

Preserve our diving attack rules: only one enemy dives at a time, and while it is diving, ONLY that enemy can fire new bullets. Formation enemies resume normal firing when no diver is active. Apply the wave firing cooldown to the diver as well.

Calculate values from their base settings each wave to avoid accidental compounding. Reset difficulty to wave 1 on restart.

2. Add health and spare lives matching the reference style

Use the screenshot for appearance. For our game, define the behavior as follows:

- Place a red “E” followed by a horizontal bright-green health bar at the bottom left.
- Place small green pixel-art player ship icons at the bottom right to represent spare lives.
- Show the current wave number in red beside the icons.
- Start with 100 health and two spare lives, giving three ships in total.
- Enemy bullets cause 25 damage; direct enemy contact causes 50 damage.
- Reuse the existing brief invulnerability period to prevent repeated damage from one collision.
- Remove bullets on impact, even if the player is currently invulnerable.
- When health reaches zero, consume one spare life, restore full health, and respawn the player at bottom center with brief invulnerability. Clear nearby threats so respawning is safe.
- If health reaches zero with no spare lives remaining, show game over.
- Do not also subtract a life for each hit: replace the previous damage behavior with this health system.
- Keep the existing formation-bottom game-over rule.
- Keep the HUD outside the active collision area and visible at all supported sizes.
- Include a short explanation of the health bar and spare-life icons on the start screen.

3. Allow the player to shoot enemy bullets

- Detect collisions between player bullets and enemy bullets.
- Destroy both bullets when they collide.
- Show a small, brief pixel spark effect.
- Do not award points for destroying bullets.
- Ensure each bullet can participate in only one collision before removal.
- Resolve bullet interception before enemy bullets damage the player, so intercepted bullets cannot also hurt the player during the same update.
- Use swept collision checks or suitable substeps if necessary to prevent fast bullets passing through each other.

Integrate these changes into the existing game loop and systems. Preserve working controls, scoring, pause, wave transitions and restart behavior.

Append this prompt verbatim to PROMPTS.md. Verify what you can and give me a short manual checklist covering wave difficulty, health damage, spare-life consumption, bullet interception and full restart reset. Do not claim tests were run unless you ran them.

## 9. Hunters

Add a new “Hunter” enemy behavior to our existing Space Attack game, starting at wave 6, after the player completes five waves.

Hunter appearance:

- Use a distinct purple/magenta color and a slightly different pixel-art silhouette.
- Keep normal enemy colors unchanged.
- Briefly show “Hunters incoming!” when they first appear.

Selection:

- From wave 6 onward, give each selected diving enemy a 30% chance of becoming a Hunter.
- Increase this chance by 5 percentage points per subsequent wave, capped at 60%.
- Change its appearance when the dive begins.
- Preserve the rule that only one enemy can dive at a time.

Hunter movement:

- Replace the Hunter’s random horizontal weaving with steering toward the player’s current horizontal position.
- Continue moving downward while adjusting horizontal movement to attempt a direct collision with the player.
- Use smooth acceleration and capped horizontal speed, giving the player a fair chance to dodge.
- Recalculate its target during the dive, so it reacts when the player moves.
- Keep it inside the horizontal play-area boundaries.
- Once it passes below the player, stop tracking and continue downward until it leaves the screen. Do not turn back or pursue indefinitely.
- Use delta time and expose tracking strength, acceleration and maximum speed as configuration values.
- Keep normal diving enemies’ random weaving behavior unchanged.

Combat and integration:

- Preserve the existing shooting rule: while an enemy is diving, only that enemy may fire.
- Hunters fire downward using the current wave’s firing cooldown and stop firing after passing below the player.
- Reuse existing damage, invulnerability, bullet interception and scoring systems.
- On contact with the player, remove the Hunter and apply contact damage once if the player is vulnerable. Do not award points for the collision.
- When shot down, award points exactly once using its original enemy type’s score.
- Escaping Hunters award no points and do not trigger the formation-bottom game-over rule.
- Count Hunters toward wave completion and clear their state on restart or game over.
- Freeze Hunter movement and timers while paused.

Implement this without rewriting unrelated systems. Append this prompt verbatim to PROMPTS.md. Give me a short checklist to verify that Hunters appear only from wave 6, track smoothly, remain dodgeable, and preserve exclusive diver shooting.

## 10. Complete prompt history

also update prompts.md file with all the prompts 
