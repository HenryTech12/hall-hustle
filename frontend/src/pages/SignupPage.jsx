import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/auth";
import { extractErrorMessage } from "../api/client";
import { COLORS, FONTS } from "../styles/tokens";
import DanfoStripe from "../components/DanfoStripe";

const inputStyle = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 16,
  background: "#fff",
  outline: "none",
  width: "100%",
};

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    matric_number: "",
    school_email: "",
    phone_number: "",
    password: "",
    faculty: "",
    department: "",
    level: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Student ID is optional: send null instead of an empty string.
      const res = await authApi.signup({ ...form, matric_number: form.matric_number.trim() || null });
      navigate("/verify-otp", { state: { school_email: res.school_email } });
    } catch (err) {
      setError(extractErrorMessage(err, "Signup failed. Please check your details."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#DDD3BB", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          minHeight: "100dvh",
          background: COLORS.paper,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "max(28px, env(safe-area-inset-top)) 20px 10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
            <span style={{ fontFamily: FONTS.display, fontSize: 26, color: COLORS.ink }}>HALL</span>
            <span style={{ fontFamily: FONTS.display, fontSize: 26, color: COLORS.urgent }}>HUSTLE</span>
          </div>
          <p style={{ color: COLORS.muted, fontSize: 13, margin: 0 }}>Verified student housing. Rent protected by escrow. Starting in Lagos.</p>
        </div>
        <DanfoStripe height={4} />

        <form onSubmit={submit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, flex: 1, justifyContent: "center", maxWidth: 420, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <input style={inputStyle} placeholder="Full name" value={form.full_name} onChange={update("full_name")} required />
          <input style={inputStyle} placeholder="Student ID / matric number (optional)" value={form.matric_number} onChange={update("matric_number")} />
          <input
            style={inputStyle}
            type="email"
            placeholder="Email address"
            value={form.school_email}
            onChange={update("school_email")}
            required
          />
          <input style={inputStyle} placeholder="Phone number" value={form.phone_number} onChange={update("phone_number")} required />
          <input
            style={inputStyle}
            type="password"
            placeholder="Password (min 8 characters)"
            value={form.password}
            onChange={update("password")}
            minLength={8}
            required
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} placeholder="Faculty" value={form.faculty} onChange={update("faculty")} />
            <input style={inputStyle} placeholder="Level (e.g. 100L)" value={form.level} onChange={update("level")} />
          </div>
          <input style={inputStyle} placeholder="Department" value={form.department} onChange={update("department")} />

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
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>

          <p style={{ textAlign: "center", fontSize: 13, color: COLORS.muted }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: COLORS.verified, fontWeight: 700 }}>
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
