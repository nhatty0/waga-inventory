"use client";

import React, { useState, useEffect } from "react";

export interface WagaLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  priorityImage?: boolean;
}

const sizeClasses: Record<string, string> = {
  xs: "w-7 h-7",
  sm: "w-9 h-9",
  md: "w-12 h-12",
  lg: "w-20 h-20",
  xl: "w-24 h-24",
};

export default function WagaLogo({
  size = "md",
  className = "",
  priorityImage = true,
}: WagaLogoProps) {
  const [imgAvailable, setImgAvailable] = useState<boolean>(false);

  useEffect(() => {
    if (priorityImage && typeof window !== "undefined") {
      const img = new window.Image();
      img.src = "/logo.png";
      img.onload = () => setImgAvailable(true);
      img.onerror = () => setImgAvailable(false);
    }
  }, [priorityImage]);

  const sizeClass = typeof size === "string" ? sizeClasses[size] || "w-12 h-12" : "";
  const customStyle = typeof size === "number" ? { width: size, height: size } : undefined;

  if (imgAvailable) {
    return (
      <img
        src="/logo.png"
        alt="Waga Stock"
        className={`object-contain rounded-2xl shadow-lg border border-[#10b981]/40 shrink-0 ${sizeClass} ${className}`}
        style={customStyle}
      />
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}
      style={customStyle}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        {/* Dark rounded-square container (#0a0e17) with emerald-green border (#10b981) */}
        <rect
          x="3"
          y="3"
          width="94"
          height="94"
          rx="22"
          fill="#0a0e17"
          stroke="#10b981"
          strokeWidth="3.5"
        />
        {/* Subtle decorative inner ring */}
        <rect
          x="6.5"
          y="6.5"
          width="87"
          height="87"
          rx="18.5"
          fill="none"
          stroke="#10b981"
          strokeWidth="0.8"
          strokeOpacity="0.25"
        />
        {/* Centered bold emerald-green Amharic text "ዋጋ" */}
        <text
          x="50"
          y="47"
          fill="#10b981"
          fontSize="38"
          fontWeight="900"
          fontFamily="'Noto Sans Ethiopic', 'Abyssinica SIL', system-ui, -apple-system, sans-serif"
          textAnchor="middle"
          dominantBaseline="central"
        >
          ዋጋ
        </text>
        {/* Gold/amber uppercase text "WAGA STOCK" (#f59e0b) directly underneath */}
        <text
          x="50"
          y="76"
          fill="#f59e0b"
          fontSize="8.5"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          textAnchor="middle"
          letterSpacing="1.2"
        >
          WAGA STOCK
        </text>
      </svg>
    </div>
  );
}
