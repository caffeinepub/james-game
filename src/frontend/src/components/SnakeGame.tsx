import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActor } from "../hooks/useActor";
import { useGetHighScore } from "../hooks/useQueries";

// ─── Types ────────────────────────────────────────────────────────────────────

type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";
type GameState = "start" | "playing" | "paused" | "gameover";

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID = 20;
const BASE_SPEED = 140; // ms per tick
const MIN_SPEED = 60;
const POINTS_PER_FOOD = 10;

// Canvas colors — literal values (can't use CSS vars in canvas)
const COLOR_SNAKE_HEAD = "#c8e6c9"; // pale cream-green
const COLOR_SNAKE_BODY_A = "#4e8c40"; // natural green
const COLOR_SNAKE_BODY_B = "#3d7330"; // slightly darker alternate
const COLOR_SNAKE_OUTLINE = "#1a3d18"; // dark green outline
const COLOR_SCORE_BG = "rgba(0, 0, 0, 0.55)";
const COLOR_SCORE_TEXT = "#a8d5a2";

// Terrain tile colors
const TILE_EVEN = "#4a7c3f";
const TILE_ODD = "#3d6b34";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomFood(snake: Point[], cols: number, rows: number): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  let attempts = 0;
  while (attempts < 1000) {
    const p: Point = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows),
    };
    if (!occupied.has(`${p.x},${p.y}`)) return p;
    attempts++;
  }
  return { x: 0, y: 0 };
}

function calcSpeed(score: number): number {
  const speed = BASE_SPEED - score * 0.8;
  return Math.max(speed, MIN_SPEED);
}

