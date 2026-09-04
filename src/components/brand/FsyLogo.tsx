import React from "react";
import { FsyFloatingLetters, FsyFloatingLettersSvg } from "./FsyFloatingLetters";

export { FsyFloatingLetters, FsyFloatingLettersSvg };

export interface FsyLogoProps {
  variant?: "horizontal" | "vertical" | "temple-only" | "copy-only" | "floating-letters";
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
  const archFill = isFourColor ? "#EFEFE7" : isThreeColor ? "#E0E2E2" : "#FFFFFF";
  const templeBodyFill = "#FFFFFF";
  const goldFill = isFourColor || isThreeColor || isTwoColor ? "#DBBF6B" : "#000000";
  const strokeColor = "#111827";

  return (
    <svg
      viewBox="0 0 100 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FSY Temple Arch Mark"
    >
      {/* Arch Background Container matching Image 1 */}
      <path
        d="M 12 50 A 38 38 0 0 1 88 50 L 88 174 L 12 174 Z"
        fill={archFill}
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Temple Ground Baseline */}
      <line x1="16" y1="168" x2="84" y2="168" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />

      {/* Spires: Left Side (3 Spires) */}
      {/* Outer Left Spire */}
      <path d="M 21 168 L 21 118 L 24.5 98 L 28 118 L 28 168" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="24.5" y1="98" x2="24.5" y2="168" stroke={strokeColor} strokeWidth="0.9" />

      {/* Middle Left Spire */}
      <path d="M 28 168 L 28 96 L 33 76 L 38 96 L 38 168" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="33" y1="76" x2="33" y2="168" stroke={strokeColor} strokeWidth="0.9" />

      {/* Inner Left Spire */}
      <path d="M 38 168 L 38 82 L 42 62 L 46 82 L 46 168" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="42" y1="62" x2="42" y2="168" stroke={strokeColor} strokeWidth="0.9" />

      {/* Spires: Right Side (3 Spires) */}
      {/* Inner Right Spire */}
      <path d="M 54 168 L 54 82 L 58 62 L 62 82 L 62 168" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="58" y1="62" x2="58" y2="168" stroke={strokeColor} strokeWidth="0.9" />

      {/* Middle Right Spire */}
      <path d="M 62 168 L 62 96 L 67 76 L 72 96 L 72 168" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="67" y1="76" x2="67" y2="168" stroke={strokeColor} strokeWidth="0.9" />

      {/* Outer Right Spire */}
      <path d="M 72 168 L 72 118 L 75.5 98 L 79 118 L 79 168" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="75.5" y1="98" x2="75.5" y2="168" stroke={strokeColor} strokeWidth="0.9" />

      {/* Central Temple Body: Tier 1 (Lower Level) */}
      <path d="M 28 168 L 28 126 L 72 126 L 72 168 Z" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.5" />
      {/* Crenellations (Battlements) Tier 1 */}
      <path
        d="M 34 126 L 34 122 L 37.5 122 L 37.5 126 L 41 126 L 41 122 L 44.5 122 L 44.5 126 L 55.5 126 L 55.5 122 L 59 122 L 59 126 L 62.5 126 L 62.5 122 L 66 122 L 66 126"
        stroke={strokeColor}
        strokeWidth="1.3"
        fill="none"
      />

      {/* Central Temple Body: Tier 2 (Middle Level) */}
      <path d="M 34 126 L 34 98 L 66 98 L 66 126 Z" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.5" />
      {/* Crenellations Tier 2 */}
      <path
        d="M 39 98 L 39 94 L 43 94 L 43 98 L 47 98 L 47 94 L 53 94 L 53 98 L 57 98 L 57 94 L 61 94 L 61 98"
        stroke={strokeColor}
        strokeWidth="1.3"
        fill="none"
      />

      {/* Central Temple Body: Tier 3 (Upper Level) */}
      <path d="M 40 98 L 40 76 L 60 76 L 60 98 Z" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.5" />
      {/* Crenellations Tier 3 */}
      <path
        d="M 42.5 76 L 42.5 72 L 46.5 72 L 46.5 76 L 50 76 L 53.5 76 L 53.5 72 L 57.5 72 L 57.5 76"
        stroke={strokeColor}
        strokeWidth="1.3"
        fill="none"
      />

      {/* Center Grand Spire (Tall Triangular A-Frame Spire) */}
      <path d="M 43 76 L 48.5 38 L 51.5 38 L 57 76 Z" fill={templeBodyFill} stroke={strokeColor} strokeWidth="1.5" stroke-linejoin="round" />
      <line x1="50" y1="38" x2="50" y2="76" stroke={strokeColor} strokeWidth="1" />

      {/* Horizontal Architectural Detail Lines */}
      <line x1="21" y1="146" x2="79" y2="146" stroke={strokeColor} strokeWidth="1.2" />
      <line x1="28" y1="108" x2="72" y2="108" stroke={strokeColor} strokeWidth="1.2" />

      {/* Central Arched Portal / Entrance Door in Radiant Gold (#DBBF6B) */}
      <path
        d="M 44.5 168 L 44.5 140 C 44.5 133, 55.5 133, 55.5 140 L 55.5 168 Z"
        fill={goldFill}
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <line x1="50" y1="137" x2="50" y2="168" stroke={strokeColor} strokeWidth="0.8" opacity="0.6" />

      {/* Spire Peak Pedestal / Capital */}
      <rect x="47.5" y="34.5" width="5" height="3.5" fill={goldFill} stroke={strokeColor} strokeWidth="1" rx="0.5" />

      {/* Angel Moroni in Radiant Gold holding Trumpet pointing up-right */}
      <g transform="translate(50, 19)">
        {/* Moroni Figure Body and Flowing Robes */}
        <path d="M 0 15 L -0.8 5 C -0.8 3, 1.2 3, 1.2 5 L 0.8 15 Z" fill={goldFill} stroke={strokeColor} strokeWidth="0.8" />
        {/* Head */}
        <circle cx="0.8" cy="3.2" r="1.8" fill={goldFill} stroke={strokeColor} strokeWidth="0.7" />
        {/* Slender Raised Trumpet pointing 45 degrees up-right */}
        <line x1="1.5" y1="3.8" x2="8" y2="-1.2" stroke={goldFill} strokeWidth="1.3" stroke-linecap="round" />
        {/* Trumpet Horn Flare */}
        <polygon points="7.2,-2.2 9.5,-0.2 8.5,0.8" fill={goldFill} stroke={strokeColor} strokeWidth="0.5" />
      </g>
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

  if (variant === "floating-letters") {
    const letterSize = size === "xl" ? "xl" : size === "lg" ? "lg" : size === "md" ? "md" : "sm";
    return <FsyFloatingLetters size={letterSize} className={className} />;
  }

  if (variant === "temple-only") {
    return <FsyTempleMark colorMode={colorMode} className={`${sizeClasses.mark} ${className}`} />;
  }

  if (variant === "copy-only") {
    return (
      <div className={`flex flex-col select-none ${className}`}>
        <span
          className={`font-serif uppercase font-bold text-slate-950 dark:text-white leading-none ${sizeClasses.rejoice}`}
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
            className={`font-serif uppercase font-bold text-slate-950 dark:text-white leading-none ${sizeClasses.rejoice}`}
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
          className={`font-serif uppercase font-bold text-slate-950 dark:text-white leading-none ${sizeClasses.rejoice}`}
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
