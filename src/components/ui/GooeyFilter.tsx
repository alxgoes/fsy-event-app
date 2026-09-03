"use client";

import React from "react";

/**
 * GooeyFilter: Injects cross-browser SVG filter definitions for liquid gooey effects.
 * Calibrated for smooth rubber-stretch without pixelation or clipping.
 */
export function GooeyFilter() {
  return (
    <svg
      className="sr-only absolute pointer-events-none"
      width="0"
      height="0"
      aria-hidden="true"
    >
      <defs>
        {/* Standard Liquid Gooey Filter */}
        <filter id="gooey-effect" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 18 -8"
            result="gooey"
          />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>

        {/* Subtle Liquid Filter for Micro-interactions & Segmented Bars */}
        <filter id="gooey-subtle" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 14 -6"
            result="gooeySubtle"
          />
          <feComposite in="SourceGraphic" in2="gooeySubtle" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}

export default GooeyFilter;
