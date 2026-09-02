import React from "react";

export interface FsyLogoProps {
  variant?: "horizontal" | "vertical" | "temple-only" | "copy-only";
  colorMode?: "four-color" | "three-color" | "two-color" | "one-color";
  className?: string;
  showScripture?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

/**
 * Official Salt Lake Temple Mark in Arch Shape
 * Respects official 2027 style guide color modes:
 * - Four-color: Rich Black (#000), Neutral 5 (#EFEFE7), Gray 5 (#E0E2E2), Gold 10 (#DBBF6B)
 * - Three-color: Rich Black (#000), Gray 5 (#E0E2E2), Gold 10 (#DBBF6B)
 * - Two-color: Rich Black (#000), Gold 10 (#DBBF6B)
 * - One-color: Rich Black (#000) line-art
 */
export function FsyTempleMark({
  colorMode = "four-color",
  className = "h-14 w-auto",
}: {
  colorMode?: "four-color" | "three-color" | "two-color" | "one-color";
  className?: string;
}) {
  const isFourColor = colorMode === "four-color";
  const isThreeColor = colorMode === "three-color";
  const isTwoColor = colorMode === "two-color";

  // Palette colors based on official guide
  const archFill = isFourColor ? "#EFEFE7" : isThreeColor ? "#E0E2E2" : "none";
  const templeBodyFill = isFourColor || isThreeColor ? "#E0E2E2" : "none";
  const goldFill = isFourColor || isThreeColor || isTwoColor ? "#DBBF6B" : "#000000";
  const strokeColor = "#000000";

  return (
    <svg
      viewBox="0 0 100 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FSY Temple Mark"
    >
      {/* Arch Background Shape */}
      <path
        d="M 12 50 C 12 20, 88 20, 88 50 L 88 152 L 12 152 Z"
        fill={archFill}
        stroke={colorMode === "one-color" ? strokeColor : "none"}
        strokeWidth="2"
      />

      {/* Temple Base & Wall Outlines */}
      <path
        d="M 20 150 L 20 96 L 26 96 L 26 84 L 32 84 L 32 72 L 40 72 L 40 40 L 50 24 L 60 40 L 60 72 L 68 72 L 68 84 L 74 84 L 74 96 L 80 96 L 80 150 Z"
        fill={templeBodyFill}
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Center Tower Spire & Details */}
      <path
        d="M 46 40 L 50 20 L 54 40 Z"
        fill={templeBodyFill}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Left Spire */}
      <path
        d="M 28 84 L 30 70 L 32 84 Z"
        fill={templeBodyFill}
        stroke={strokeColor}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Right Spire */}
      <path
        d="M 68 84 L 70 70 L 72 84 Z"
        fill={templeBodyFill}
        stroke={strokeColor}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Battlements / Turret details */}
      <path
        d="M 32 96 L 68 96 M 34 84 L 66 84 M 40 72 L 60 72 M 20 110 L 80 110 M 20 128 L 80 128"
        stroke={strokeColor}
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Vertical architectural pillar lines */}
      <line x1="28" y1="96" x2="28" y2="150" stroke={strokeColor} strokeWidth="1.2" />
      <line x1="38" y1="96" x2="38" y2="150" stroke={strokeColor} strokeWidth="1.2" />
      <line x1="62" y1="96" x2="62" y2="150" stroke={strokeColor} strokeWidth="1.2" />
      <line x1="72" y1="96" x2="72" y2="150" stroke={strokeColor} strokeWidth="1.2" />

      {/* Central Grand Arch Portal / Doorway */}
      <path
        d="M 44 150 L 44 116 C 44 110, 56 110, 56 116 L 56 150 Z"
        fill={goldFill}
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Angel Moroni on Top */}
      <g transform="translate(50, 14) scale(0.9)">
        {/* Figure with Trumpet */}
        <circle cx="0" cy="-2" r="1.5" fill={goldFill} stroke={strokeColor} strokeWidth="0.8" />
        <path
          d="M 0 0 L 0 5 M 0 1 L 3.5 -1.5 M 3.5 -1.5 L 6 -3"
          stroke={goldFill}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="0" cy="-2" r="1.2" fill={goldFill} />
      </g>

      {/* Base baseline */}
      <line x1="16" y1="150" x2="84" y2="150" stroke={strokeColor} strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

