import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { isOwnerEmail } from "@/lib/owner";
import { ASCEND_LOGO_URL } from "@/components/ascend/brand-mark";

function destinationFor(email: string | null | undefined): "/ascend/publications" | "/dashboard" {
  return isOwnerEmail(email) ? "/ascend/publications" : "/dashboard";
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
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#000000", color: "#ffffff", padding: 24, fontFamily: "Inter Tight Variable, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#000000", border: "1px solid #ffffff", borderRadius: 16, padding: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBlockEnd: 20 }}>
          <img
            src={ASCEND_LOGO_URL}
            alt="Ascend Publishing"
            width={140}
            height={140}
            style={{ width: 140, height: 140, objectFit: "contain", borderRadius: 18, background: "#000000", display: "block" }}
          />
        </div>
        <h1 style={{ fontFamily: "Fraunces Variable, serif", fontSize: 30, marginBlockEnd: 4, color: "#ffffff", textAlign: "center" }}>Ascend Publishing</h1>
        <p style={{ color: "#ffffff", opacity: 0.85, fontSize: 14, marginBlockEnd: 24, textAlign: "center" }}>
          {isVerifyPending
            ? "Verify your email address."
            : mode === "sign-in"
            ? "Sign in to the internal console."
            : "Create an account."}
        </p>

        {!isVerifyPending && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #ffffff", background: "#000000", color: "#ffffff", cursor: "pointer", marginBlockEnd: 16, fontWeight: 600 }}
            >
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ffffff", opacity: 0.7, fontSize: 11, marginBlockEnd: 16 }}>
              <div style={{ flex: 1, height: 1, background: "#ffffff", opacity: 0.4 }} /> OR <div style={{ flex: 1, height: 1, background: "#ffffff", opacity: 0.4 }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            readOnly={isVerifyPending}
            style={{ padding: "12px 12px", borderRadius: 10, border: "1px solid #ffffff", background: "#000000", color: "#ffffff", opacity: isVerifyPending ? 0.7 : 1 }}
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
              style={{ padding: "12px 12px", borderRadius: 10, border: "1px solid #ffffff", background: "#000000", color: "#ffffff" }}
            />
          )}
          {err && <div style={{ color: "#ffffff", background: "#330000", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>{err}</div>}
          {info && <div style={{ color: "#000000", background: "#ffffff", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>{info}</div>}

          {!isVerifyPending ? (
            <button
              type="submit"
              disabled={busy}
              style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: "#ffffff", color: "#000000", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "…" : mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={busy || resendCooldown > 0}
              style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: "#ffffff", color: "#000000", fontWeight: 700, cursor: "pointer", opacity: busy || resendCooldown > 0 ? 0.6 : 1 }}
            >
              {busy ? "…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
            </button>
          )}
        </form>

        {!isVerifyPending && (
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            style={{ marginBlockStart: 16, color: "#ffffff", fontSize: 13, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "center" }}
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
            style={{ marginBlockStart: 16, color: "#ffffff", fontSize: 13, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "center" }}
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
