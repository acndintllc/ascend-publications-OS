/* ASCEND Publishing — shared brand mark.
   Single source of truth for the logo asset across the app. */
import * as React from "react";
import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/ascend-publishing-logo.png.asset.json";

export const ASCEND_LOGO_URL: string = logoAsset.url;

interface BrandMarkProps {
  size?: number;
  showWordmark?: boolean;
  tone?: "dark" | "light";
  asLink?: boolean;
  to?: string;
  tagline?: boolean;
}

export function BrandMark({
  size = 88,
  showWordmark = true,
  tone = "light",
  asLink = true,
  to = "/",
  tagline = false,
}: BrandMarkProps) {
  const ink = tone === "dark" ? "#ffffff" : "#000000";
  const sub = tone === "dark" ? "#ffffff" : "#000000";

  const inner = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        color: ink,
        lineHeight: 1,
      }}
    >
      <img
        src={ASCEND_LOGO_URL}
        alt="Ascend Publishing"
        width={size}
        height={size}
        style={{
          display: "block",
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: 6,
        }}
      />
      {showWordmark ? (
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: "var(--am-font-display, 'Fraunces', serif)",
              fontSize: Math.max(14, Math.round(size * 0.48)),
              letterSpacing: "0.01em",
              fontWeight: 500,
            }}
          >
            Ascend Publishing
          </span>
            {tagline ? (
              <span
                style={{
                  fontFamily: "var(--am-font-ui, 'Inter Tight', sans-serif)",
                  fontSize: Math.max(9, Math.round(size * 0.22)),
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: sub,
                }}
              >
                Media is the Expression, Publication is Access
              </span>
            ) : null}
        </span>
      ) : null}
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  );
}

export default BrandMark;