export function FsyLogo({
  variant = "horizontal",
  colorMode = "four-color",
  className = "",
  showScripture = true,
  size = "md",
}: FsyLogoProps) {
  const sizeClasses = {
    sm: {
      mark: "h-9 w-auto",
      rejoice: "text-[10px] tracking-[0.18em]",
      christ: "text-base tracking-[0.06em]",
      scripture: "text-[10px] tracking-[0.2em]",
      gap: "gap-2.5",
    },
    md: {
      mark: "h-14 w-auto",
      rejoice: "text-xs tracking-[0.2em]",
      christ: "text-2xl tracking-[0.08em]",
      scripture: "text-[10px] tracking-[0.22em]",
      gap: "gap-4",
    },
    lg: {
      mark: "h-20 w-auto",
      rejoice: "text-sm tracking-[0.22em]",
      christ: "text-4xl tracking-[0.08em]",
      scripture: "text-xs tracking-[0.24em]",
      gap: "gap-6",
    },
    xl: {
      mark: "h-28 w-auto",
      rejoice: "text-lg tracking-[0.24em]",
      christ: "text-6xl tracking-[0.1em]",
      scripture: "text-sm tracking-[0.26em]",
      gap: "gap-8",
    },
  }[size];

  if (variant === "temple-only") {
    return <FsyTempleMark colorMode={colorMode} className={`${sizeClasses.mark} ${className}`} />;
  }

  if (variant === "copy-only") {
    return (
      <div className={`flex flex-col select-none ${className}`}>
        <span
          className={`font-serif uppercase font-light text-slate-900 dark:text-white leading-none ${sizeClasses.rejoice}`}
          style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
        >
          REJOICE IN
        </span>
        <span
          className={`font-serif uppercase font-bold text-slate-900 dark:text-white leading-none mt-0.5 ${sizeClasses.christ}`}
          style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
        >
          CHRIST
        </span>
        {showScripture && (
          <span
            className={`font-serif uppercase font-normal text-slate-800 dark:text-slate-200 mt-1 ${sizeClasses.scripture}`}
            style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
          >
            PHILIPPIANS 4:4
          </span>
        )}
      </div>
    );
  }

  if (variant === "vertical") {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        <FsyTempleMark colorMode={colorMode} className={sizeClasses.mark} />
        {/* Official 2-stones vertical lockup spacing */}
        <div className="mt-3 flex flex-col items-center">
          <span
            className={`font-serif uppercase font-light text-slate-900 dark:text-white leading-none ${sizeClasses.rejoice}`}
            style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
          >
            REJOICE IN
          </span>
          <span
            className={`font-serif uppercase font-bold text-slate-900 dark:text-white leading-none mt-1 ${sizeClasses.christ}`}
            style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
          >
            CHRIST
          </span>
          {showScripture && (
            <span
              className={`font-serif uppercase font-normal text-slate-800 dark:text-slate-200 mt-1.5 ${sizeClasses.scripture}`}
              style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
            >
              PHILIPPIANS 4:4
            </span>
          )}
        </div>
      </div>
    );
  }

  // Horizontal lockup (Default)
  return (
    <div className={`flex items-center ${sizeClasses.gap} select-none ${className}`}>
      <FsyTempleMark colorMode={colorMode} className={sizeClasses.mark} />
      {/* Official window width lockup spacing */}
      <div className="flex flex-col justify-center">
        <span
          className={`font-serif uppercase font-light text-slate-900 dark:text-white leading-none ${sizeClasses.rejoice}`}
          style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
        >
          REJOICE IN
        </span>
        <span
          className={`font-serif uppercase font-bold text-slate-900 dark:text-white leading-none mt-0.5 ${sizeClasses.christ}`}
          style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
        >
          CHRIST
        </span>
        {showScripture && (
          <span
            className={`font-serif uppercase font-normal text-slate-800 dark:text-slate-200 mt-1 ${sizeClasses.scripture}`}
            style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', 'Cormorant Garamond', serif" }}
          >
            PHILIPPIANS 4:4
          </span>
        )}
      </div>
    </div>
  );
}
