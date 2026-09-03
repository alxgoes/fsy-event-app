"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Seigaiha from "./Seigaiha";

export function SeigaihaBackground() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid flash before theme resolution
  const isDark = mounted ? resolvedTheme === "dark" : false;

  // FSY 2027 Official Theme Palettes
  const palette = isDark
    ? {
        colorB: "#08101E", // FSY Midnight Dark Navy
        colorA: "#01B6D1", // FSY Blue 20
        colors: ["#007DA5", "#01B6D1", "#005E7C", "#7DE3F4"],
        count: 14,
        rings: 14,
        thickness: 5,
        overlap: 20,
        speed: 6,
        strength: 3,
      }
    : {
        colorB: "#F3EDE2", // FSY Soft Parchment Neutral
        colorA: "#9EDAE8", // FSY Blue 10 Soft Waves
        colors: ["#9EDAE8", "#B5E8F3", "#89D0E2", "#A6DDEF"],
        count: 14,
        rings: 14,
        thickness: 5,
        overlap: 20,
        speed: 6,
        strength: 3,
      };

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden transition-opacity duration-700"
      style={{
        backgroundColor: palette.colorB,
      }}
    >
      <Seigaiha
        colorA={palette.colorA}
        colorB={palette.colorB}
        colors={palette.colors}
        count={palette.count}
        rings={palette.rings}
        thickness={palette.thickness}
        overlap={palette.overlap}
        speed={palette.speed}
        direction="right"
        followPointer={true}
        strength={palette.strength}
        style={{
          opacity: isDark ? 0.85 : 0.7,
        }}
      />
    </div>
  );
}
