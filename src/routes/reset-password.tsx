import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ASCEND_LOGO_URL } from "@/components/ascend/brand-mark";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase auto-processes the recovery hash on the client.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        // Listen for PASSWORD_RECOVERY event
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            setReady(true);
          }
        });
        // Fallback: if no session appears within 1.5s, show error
        const t = setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (!d2.session) {
              setErr("Reset link is invalid or expired. Request a new password reset from the sign-in page.");
            }
          });
        }, 1500);
        return () => {
          sub.subscription.unsubscribe();
          clearTimeout(t);
        };
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setInfo("Password updated. Redirecting to sign in…");
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.assign("/auth");
      }, 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update password");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#000000", color: "#e8e8e8", padding: 24, fontFamily: "Inter Tight Variable, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#0a0a0a", border: "1px solid #262626", borderRadius: 16, padding: 36 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBlockEnd: 18 }}>
          <img src={ASCEND_LOGO_URL} alt="Ascend Publishing" width={120} height={120} style={{ width: 120, height: 120, objectFit: "contain", display: "block" }} />
        </div>
        <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", fontSize: 26, margin: 0, marginBlockEnd: 4, color: "#e8c07a", textAlign: "center" }}>Reset your password</h1>
        <p style={{ color: "#a0a0a0", fontSize: 13, marginBlockEnd: 24, textAlign: "center" }}>Choose a new password for your account.</p>

        {!ready && !err && <div style={{ color: "#a0a0a0", fontSize: 13, textAlign: "center" }}>Verifying reset link…</div>}

        {ready && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                style={{ width: "100%", padding: "12px 52px 12px 14px", borderRadius: 10, border: "1px solid #262626", background: "#000000", color: "#e8e8e8", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#5cbdb9", fontSize: 12, cursor: "pointer", padding: "6px 8px", fontFamily: "inherit" }}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #262626", background: "#000000", color: "#e8e8e8", fontFamily: "inherit", fontSize: 14 }}
            />
            <button type="submit" disabled={busy} style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: "#e8c07a", color: "#111111", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 13 }}>
              {busy ? "…" : "Update password"}
            </button>
          </form>
        )}

        {err && <div style={{ marginBlockStart: 16, color: "#fca5a5", background: "#1a0808", border: "1px solid #5a1a1a", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>{err}</div>}
        {info && <div style={{ marginBlockStart: 16, color: "#86efac", background: "#081a0c", border: "1px solid #1a5a2a", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>{info}</div>}

        <button type="button" onClick={() => window.location.assign("/auth")} style={{ marginBlockStart: 16, color: "#5cbdb9", fontSize: 13, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "center", fontFamily: "inherit" }}>
          Back to sign in
        </button>
      </div>
    </div>
  );
}
