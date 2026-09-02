import React from "react";
import { FsyTempleMark } from "./FsyLogo";

export interface StickerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * 1. Pink Oval Sticker ("REJOICE IN CHRIST")
 * Hex #FC4E6D / #FDA192 with dark text
 */
export function PinkOvalSticker({ className = "", size = "md" }: StickerProps) {
  const sizeMap = {
    sm: "px-3 py-1.5 text-[10px]",
    md: "px-5 py-2 text-xs",
    lg: "px-7 py-3 text-sm",
  };
  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-full bg-[#FDA192] text-slate-950 font-serif border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none ${sizeMap[size]} ${className}`}
      style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', serif" }}
    >
      <span className="text-[0.7em] tracking-[0.2em] uppercase font-light">REJOICE IN</span>
      <span className="text-[1.15em] tracking-[0.1em] uppercase font-bold leading-tight">CHRIST</span>
    </div>
  );
}

/**
 * 2. Orange Arch Sticker (Temple Illustration on Yellow 20 #F68D2E)
 */
export function OrangeArchSticker({ className = "", size = "md" }: StickerProps) {
  const sizeMap = {
    sm: "w-10 h-16 p-1",
    md: "w-14 h-24 p-1.5",
    lg: "w-20 h-32 p-2",
  };
  return (
    <div
      className={`inline-flex items-center justify-center rounded-t-full bg-[#F68D2E] border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] overflow-hidden ${sizeMap[size]} ${className}`}
    >
      <FsyTempleMark colorMode="one-color" className="w-full h-full object-contain" />
    </div>
  );
}

/**
 * 3. Green Stamp Sticker (Green 15 #93C742 with "20 27" and "4:4")
 */
export function GreenStampSticker({ className = "", size = "md" }: StickerProps) {
  const sizeMap = {
    sm: "w-14 h-14 p-1.5 text-[10px]",
    md: "w-20 h-20 p-2 text-[10px]",
    lg: "w-28 h-28 p-3 text-xs",
  };
  return (
    <div
      className={`relative inline-flex flex-col items-center justify-between rounded-2xl bg-[#93C742] border-2 border-slate-900 shadow-sm select-none text-slate-950 font-black ${sizeMap[size]} ${className}`}
    >
      <div className="w-full flex justify-between px-1">
        <span>20</span>
        <span>27</span>
      </div>
      <div className="my-auto h-[60%] flex items-center justify-center">
        <FsyTempleMark colorMode="one-color" className="h-full w-auto" />
      </div>
      <div className="w-full text-right px-1">
        <span>4:4</span>
      </div>
    </div>
  );
}

/**
 * 4. Teal Badge Sticker (Blue 20 #01B6D1 with Arch & Scripture)
 */
export function TealBadgeSticker({ className = "", size = "md" }: StickerProps) {
  const sizeMap = {
    sm: "w-16 p-2 text-[10px]",
    md: "w-24 p-3 text-[10px]",
    lg: "w-32 p-4 text-[11px]",
  };
  return (
    <div
      className={`inline-flex flex-col items-center rounded-2xl bg-[#01B6D1] text-white border-2 border-slate-900 shadow-sm select-none text-center ${sizeMap[size]} ${className}`}
      style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', serif" }}
    >
      <div className="h-10 w-auto mb-1">
        <FsyTempleMark colorMode="four-color" className="h-full w-auto mx-auto" />
      </div>
      <span className="text-[0.75em] tracking-[0.15em] uppercase font-light text-slate-950">REJOICE IN</span>
      <span className="text-[1.1em] tracking-[0.08em] uppercase font-bold text-slate-950 leading-tight">CHRIST</span>
      <span className="text-[0.65em] tracking-[0.2em] uppercase font-medium text-slate-900 mt-0.5">PHILIPPIANS 4:4</span>
    </div>
  );
}

/**
 * 5. Light Blue Pennant ("REJOICE - 4:4" on Blue 5 #B0EEFC)
 */
export function BluePennantSticker({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center px-4 py-1.5 bg-[#B0EEFC] text-slate-950 border-2 border-slate-900 shadow-sm select-none font-serif ${className}`}
      style={{
        clipPath: "polygon(0% 0%, 100% 50%, 0% 100%)",
        minWidth: "120px",
        fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', serif",
      }}
    >
      <span className="text-xs font-bold tracking-widest pl-1">REJOICE</span>
      <span className="text-[10px] font-normal tracking-wider ml-1.5">4:4</span>
    </div>
  );
}

/**
 * 6. Yellow Capsule Sticker ("REJOICE IN CHRIST 20 27" on Sunshine #FFE48A / Parchment)
 */
export function YellowCapsuleSticker({ className = "", size = "md" }: StickerProps) {
  const sizeMap = {
    sm: "px-3 py-1 text-[10px]",
    md: "px-4 py-1.5 text-xs",
    lg: "px-6 py-2.5 text-sm",
  };
  return (
    <div
      className={`inline-flex items-center justify-between gap-3 rounded-full bg-[#FFE48A] text-slate-950 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none font-serif ${sizeMap[size]} ${className}`}
      style={{ fontFamily: "var(--font-heading), 'Mckay', 'Cinzel', serif" }}
    >
      <div className="flex flex-col text-left">
        <span className="text-[0.7em] tracking-[0.18em] uppercase font-light leading-none">REJOICE IN</span>
        <span className="text-[1.1em] tracking-[0.08em] uppercase font-bold leading-tight">CHRIST</span>
      </div>
      <div className="flex flex-col text-right font-sans font-black text-[0.8em] leading-tight border-l border-slate-900/30 pl-2">
        <span>20</span>
        <span>27</span>
      </div>
    </div>
  );
}

/**
 * 7. Orange Circle Sticker ("20 27" on Yellow 20 #F68D2E)
 */
export function OrangeCircleSticker({ className = "", size = "md" }: StickerProps) {
  const sizeMap = {
    sm: "h-12 w-12 text-[10px]",
    md: "h-16 w-16 text-xs",
    lg: "h-24 w-24 text-base",
  };
  return (
    <div
      className={`inline-flex items-center justify-around rounded-full bg-[#F68D2E] text-slate-950 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none p-1.5 ${sizeMap[size]} ${className}`}
    >
      <div className="h-[75%] w-auto flex items-center justify-center">
        <FsyTempleMark colorMode="one-color" className="h-full w-auto" />
      </div>
      <div className="flex flex-col font-sans font-black leading-none text-[1.1em]">
        <span>20</span>
        <span>27</span>
      </div>
    </div>
  );
}
