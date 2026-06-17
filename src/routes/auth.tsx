import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getMyRole } from "@/lib/roles.functions";
import { ASCEND_LOGO_URL } from "@/components/ascend/brand-mark";

async function destinationForCurrentUser(): Promise<"/ascend/publications" | "/dashboard"> {
  try {
    const role = await getMyRole();
    return role.isOwner ? "/ascend/publications" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function goTo(path: string) {
  window.location.assign(path);
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "verify-pending">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle email-confirmation redirect (hash contains tokens from Supabase)
  useEffect(() => {
    async function handleHash() {
      const hash = window.location.hash;
      if (hash.includes("access_token") && hash.includes("type=signup")) {
        setBusy(true);
        setInfo("Confirming your email…");
        // Supabase auto-exchanges the tokens when the client is created, but
        // we need to explicitly process the hash to get the session.
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          setErr("Confirmation link expired or invalid. Please sign in or resend a new code.");
          setBusy(false);
          // Clean the hash so we don't re-process on refresh
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          return;
        }
        goTo(destinationFor(data.user.email));
      }
    }
    handleHash();
  }, []);

  // If already signed in when landing here, send them onward.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) goTo(destinationFor(data.user.email));
    });
  }, [navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      intervalRef.current = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [resendCooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      if (mode === "sign-in") {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        goTo(destinationFor(data.user?.email ?? email));
        return;
      }

      // sign-up flow
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/auth",
        },
      });
      if (error) throw error;

      // Auto-confirm path: session exists immediately
      if (data.session) {
        goTo(destinationFor(data.user?.email ?? email));
        return;
      }

      // Email confirmation required
      if (data.user && data.user.identities && data.user.identities.length > 0) {
        setMode("verify-pending");
        setInfo("A confirmation email was sent. Please check your inbox (and spam).");
        setBusy(false);
        return;
      }

      // Fallback: try to sign in immediately (handles auto-confirm edge cases)
      const { error: siErr, data: siData } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (siErr) {
        setErr("Account created. Please check your email for a confirmation link.");
        setBusy(false);
        return;
      }
      goTo(destinationFor(siData.user?.email ?? email));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !email) return;
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: window.location.origin + "/auth",
        },
      });
      if (error) throw error;
      setInfo("A new confirmation email has been sent.");
      setResendCooldown(60);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to resend code");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setErr(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/",
    });
    if (result.error) {
      setErr(result.error.message);
      return;
    }
    if (result.redirected) return;
    const { data } = await supabase.auth.getUser();
    goTo(destinationFor(data.user?.email));
  }

  const isVerifyPending = mode === "verify-pending";

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#000000", color: "#e8e8e8", padding: 24, fontFamily: "Inter Tight Variable, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#0a0a0a", border: "1px solid #262626", borderRadius: 16, padding: 36 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBlockEnd: 18 }}>
          <img
            src={ASCEND_LOGO_URL}
            alt="Ascend Publishing"
            width={120}
            height={120}
            style={{ width: 120, height: 120, objectFit: "contain", display: "block" }}
          />
        </div>
        <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", fontSize: 30, margin: 0, marginBlockEnd: 4, color: "#e8c07a", textAlign: "center" }}>Ascend Publishing</h1>
        <p style={{ color: "#5cbdb9", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", marginBlockEnd: 6, textAlign: "center" }}>
          Media is the Expression, Publication is the Access
        </p>
        <p style={{ color: "#a0a0a0", fontSize: 13, marginBlockEnd: 24, textAlign: "center" }}>
          {isVerifyPending
            ? "Verify your email address."
            : mode === "sign-in"
            ? "Sign in to your publishing workspace."
            : "Create your publishing account."}
        </p>

        {!isVerifyPending && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #3a3a3a", background: "#000000", color: "#e8e8e8", cursor: "pointer", marginBlockEnd: 16, fontWeight: 600, fontFamily: "inherit" }}
            >
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6a6a6a", fontSize: 11, marginBlockEnd: 16, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              <div style={{ flex: 1, height: 1, background: "#262626" }} /> or <div style={{ flex: 1, height: 1, background: "#262626" }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            readOnly={isVerifyPending}
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #262626", background: "#000000", color: "#e8e8e8", opacity: isVerifyPending ? 0.7 : 1, fontFamily: "inherit", fontSize: 14 }}
          />
          {!isVerifyPending && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #262626", background: "#000000", color: "#e8e8e8", fontFamily: "inherit", fontSize: 14 }}
            />
          )}
          {err && <div style={{ color: "#fca5a5", background: "#1a0808", border: "1px solid #5a1a1a", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>{err}</div>}
          {info && <div style={{ color: "#86efac", background: "#081a0c", border: "1px solid #1a5a2a", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>{info}</div>}

          {!isVerifyPending ? (
            <button
              type="submit"
              disabled={busy}
              style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: "#e8c07a", color: "#111111", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13 }}
            >
              {busy ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={busy || resendCooldown > 0}
              style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: "#e8c07a", color: "#111111", fontWeight: 700, cursor: "pointer", opacity: busy || resendCooldown > 0 ? 0.6 : 1, fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13 }}
            >
              {busy ? "…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
            </button>
          )}
        </form>

        {!isVerifyPending && (
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            style={{ marginBlockStart: 16, color: "#5cbdb9", fontSize: 13, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "center", fontFamily: "inherit" }}
          >
            {mode === "sign-in" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        )}

        {isVerifyPending && (
          <button
            type="button"
            onClick={() => {
              setMode("sign-in");
              setInfo(null);
              setErr(null);
            }}
            style={{ marginBlockStart: 16, color: "#5cbdb9", fontSize: 13, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "center", fontFamily: "inherit" }}
          >
            Back to sign in
          </button>
        )}
      </div>

      <div style={{ maxWidth: 520, marginTop: 28, textAlign: "center", color: "#a0a0a0", fontSize: 12, lineHeight: 1.6 }}>
        <div style={{ fontFamily: "Fraunces Variable, Fraunces, serif", fontSize: 15, color: "#e8c07a", marginBottom: 8 }}>
          Own your voice. Let us help the world hear it.
        </div>
        The ultimate publishing workspace for creators. Publish books, music, and more with ASCEND Publishing. Make the world your audience.
      </div>
    </div>
  );
}
