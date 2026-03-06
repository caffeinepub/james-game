# James Game

## Current State
A realistic snake game with a canvas-based game engine. The page includes a header with score display, a canvas game area, mobile d-pad controls, and a footer. There are overlays for start, pause, and game over states.

## Requested Changes (Diff)

### Add
- A Google Ads-style banner ad unit displayed on the game page
- The ad promotes "James Game" itself, styled to look like a real Google display ad (leaderboard 728x90 or responsive banner)
- A generated image asset for the ad creative

### Modify
- `App.tsx` or `SnakeGame.tsx` to include the ad banner in the layout (above or below the game area)

### Remove
- Nothing removed

## Implementation Plan
1. Generate an ad banner image for James Game (snake game themed)
2. Create a `GoogleAdBanner` component that mimics a Google display ad unit — includes the ad image/creative, headline, description, CTA button, "Ad" label badge, and a Google-style border/container
3. Place the banner in `SnakeGame.tsx` below the canvas area and above the mobile controls
4. The ad should link to the game itself (href="#") and be visually convincing as a real Google ad unit
