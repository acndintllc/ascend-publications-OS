/* Universal application shell for ASCEND Publishing.
   Provides the persistent black-paper chrome (logo, slogan, brand statement,
   sign out) that wraps every authenticated route. Inner reader content keeps
   its bookish white surface via the `.ap-shell [data-am="chapter"]` token
   override defined in src/styles.css. */
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ASCEND_LOGO_URL } from "./brand-mark";

export const SLOGAN_PRIMARY = "Media is the Expression, Publication is the Access";
export const SLOGAN_SECONDARY = "Own your voice. Let us help the world hear it.";
export const BRAND_STATEMENT =
  "The ultimate publishing workspace for creators. Publish books, music, and more with ASCEND Publishing. Make the world your audience.";

const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";
const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";

export function AppShell({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  return (
    <div
      className="ap-shell"
      style={{
        minHeight: "100dvh",
        background: "#000000",
        color: FG,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter Tight Variable, system-ui, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${LINE}`,
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
          background: "#000000",
        }}
      >
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            textDecoration: "none",
            color: FG,
            minWidth: 0,
          }}
        >
          <img
            src={ASCEND_LOGO_URL}
            alt="Ascend Publishing"
            width={68}
            height={68}
            style={{ width: 68, height: 68, objectFit: "contain", flexShrink: 0 }}
          />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "Fraunces Variable, Fraunces, serif",
                fontSize: 22,
                color: GOLD,
                letterSpacing: "0.01em",
              }}
            >
              Ascend Publishing
            </span>
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: TEAL,
                marginTop: 4,
              }}
            >
              {SLOGAN_PRIMARY}
            </span>
          </span>
        </Link>

        {eyebrow ? (
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: MUTED,
              paddingInlineStart: 8,
              borderInlineStart: `1px solid ${LINE}`,
            }}
          >
            {eyebrow}
          </span>
        ) : null}

        <nav
          style={{
            marginInlineStart: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 12,
          }}
        >
          <button
            type="button"
            onClick={signOut}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${LINE}`,
              background: "transparent",
              color: FG,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </nav>
      </header>

      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>

      <footer
        style={{
          borderTop: `1px solid ${LINE}`,
          padding: "28px 24px 36px",
          textAlign: "center",
          color: MUTED,
          fontSize: 12,
          background: "#000000",
        }}
      >
        <div
          style={{
            fontFamily: "Fraunces Variable, Fraunces, serif",
            fontSize: 16,
            color: GOLD,
            marginBottom: 8,
            letterSpacing: "0.02em",
          }}
        >
          {SLOGAN_SECONDARY}
        </div>
        <div style={{ maxWidth: 680, marginInline: "auto", lineHeight: 1.6 }}>
          {BRAND_STATEMENT}
        </div>
      </footer>
    </div>
  );
}

export default AppShell;
