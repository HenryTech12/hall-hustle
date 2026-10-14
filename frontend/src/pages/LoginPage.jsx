import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS } from "../styles/tokens";
import DanfoStripe from "../components/DanfoStripe";

export default function LoginPage() {
  const navigate = useNavigate();
  const { persistSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login({ school_email: email, password });
      persistSession(res.access_token, res.user);
      navigate("/");
    } catch (err) {
      const msg = extractErrorMessage(err, "Login failed.");
      if (msg.toLowerCase().includes("verify")) {
        navigate("/verify-otp", { state: { school_email: email } });
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#DDD3BB", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, background: COLORS.paper, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "max(28px, env(safe-area-inset-top)) 20px 10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
            <span style={{ fontFamily: FONTS.display, fontSize: 26, color: COLORS.ink }}>HALL</span>
            <span style={{ fontFamily: FONTS.display, fontSize: 26, color: COLORS.urgent }}>HUSTLE</span>
          </div>
          <p style={{ color: COLORS.muted, fontSize: 13, margin: 0 }}>Welcome back</p>
        </div>
        <DanfoStripe height={4} />

        <form onSubmit={submit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, flex: 1, justifyContent: "center", maxWidth: 420, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 16, background: "#fff" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 16, background: "#fff" }}
          />

          {error && <div style={{ color: COLORS.urgent, fontSize: 12.5 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              background: COLORS.danfo,
              border: "none",
              borderRadius: 8,
              padding: "13px 0",
              fontWeight: 800,
              fontSize: 14,
              color: COLORS.ink,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <p style={{ textAlign: "center", fontSize: 13, color: COLORS.muted }}>
            New here?{" "}
            <Link to="/signup" style={{ color: COLORS.verified, fontWeight: 700 }}>
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
