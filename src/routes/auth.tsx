import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { bootstrapMyRole } from "@/lib/roles.functions";

async function tryBootstrap() {
  try { await bootstrapMyRole(); } catch (e) { console.warn("bootstrapMyRole failed", e); }
}


export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        await tryBootstrap();
        navigate({ to: "/ascend/publications" });
      }
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const fn = mode === "sign-in" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error } = await fn.call(supabase.auth, {
        email,
        password,
        ...(mode === "sign-up"
          ? { options: { emailRedirectTo: window.location.origin + "/ascend/publications" } }
          : {}),
      });
      if (error) throw error;
      await tryBootstrap();
      router.invalidate();
      navigate({ to: "/ascend/publications" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setErr(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/ascend/publications",
    });
    if (result.error) setErr(result.error.message);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#000", color: "#fff", padding: 24, fontFamily: "Inter Tight Variable, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 16, padding: 32 }}>
        <h1 style={{ fontFamily: "Fraunces Variable, serif", fontSize: 28, marginBlockEnd: 4 }}>Ascend Publishing</h1>
        <p style={{ color: "#a0a0a0", fontSize: 13, marginBlockEnd: 24 }}>
          {mode === "sign-in" ? "Sign in to the internal console." : "Create an account."}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #2a2a2a", background: "#111", color: "#fff", cursor: "pointer", marginBlockEnd: 16 }}
        >
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", fontSize: 11, marginBlockEnd: 16 }}>
          <div style={{ flex: 1, height: 1, background: "#1f1f1f" }} /> OR <div style={{ flex: 1, height: 1, background: "#1f1f1f" }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #2a2a2a", background: "#111", color: "#fff" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #2a2a2a", background: "#111", color: "#fff" }}
          />
          {err && <div style={{ color: "#ff6b6b", fontSize: 12 }}>{err}</div>}
          <button
            type="submit"
            disabled={busy}
            style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#fff", color: "#000", fontWeight: 600, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          style={{ marginBlockStart: 16, color: "#a0a0a0", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}
        >
          {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
