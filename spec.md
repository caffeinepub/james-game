# James Game — Realistic Snake Upgrade

## Current State
A retro arcade-style snake game with:
- Canvas-rendered snake with flat rounded rectangles and basic eye dots
- Red pulsing circle for food
- CRT aesthetic: scanlines, phosphor glow, dark terminal background
- Static grid lines
- Mobile D-pad controls
- Score HUD in canvas and React header
- High score saved to backend

## Requested Changes (Diff)

### Add
- **Grass/terrain background**: Replace flat dark canvas background with a tiled grass texture drawn in canvas (alternating light/dark green squares like a real game board, reminiscent of a garden or forest floor)
- **Snake body segments with scales**: Draw each body segment with a subtle scale pattern (alternating slightly lighter/darker diagonal or checkerboard pattern). Snake color should be natural — dark green/olive tones with slight texture variation instead of neon
- **Snake head details**: More detailed head — slightly larger, distinct from body, with realistic-looking eyes (white sclera + dark pupil, positioned based on direction), and a forked tongue that flickers out occasionally (animated with canvas)
- **Food as an apple/fruit**: Replace the red circle with a stylized apple: round red body, small green stem, leaf shape. Or a mouse/rat icon for a more "real" snake feel. Use simple canvas shapes to draw it
- **Death animation**: When game over, animate the snake flashing and briefly shrinking/fading before the overlay appears (500ms delay before showing overlay)
- **Eating animation**: Brief scale-up flash on the head segment when food is eaten
- **Ambient particle effects**: Subtle floating dust motes or leaf particles drifting across the board — drawn in canvas, very subtle, doesn't interfere with gameplay
- **Snake movement smoothing**: Sub-grid interpolation so the snake glides between cells rather than snapping. Each segment smoothly slides to its next cell position within the tick window

### Modify
- **Canvas background**: Replace solid dark background with tiled green terrain (alternating light/dark green cells, subtle)
- **Snake colors**: Change from neon green to natural dark greens and olive (#2d5a27, #3d7a32 range)
- **Grid lines**: Make faint or remove — the alternating terrain tiles imply a grid without needing lines
- **Food**: Replace simple glowing circle with a multi-shape apple/fruit drawn with canvas primitives
- **Score HUD**: Keep but update styling to match earthy tone rather than neon

### Remove
- Neon glow effects from snake (keep subtle shadow only)
- Heavy CRT scanlines (tone down or remove)
- Neon color palette from canvas drawing code

## Implementation Plan
1. Rewrite the `draw()` function in `SnakeGame.tsx`:
   - Draw alternating terrain tiles (two shades of green) instead of solid background + grid lines
   - Draw food as a stylized apple using canvas arcs, lines, and fills
   - Draw snake body with scale texture (alternating shade per segment, slight diagonal pattern)
   - Draw snake head larger, with white+dark eyes and optional tongue flicker
   - Add ambient particle system (array of floating particles, drawn each frame)
   - Add smooth interpolation: store previous positions and lerp within tick window
2. Add death animation state: when game ends, run a 500ms canvas flash animation before setting `gameState = "gameover"`
3. Add eating animation: track `justAte` ref, scale head up briefly on eat frame
4. Update snake/food color constants to natural palette
5. Remove or heavily reduce scanline CSS, neon glows from canvas
6. Keep all game logic, backend, scoring, mobile controls unchanged
