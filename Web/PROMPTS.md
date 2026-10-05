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
