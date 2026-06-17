import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ASCEND_LOGO_URL } from "@/components/ascend/brand-mark";
import { supabase } from "@/integrations/supabase/client";
import { isOwnerEmail } from "@/lib/owner";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ASCEND Publishing OS — Sign in" },
      {
        name: "description",
        content:
          "ASCEND Publishing OS — sign in to your creator dashboard or owner console.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const owner = isOwnerEmail(email);
  const loading = email === undefined;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#000000",
        color: "#ffffff",
        padding: 24,
        fontFamily: "Inter Tight Variable, system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <img
          src={ASCEND_LOGO_URL}
          alt="Ascend Publishing"
          width={260}
          height={260}
          style={{
            width: 260,
            height: 260,
            objectFit: "contain",
            borderRadius: 24,
            background: "#000000",
            padding: 8,
            marginInline: "auto",
            marginBlockEnd: 28,
            display: "block",
          }}
        />
        <h1 style={{ fontFamily: "Fraunces Variable, serif", fontSize: 44, margin: 0, color: "#ffffff" }}>
          Ascend Publishing
        </h1>
        <p style={{ color: "#ffffff", fontSize: 15, marginBlock: "10px 32px", opacity: 0.9 }}>
          Media is the Expression, Publication is Access.
        </p>

        {loading ? (
          <div style={{ color: "#ffffff", fontSize: 14, opacity: 0.7 }}>Loading…</div>
        ) : email ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Link
              to={owner ? "/ascend/publications" : "/dashboard"}
              style={{
                padding: "14px 20px",
                borderRadius: 10,
                background: "#ffffff",
                color: "#000000",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {owner ? "Continue to Owner Dashboard" : "Continue to Dashboard"}
            </Link>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.assign("/auth");
              }}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #ffffff",
                background: "transparent",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Sign out ({email})
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            style={{
              display: "inline-block",
              padding: "14px 26px",
              borderRadius: 10,
              background: "#ffffff",
              color: "#000000",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Sign in or create an account
          </Link>
        )}
      </div>
    </main>
  );
}
