import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS } from "../styles/tokens";
import DanfoStripe from "../components/DanfoStripe";

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { persistSession } = useAuth();

  const [email, setEmail] = useState(location.state?.school_email || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyOtp({ school_email: email, code });
      persistSession(res.access_token, res.user);
      navigate("/");
    } catch (err) {
      setError(extractErrorMessage(err, "Verification failed."));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setInfo("");
    setResending(true);
    try {
      await authApi.resendOtp({ school_email: email });
      setInfo("A new code has been sent to your email.");
    } catch (err) {
      setError(extractErrorMessage(err, "Could not resend code."));
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#DDD3BB", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, background: COLORS.paper, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "max(28px, env(safe-area-inset-top)) 20px 10px" }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 20, color: COLORS.ink }}>VERIFY YOUR EMAIL</div>
          <p style={{ color: COLORS.muted, fontSize: 13 }}>
            We sent a 6-digit code to <b>{email || "your email"}</b>
          </p>
        </div>
        <DanfoStripe height={4} />

        <form onSubmit={submit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, flex: 1, justifyContent: "center", maxWidth: 420, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {!location.state?.school_email && (
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 16, background: "#fff" }}
            />
          )}
          <input
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            maxLength={6}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: "14px",
              fontSize: 22,
              letterSpacing: 8,
              textAlign: "center",
              background: "#fff",
              fontFamily: FONTS.display,
            }}
          />

          {error && <div style={{ color: COLORS.urgent, fontSize: 12.5 }}>{error}</div>}
          {info && <div style={{ color: COLORS.verified, fontSize: 12.5 }}>{info}</div>}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              background: COLORS.danfo,
              border: "none",
              borderRadius: 8,
              padding: "13px 0",
              fontWeight: 800,
              fontSize: 14,
              color: COLORS.ink,
              cursor: "pointer",
              opacity: loading || code.length !== 6 ? 0.6 : 1,
            }}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>

          <button
            type="button"
            onClick={resend}
            disabled={resending}
            style={{ background: "none", border: "none", color: COLORS.verified, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            {resending ? "Sending..." : "Resend code"}
          </button>
        </form>
      </div>
    </div>
  );
}