function initParticles(count: number, cw: number, ch: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * cw,
    y: Math.random() * ch,
    size: 1 + Math.random(),
    opacity: 0.3 + Math.random() * 0.3,
    speed: 0.2 + Math.random() * 0.4,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Game state stored in refs for the animation loop
  const snakeRef = useRef<Point[]>([]);
  const prevSnakeRef = useRef<Point[]>([]); // previous tick positions for lerp
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const dirRef = useRef<Dir>("RIGHT");
  const nextDirRef = useRef<Dir>("RIGHT");
  const scoreRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>("start");
  const lastTickRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const foodPulseRef = useRef<number>(0); // 0–1 oscillation

  // Realistic animation refs
  const tongueRef = useRef<number>(0); // counts down, tongue visible when > 0
  const tongueFrameRef = useRef<number>(0); // frame counter for tongue flicker
  const tickProgressRef = useRef<number>(0); // 0–1 progress within current tick
  const dyingRef = useRef<boolean>(false);
  const deathTimerRef = useRef<number>(0);
  const eatAnimRef = useRef<number>(0); // counts down 8→0 when food eaten
  const particlesRef = useRef<Particle[]>([]);
  const frameCountRef = useRef<number>(0);

  // React state for UI overlay
  const [gameState, setGameState] = useState<GameState>("start");
  const [displayScore, setDisplayScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [scoreBump, setScoreBump] = useState(false);
  const [localHigh, setLocalHigh] = useState(0);

  const { data: remoteHigh = BigInt(0), refetch: refetchHigh } =
    useGetHighScore();
  const queryClient = useQueryClient();
  const { actor } = useActor();
  const actorRef = useRef(actor);
  useEffect(() => {
    actorRef.current = actor;
  }, [actor]);

  const highScore = Math.max(Number(remoteHigh), localHigh);

  // ─── Canvas size ────────────────────────────────────────────────────────────

  const [canvasSize, setCanvasSize] = useState({ w: 480, h: 480 });

  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Leave room for header/controls
      const maxSize = Math.min(vw - 32, vh - 180, 560);
      const snapped = Math.floor(maxSize / GRID) * GRID;
      setCanvasSize({ w: snapped, h: snapped });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const cols = canvasSize.w / (canvasSize.w / GRID);
  const rows = canvasSize.h / (canvasSize.h / GRID);
  const cellW = canvasSize.w / GRID;
  const cellH = canvasSize.h / GRID;

  // ─── Init game ──────────────────────────────────────────────────────────────

  const initGame = useCallback(() => {
    const cx = Math.floor(GRID / 2);
    const cy = Math.floor(GRID / 2);
    snakeRef.current = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    prevSnakeRef.current = [...snakeRef.current];
    foodRef.current = randomFood(snakeRef.current, cols, rows);
    dirRef.current = "RIGHT";
    nextDirRef.current = "RIGHT";
    scoreRef.current = 0;
    lastTickRef.current = 0;
    tongueRef.current = 0;
    tongueFrameRef.current = 0;
    tickProgressRef.current = 0;
    dyingRef.current = false;
    deathTimerRef.current = 0;
    eatAnimRef.current = 0;
    particlesRef.current = initParticles(15, canvasSize.w, canvasSize.h);
    setDisplayScore(0);
    setFinalScore(0);
  }, [cols, rows, canvasSize.w, canvasSize.h]);

  // ─── Draw ───────────────────────────────────────────────────────────────────

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cw = canvasSize.w;
      const ch = canvasSize.h;

      frameCountRef.current++;

      // ── Terrain background (checkerboard grass tiles) ──
      for (let gx = 0; gx < GRID; gx++) {
        for (let gy = 0; gy < GRID; gy++) {
          ctx.fillStyle = (gx + gy) % 2 === 0 ? TILE_EVEN : TILE_ODD;
          ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);
        }
      }

      // ── Ambient particles ──
      const particles = particlesRef.current;
      ctx.save();
      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < -2) {
          p.y = ch + 2;
          p.x = Math.random() * cw;
        }
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = "#a8d5a2";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // ── Food (realistic apple) ──
      foodPulseRef.current = (Math.sin(timestamp * 0.004) + 1) / 2;
      const pulse = foodPulseRef.current;
      const food = foodRef.current;
      const foodCx = food.x * cellW + cellW / 2;
      const foodCy = food.y * cellH + cellH / 2;
      const appleScale = 0.85 + pulse * 0.15;
      const appleR = cellW * 0.38 * appleScale;

      ctx.save();
      ctx.translate(foodCx, foodCy);
      ctx.scale(appleScale, appleScale);

      // Apple body
      ctx.beginPath();
      ctx.arc(0, 0, appleR, 0, Math.PI * 2);
      ctx.fillStyle = "#d32f2f";
      ctx.fill();

      // Apple highlight
      ctx.beginPath();
      ctx.arc(-appleR * 0.25, -appleR * 0.3, appleR * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 200, 200, 0.35)";
      ctx.fill();

      // Apple stem
      ctx.beginPath();
      ctx.moveTo(0, -appleR);
      ctx.lineTo(0, -appleR - cellH * 0.2);
      ctx.strokeStyle = "#6b3a2a";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Apple leaf
      ctx.beginPath();
      ctx.moveTo(0, -appleR - cellH * 0.12);
      ctx.bezierCurveTo(
        cellW * 0.1,
        -appleR - cellH * 0.26,
        cellW * 0.22,
        -appleR - cellH * 0.22,
        cellW * 0.18,
        -appleR - cellH * 0.08,
      );
      ctx.bezierCurveTo(
        cellW * 0.12,
        -appleR - cellH * 0.02,
        cellW * 0.04,
        -appleR - cellH * 0.04,
        0,
        -appleR - cellH * 0.12,
      );
      ctx.fillStyle = "#2d7a1e";
      ctx.fill();

      ctx.restore();

      // ── Snake ──
      const snake = snakeRef.current;
      const prevSnake = prevSnakeRef.current;
      const t = tickProgressRef.current;
      const canInterp = prevSnake.length === snake.length && snake.length > 0;

      // Death flash: check if we should flash red
      let isDyingFlashRed = false;
      if (dyingRef.current) {
        const elapsed = timestamp - deathTimerRef.current;
        const flashPhase = Math.floor(elapsed / 80) % 2;
        isDyingFlashRed = flashPhase === 0;

        if (elapsed >= 500) {
          dyingRef.current = false;
          gameStateRef.current = "gameover";
          setGameState("gameover");
          setFinalScore(scoreRef.current);
          setLocalHigh((prev) => Math.max(prev, scoreRef.current));
          actorRef.current
            ?.submitScore(BigInt(scoreRef.current))
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["highScore"] });
              refetchHigh();
            })
            .catch(() => {
              /* silent */
            });
        }
      }

      // Tongue flicker logic
      tongueFrameRef.current++;
      if (tongueRef.current > 0) {
        tongueRef.current--;
      } else if (Math.random() < 0.03) {
        tongueRef.current = 12;
      }

      snake.forEach((seg, i) => {
        const isHead = i === 0;

        // Interpolated position
        let drawX: number;
        let drawY: number;
        if (canInterp && prevSnake[i]) {
          const prev = prevSnake[i];
          drawX = (prev.x + (seg.x - prev.x) * t) * cellW;
          drawY = (prev.y + (seg.y - prev.y) * t) * cellH;
        } else {
          drawX = seg.x * cellW;
          drawY = seg.y * cellH;
        }

        const pad = isHead ? 0 : 1;
        const r = isHead ? 7 : 5;

        // Eat animation scale for head
        let eatScale = 1;
        if (isHead && eatAnimRef.current > 0) {
          eatScale = 1 + (eatAnimRef.current / 8) * 0.3;
          eatAnimRef.current--;
        }

        ctx.save();
        if (isHead && eatScale !== 1) {
          const cx2 = drawX + cellW / 2;
          const cy2 = drawY + cellH / 2;
          ctx.translate(cx2, cy2);
          ctx.scale(eatScale, eatScale);
          ctx.translate(-cx2, -cy2);
        }

        // Dying flash
        if (isDyingFlashRed && !isHead) {
          ctx.fillStyle = "#cc1111";
        } else if (isDyingFlashRed && isHead) {
          ctx.fillStyle = "#ff4444";
        } else if (isHead) {
          ctx.fillStyle = COLOR_SNAKE_HEAD;
        } else {
          // Alternate segment shading
          ctx.fillStyle = i % 2 === 0 ? COLOR_SNAKE_BODY_A : COLOR_SNAKE_BODY_B;
        }

        // Body fade for tail
        if (!isHead) {
          ctx.globalAlpha = Math.max(0.5, 1 - i * 0.018);
        }

        // Rounded rect base
        ctx.beginPath();
        ctx.roundRect(
          drawX + pad,
          drawY + pad,
          cellW - pad * 2,
          cellH - pad * 2,
          r,
        );
        ctx.fill();

        // Scale texture on body segments
        if (!isHead && !isDyingFlashRed) {
          const scx = drawX + cellW / 2;
          const scy = drawY + cellH / 2;
          // Two scale arcs per segment
          ctx.fillStyle = "rgba(200, 230, 200, 0.15)";
          ctx.beginPath();
          ctx.arc(
            scx - cellW * 0.12,
            scy - cellH * 0.1,
            cellW * 0.14,
            0,
            Math.PI,
          );
          ctx.fill();
          ctx.beginPath();
          ctx.arc(
            scx + cellW * 0.12,
            scy + cellH * 0.05,
            cellW * 0.13,
            0,
            Math.PI,
          );
          ctx.fill();
        }

        ctx.globalAlpha = 1;

        // Outline
        ctx.strokeStyle = isDyingFlashRed ? "#660000" : COLOR_SNAKE_OUTLINE;
        ctx.lineWidth = isHead ? 1.5 : 1;
        ctx.beginPath();
        ctx.roundRect(
          drawX + pad,
          drawY + pad,
          cellW - pad * 2,
          cellH - pad * 2,
          r,
        );
        ctx.stroke();

        // Head features
        if (isHead && !isDyingFlashRed) {
          const dir = dirRef.current;
          let ex1: number;
          let ey1: number;
          let ex2: number;
          let ey2: number;
          const eyeR = cellW * 0.12;
          const pupilR = cellW * 0.06;

          if (dir === "RIGHT") {
            ex1 = drawX + cellW * 0.72;
            ey1 = drawY + cellH * 0.28;
            ex2 = drawX + cellW * 0.72;
            ey2 = drawY + cellH * 0.72;
          } else if (dir === "LEFT") {
            ex1 = drawX + cellW * 0.28;
            ey1 = drawY + cellH * 0.28;
            ex2 = drawX + cellW * 0.28;
            ey2 = drawY + cellH * 0.72;
          } else if (dir === "UP") {
            ex1 = drawX + cellW * 0.28;
            ey1 = drawY + cellH * 0.28;
            ex2 = drawX + cellW * 0.72;
            ey2 = drawY + cellH * 0.28;
          } else {
            ex1 = drawX + cellW * 0.28;
            ey1 = drawY + cellH * 0.72;
            ex2 = drawX + cellW * 0.72;
            ey2 = drawY + cellH * 0.72;
          }

          // White sclera
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2);
          ctx.fill();

          // Dark pupils
          ctx.fillStyle = "#0d1a0a";
          ctx.beginPath();
          ctx.arc(ex1, ey1, pupilR, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex2, ey2, pupilR, 0, Math.PI * 2);
          ctx.fill();

          // Eye shine
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.beginPath();
          ctx.arc(
            ex1 - pupilR * 0.4,
            ey1 - pupilR * 0.4,
            pupilR * 0.4,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.beginPath();
          ctx.arc(
            ex2 - pupilR * 0.4,
            ey2 - pupilR * 0.4,
            pupilR * 0.4,
            0,
            Math.PI * 2,
          );
          ctx.fill();

          // Tongue
          if (tongueRef.current > 0 && gameStateRef.current === "playing") {
            const tongueLen = cellW * 0.5;
            const tongueFork = cellW * 0.18;
            let tx: number;
            let ty: number;
            let tdx: number;
            let tdy: number;

            if (dir === "RIGHT") {
              tx = drawX + cellW;
              ty = drawY + cellH * 0.5;
              tdx = 1;
              tdy = 0;
            } else if (dir === "LEFT") {
              tx = drawX;
              ty = drawY + cellH * 0.5;
              tdx = -1;
              tdy = 0;
            } else if (dir === "UP") {
              tx = drawX + cellW * 0.5;
              ty = drawY;
              tdx = 0;
              tdy = -1;
            } else {
              tx = drawX + cellW * 0.5;
              ty = drawY + cellH;
              tdx = 0;
              tdy = 1;
            }

            ctx.strokeStyle = "#cc2200";
            ctx.lineWidth = 1.5;
            ctx.lineCap = "round";

            // Stem
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + tdx * tongueLen * 0.6, ty + tdy * tongueLen * 0.6);
            ctx.stroke();

            // Two forks
            const forkBaseX = tx + tdx * tongueLen * 0.6;
            const forkBaseY = ty + tdy * tongueLen * 0.6;
            const perpX = tdy;
            const perpY = tdx;

            ctx.beginPath();
            ctx.moveTo(forkBaseX, forkBaseY);
            ctx.lineTo(
              forkBaseX + tdx * tongueLen * 0.4 + perpX * tongueFork,
              forkBaseY + tdy * tongueLen * 0.4 + perpY * tongueFork,
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(forkBaseX, forkBaseY);
            ctx.lineTo(
              forkBaseX + tdx * tongueLen * 0.4 - perpX * tongueFork,
              forkBaseY + tdy * tongueLen * 0.4 - perpY * tongueFork,
            );
            ctx.stroke();
          }
        }

        ctx.restore();
      });

      // ── Score HUD ──
      const score = scoreRef.current;
      ctx.fillStyle = COLOR_SCORE_BG;
      ctx.beginPath();
      ctx.roundRect(cw - 110, 8, 102, 36, 8);
      ctx.fill();

      ctx.fillStyle = COLOR_SCORE_TEXT;
      ctx.font = `bold ${Math.floor(cellW * 0.6)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "right";
      ctx.fillText(`${score}`, cw - 14, 31);
      ctx.textAlign = "left";
    },
    [canvasSize, cellW, cellH, queryClient, refetchHigh],
  );

  // ─── Game loop ──────────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    const state = gameStateRef.current;
    if (state !== "playing") return;

    dirRef.current = nextDirRef.current;
    const dir = dirRef.current;
    const snake = snakeRef.current;
    const head = snake[0];

    let nx = head.x;
    let ny = head.y;
    if (dir === "UP") ny--;
    else if (dir === "DOWN") ny++;
    else if (dir === "LEFT") nx--;
    else if (dir === "RIGHT") nx++;

    // Save previous positions for interpolation
    prevSnakeRef.current = snake.map((p) => ({ ...p }));

    // Wall collision
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
      dyingRef.current = true;
      deathTimerRef.current = performance.now();
      gameStateRef.current = "dying" as GameState;
      return;
    }

    // Self collision
    const selfHit = snake.some((s, i) => i > 0 && s.x === nx && s.y === ny);
    if (selfHit) {
      dyingRef.current = true;
      deathTimerRef.current = performance.now();
      gameStateRef.current = "dying" as GameState;
      return;
    }

    const newHead = { x: nx, y: ny };
    const newSnake = [newHead, ...snake];
    const food = foodRef.current;

    if (nx === food.x && ny === food.y) {
      // Ate food
      scoreRef.current += POINTS_PER_FOOD;
      setDisplayScore(scoreRef.current);
      setScoreBump(true);
      setTimeout(() => setScoreBump(false), 260);
      foodRef.current = randomFood(newSnake, GRID, GRID);
      eatAnimRef.current = 8;
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
  }, []);

  const loop = useCallback(
    (timestamp: number) => {
      const state = gameStateRef.current;

      if (state === "playing") {
        const speed = calcSpeed(scoreRef.current);
        const elapsed = timestamp - lastTickRef.current;
        // Update interpolation progress
        if (lastTickRef.current > 0) {
          tickProgressRef.current = Math.min(elapsed / speed, 1);
        }

        if (elapsed >= speed) {
          lastTickRef.current = timestamp;
          tickProgressRef.current = 0;
          tick();
        }
      }

      draw(timestamp);
      rafRef.current = requestAnimationFrame(loop);
    },
    [tick, draw],
  );

  // Start/restart RAF on mount
  useEffect(() => {
    initGame();
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loop, initGame]);

  // ─── Keyboard ───────────────────────────────────────────────────────────────

  const handleDir = useCallback((dir: Dir) => {
    const cur = dirRef.current;
    const opposite: Record<Dir, Dir> = {
      UP: "DOWN",
      DOWN: "UP",
      LEFT: "RIGHT",
      RIGHT: "LEFT",
    };
    if (dir !== opposite[cur]) {
      nextDirRef.current = dir;
    }
  }, []);

  const startGame = useCallback(() => {
    initGame();
    gameStateRef.current = "playing";
    setGameState("playing");
    lastTickRef.current = 0;
  }, [initGame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = gameStateRef.current;

      if (e.code === "Space") {
        e.preventDefault();
        if (state === "start" || state === "gameover") startGame();
        return;
      }

      if (e.code === "Escape") {
        if (state === "playing") {
          gameStateRef.current = "paused";
          setGameState("paused");
        } else if (state === "paused") {
          gameStateRef.current = "playing";
          setGameState("playing");
          lastTickRef.current = 0;
        }
        return;
      }

      if (state !== "playing") return;

      const map: Record<string, Dir> = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
        KeyW: "UP",
        KeyS: "DOWN",
        KeyA: "LEFT",
        KeyD: "RIGHT",
      };

      if (map[e.code]) {
        e.preventDefault();
        handleDir(map[e.code]);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startGame, handleDir]);

  // ─── Mobile controls ────────────────────────────────────────────────────────

  const onMobileDir = (dir: Dir) => {
    const state = gameStateRef.current;
    if (state !== "playing") return;
    handleDir(dir);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const year = new Date().getFullYear();

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-background"
      style={{ fontFamily: '"Cabinet Grotesk", sans-serif' }}
      ref={containerRef}
    >
      {/* Header */}
      <header className="flex items-center justify-between w-full max-w-3xl px-4 py-2">
        <div className="flex flex-col">
          <h1
            className="font-display font-extrabold tracking-wider text-2xl sm:text-3xl uppercase"
            style={{
              fontFamily: '"Bricolage Grotesque", sans-serif',
              color: "oklch(0.72 0.22 140)",
            }}
          >
            JAMES GAME
          </h1>
          <p
            className="font-mono text-xs tracking-widest"
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              color: "oklch(0.45 0.1 145)",
            }}
          >
            SNAKE v2.0
          </p>
        </div>

        {/* Score display */}
        <div
          data-ocid="score.panel"
          className="flex flex-col items-end gap-0.5"
        >
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-xs uppercase tracking-widest"
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                color: "oklch(0.45 0.1 145)",
              }}
            >
              SCORE
            </span>
            <span
              className={`font-mono font-bold text-xl tabular-nums ${scoreBump ? "score-bump" : ""}`}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                color: "oklch(0.72 0.22 140)",
              }}
            >
              {displayScore}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-xs uppercase tracking-widest"
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                color: "oklch(0.35 0.08 145)",
              }}
            >
              BEST
            </span>
            <span
              className="font-mono font-bold text-base tabular-nums"
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                color: "oklch(0.6 0.18 145)",
              }}
            >
              {highScore}
            </span>
          </div>
        </div>
      </header>

      {/* Canvas wrapper */}
      <div
        className="relative scanlines"
        style={{
          width: canvasSize.w,
          height: canvasSize.h,
          borderRadius: "4px",
          border: "2px solid oklch(0.3 0.1 140)",
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(60,120,40,0.15)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          data-ocid="game.canvas_target"
          className="block"
          style={{ display: "block", borderRadius: "2px" }}
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === "start" && (
            <GameOverlay key="start">
              <motion.div
                className="flex flex-col items-center gap-6"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="font-display font-black text-5xl sm:text-6xl uppercase tracking-widest"
                    style={{
                      fontFamily: '"Bricolage Grotesque", sans-serif',
                      color: "oklch(0.88 0.26 140)",
                      textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                    }}
                  >
                    JAMES
                  </span>
                  <span
                    className="font-display font-black text-5xl sm:text-6xl uppercase tracking-widest"
                    style={{
                      fontFamily: '"Bricolage Grotesque", sans-serif',
                      color: "oklch(0.88 0.26 140)",
                      textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                    }}
                  >
                    GAME
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="font-mono text-sm tracking-widest"
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        color: "oklch(0.65 0.1 145)",
                      }}
                    >
                      HIGH SCORE:
                    </span>
                    <span
                      className="font-mono font-bold text-sm"
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        color: "oklch(0.82 0.24 140)",
                      }}
                    >
                      {highScore}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  data-ocid="game.primary_button"
                  onClick={startGame}
                  className="relative px-10 py-3 font-mono font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    background: "rgba(30, 80, 20, 0.85)",
                    color: "oklch(0.9 0.26 140)",
                    border: "1.5px solid oklch(0.5 0.2 140)",
                    borderRadius: "4px",
                    boxShadow: "0 0 14px rgba(60,180,40,0.3)",
                  }}
                >
                  PLAY NOW
                </button>

                <div className="flex flex-col items-center gap-1">
                  <p
                    className="font-mono text-xs tracking-widest cursor-blink"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      color: "oklch(0.55 0.1 145)",
                    }}
                  >
                    PRESS SPACE OR CLICK TO PLAY
                  </p>
                  <p
                    className="font-mono text-xs tracking-widest"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      color: "oklch(0.42 0.08 145)",
                    }}
                  >
                    ARROWS / WASD · ESC TO PAUSE
                  </p>
                </div>
              </motion.div>
            </GameOverlay>
          )}

          {gameState === "paused" && (
            <GameOverlay key="paused">
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <span
                  className="font-display font-black text-5xl uppercase tracking-widest cursor-blink"
                  style={{
                    fontFamily: '"Bricolage Grotesque", sans-serif',
                    color: "oklch(0.88 0.22 140)",
                    textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                  }}
                >
                  PAUSED
                </span>
                <p
                  className="font-mono text-xs tracking-widest"
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    color: "oklch(0.55 0.1 145)",
                  }}
                >
                  PRESS ESC TO RESUME
                </p>
              </motion.div>
            </GameOverlay>
          )}

          {gameState === "gameover" && (
            <GameOverlay key="gameover">
              <motion.div
                className="flex flex-col items-center gap-5"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <span
                  className="font-display font-black text-4xl sm:text-5xl uppercase tracking-widest"
                  style={{
                    fontFamily: '"Bricolage Grotesque", sans-serif',
                    color: "oklch(0.72 0.28 25)",
                    textShadow: "0 2px 12px rgba(150,20,0,0.5)",
                  }}
                >
                  GAME OVER
                </span>

                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className="font-mono text-sm tracking-widest"
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        color: "oklch(0.55 0.1 145)",
                      }}
                    >
                      SCORE
                    </span>
                    <span
                      className="font-mono font-bold text-3xl tabular-nums"
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        color: "oklch(0.88 0.26 140)",
                        textShadow: "0 1px 8px rgba(0,0,0,0.5)",
                      }}
                    >
                      {finalScore}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="font-mono text-sm tracking-widest"
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        color: "oklch(0.42 0.08 145)",
                      }}
                    >
                      BEST
                    </span>
                    <span
                      className="font-mono font-bold text-xl tabular-nums"
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        color: "oklch(0.65 0.2 145)",
                      }}
                    >
                      {Math.max(highScore, finalScore)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  data-ocid="game.primary_button"
                  onClick={startGame}
                  className="px-10 py-3 font-mono font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    background: "rgba(30, 80, 20, 0.85)",
                    color: "oklch(0.9 0.26 140)",
                    border: "1.5px solid oklch(0.5 0.2 140)",
                    borderRadius: "4px",
                    boxShadow: "0 0 14px rgba(60,180,40,0.3)",
                  }}
                >
                  PLAY AGAIN
                </button>

                <p
                  className="font-mono text-xs tracking-widest"
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    color: "oklch(0.42 0.08 145)",
                  }}
                >
                  PRESS SPACE TO RESTART
                </p>
              </motion.div>
            </GameOverlay>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile controls */}
      <div className="mt-3 flex flex-col items-center gap-1.5">
        {/* Up */}
        <MobileBtn dir="UP" onClick={() => onMobileDir("UP")}>
          ▲
        </MobileBtn>
        {/* Middle row */}
        <div className="flex gap-1.5">
          <MobileBtn dir="LEFT" onClick={() => onMobileDir("LEFT")}>
            ◀
          </MobileBtn>
          <MobileBtn dir="DOWN" onClick={() => onMobileDir("DOWN")}>
            ▼
          </MobileBtn>
          <MobileBtn dir="RIGHT" onClick={() => onMobileDir("RIGHT")}>
            ▶
          </MobileBtn>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-3 pb-3">
        <p
          className="font-mono text-xs tracking-wider text-center"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            color: "oklch(0.35 0.06 145)",
          }}
        >
          © {year}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: "oklch(0.48 0.1 145)" }}
          >
            Built with ♥ using caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GameOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: "rgba(8, 22, 6, 0.86)",
        backdropFilter: "blur(3px)",
      }}
    >
      {children}
    </div>
  );
}

function MobileBtn({
  children,
  onClick,
}: {
  dir: Dir;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-ocid="controls.button"
      onClick={onClick}
      className="w-12 h-12 flex items-center justify-center font-mono text-lg transition-all active:scale-90 select-none touch-manipulation"
      style={{
        background: "rgba(20, 55, 15, 0.9)",
        color: "oklch(0.72 0.22 140)",
        border: "1.5px solid oklch(0.3 0.1 140)",
        borderRadius: "6px",
        fontFamily: '"JetBrains Mono", monospace',
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </button>
  );
}
