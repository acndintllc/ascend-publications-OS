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
        background: "#000",
        color: "#fff",
        padding: 24,
        fontFamily: "Inter Tight Variable, system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 460 }}>
        <img
          src={ASCEND_LOGO_URL}
          alt="Ascend Publishing"
          width={160}
          height={160}
          style={{
            width: 160,
            height: 160,
            objectFit: "contain",
            borderRadius: 20,
            background: "#000",
            padding: 6,
            marginInline: "auto",
            marginBlockEnd: 24,
          }}
        />
        <h1 style={{ fontFamily: "Fraunces Variable, serif", fontSize: 34, margin: 0 }}>
          Ascend Publishing
        </h1>
        <p style={{ color: "#a0a0a0", fontSize: 14, marginBlock: "8px 28px" }}>
          Media is the Expression, Publication is Access.
        </p>

        {loading ? (
          <div style={{ color: "#666", fontSize: 13 }}>Loading…</div>
        ) : email ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              to={owner ? "/ascend/publications" : "/dashboard"}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                background: "#fff",
                color: "#000",
                fontWeight: 600,
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
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #2a2a2a",
                background: "transparent",
                color: "#a0a0a0",
                cursor: "pointer",
                fontSize: 13,
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
              padding: "12px 22px",
              borderRadius: 10,
              background: "#fff",
              color: "#000",
              fontWeight: 600,
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
