import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { paymentsApi } from "../api/payments";
import { authApi } from "../api/auth";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS } from "../styles/tokens";

export default function BankDetailsPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(true);

  useEffect(() => {
    paymentsApi
      .getBanks()
      .then(setBanks)
      .catch(() => setBanks([]))
      .finally(() => setLoadingBanks(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const updatedUser = await authApi.setBankDetails({ bank_code: bankCode, bank_account_number: accountNumber });
      setUser(updatedUser);
      localStorage.setItem("hh_user", JSON.stringify(updatedUser));
      setSuccess(`Verified: ${updatedUser.bank_account_name}`);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't verify those bank details."));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 16,
    background: "#fff",
    outline: "none",
    width: "100%",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: COLORS.paper }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontFamily: FONTS.display, fontSize: 15, color: COLORS.ink }}>BANK DETAILS</span>
      </div>

      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 16 }}>
          Add your bank account so HallHustle can pay you out when someone releases escrow funds to you.
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <select
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            required
            style={{ ...inputStyle, appearance: "auto" }}
            disabled={loadingBanks}
          >
            <option value="">{loadingBanks ? "Loading banks..." : "Select your bank"}</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>

          <input
            style={inputStyle}
            placeholder="10-digit account number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            maxLength={10}
            required
          />

          {error && <div style={{ color: COLORS.urgent, fontSize: 12.5 }}>{error}</div>}
          {success && <div style={{ color: COLORS.verified, fontSize: 12.5, fontWeight: 700 }}>{success}</div>}

          <button
            type="submit"
            disabled={loading || accountNumber.length !== 10 || !bankCode}
            style={{
              background: COLORS.danfo,
              border: "none",
              borderRadius: 8,
              padding: "13px 0",
              fontWeight: 800,
              fontSize: 14,
              color: COLORS.ink,
              cursor: "pointer",
              opacity: loading || accountNumber.length !== 10 || !bankCode ? 0.6 : 1,
            }}
          >
            {loading ? "Verifying..." : "Verify & save"}
          </button>
        </form>
      </div>
    </div>
  );
}
