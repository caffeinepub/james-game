export default function GoogleAdBanner() {
  return (
    <div
      data-ocid="ad.panel"
      className="w-full max-w-3xl mx-auto mt-3"
      aria-label="Advertisement"
    >
      {/* Outer ad container — white background, Google-style thin border */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dadce0",
          borderRadius: "4px",
          overflow: "hidden",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        {/* Ad badge — top-left corner */}
        <div
          style={{
            position: "absolute",
            top: "6px",
            left: "6px",
            background: "#e8f5e9",
            color: "#1e7e34",
            fontSize: "10px",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: "10px",
            border: "1px solid #c3e6cb",
            lineHeight: "16px",
            zIndex: 2,
            letterSpacing: "0.3px",
          }}
        >
          Ad
        </div>

        {/* Ad content row */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            minHeight: "80px",
          }}
        >
          {/* Left: Ad image thumbnail */}
          <div
            className="hidden sm:block"
            style={{
              width: "120px",
              flexShrink: 0,
              overflow: "hidden",
              background: "#3d6b34",
            }}
          >
            <img
              src="/assets/generated/james-game-ad.dim_728x90.jpg"
              alt="James Game - Play the Most Realistic Snake"
              style={{
                width: "120px",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>

          {/* Right: Ad copy */}
          <div
            style={{
              flex: 1,
              padding: "10px 12px 10px 14px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "3px",
            }}
          >
            {/* Sponsored label + display URL */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "#188038",
                  fontWeight: 400,
                  letterSpacing: "0.1px",
                }}
              >
                jamesgame.caffeine.ai
              </span>
            </div>

            {/* Headline */}
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1a0dab",
                lineHeight: "1.3",
                cursor: "pointer",
              }}
              className="hover:underline"
            >
              James Game — Play the Most Realistic Snake
            </div>

            {/* Description */}
            <div
              style={{
                fontSize: "12px",
                color: "#4d5156",
                lineHeight: "1.4",
              }}
            >
              Control a realistic snake on grass terrain. Eat apples, grow
              longer, beat your high score. Play free now!
            </div>
          </div>

          {/* CTA button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 14px 10px 8px",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              data-ocid="ad.primary_button"
              style={{
                background: "#1a73e8",
                color: "#ffffff",
                border: "none",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 600,
                padding: "8px 16px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "0.1px",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "#1765cc";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "#1a73e8";
              }}
            >
              Play Free
            </button>
          </div>
        </div>
      </div>

      {/* "Why this ad?" micro-link — Google-style */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          paddingTop: "2px",
          paddingRight: "2px",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            color: "#70757a",
            cursor: "default",
            userSelect: "none",
          }}
        >
          Why this ad?
        </span>
      </div>
    </div>
  );
}
