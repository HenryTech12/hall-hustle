import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ShieldCheck, Lock, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { paymentsApi } from "../api/payments";
import { extractErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS } from "../styles/tokens";

// Maps backend escrow status -> label, colour and which step of the timeline is active.
// If your backend uses different status strings, edit them here.
const STATUS = {
  pending: { label: "Awaiting payment", color: COLORS.muted, step: 0, Icon: Clock },
  held: { label: "In escrow", color: COLORS.danfoDeep, step: 1, Icon: Lock },
  released: { label: "Released to owner", color: COLORS.verified, step: 2, Icon: CheckCircle2 },
  disputed: { label: "Under dispute", color: COLORS.urgent, step: 1, Icon: AlertTriangle },
  refunded: { label: "Refunded", color: COLORS.muted, step: 2, Icon: CheckCircle2 },
};

const STEPS = ["Paid", "Held in escrow", "Move-in confirmed"];

export default function EscrowPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [escrow, setEscrow] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setEscrow(await paymentsApi.getEscrow(id));
      setError("");
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load this payment."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Paystack webhooks can land a few seconds after redirect: poll while still pending.
  useEffect(() => {
    if (escrow?.status !== "pending") return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [escrow?.status, load]);

  const isPayer = escrow && user && String(escrow.payer_id) === String(user.id);
  const meta = STATUS[escrow?.status] || STATUS.pending;

  const release = async () => {
    if (!window.confirm("Release the funds? Only do this once you have moved in. This can't be undone.")) return;
    setBusy(true);
    setActionError("");
    try {
      await paymentsApi.release(id);
      await load();
    } catch (err) {
      setActionError(extractErrorMessage(err, "Couldn't release the funds."));
    } finally {
      setBusy(false);
    }
  };

  const submitDispute = async () => {
    if (reason.trim().length < 10) {
      setActionError("Please describe the problem (at least 10 characters).");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await paymentsApi.dispute(id, reason.trim());
      setShowDispute(false);
      setReason("");
      await load();
    } catch (err) {
      setActionError(extractErrorMessage(err, "Couldn't submit the dispute."));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div style={{ padding: 30, textAlign: "center", color: COLORS.urgent, fontSize: 13 }}>{error}</div>;
  if (!escrow) return <div style={{ padding: 30, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>Loading...</div>;

  const amount = Number(escrow.amount || 0);
  const canAct = isPayer && escrow.status === "held";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: COLORS.paper }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontFamily: FONTS.display, fontSize: 15, color: COLORS.ink }}>ESCROW PAYMENT</span>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: meta.color, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
            <meta.Icon size={16} /> {meta.label}
          </div>
          <div style={{ fontFamily: FONTS.display, fontSize: 28, color: COLORS.ink }}>₦{amount.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            {isPayer ? "You are paying" : "You are receiving"}
            {escrow.hall_name ? ` · ${escrow.hall_name}` : ""}
          </div>
          {escrow.payout_amount != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.muted, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
              <span>Platform fee ({Math.round((Number(escrow.platform_fee) / (amount || 1)) * 1000) / 10}%, from owner's payout)</span>
              <span>₦{Number(escrow.platform_fee).toLocaleString()}</span>
            </div>
          )}
          {escrow.payout_amount != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: COLORS.ink, marginTop: 4 }}>
              <span>Owner receives</span>
              <span>₦{Number(escrow.payout_amount).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          {STEPS.map((s, i) => {
            const done = i <= meta.step && escrow.status !== "pending";
            return (
              <div key={s} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    width: 26, height: 26, borderRadius: "50%", margin: "0 auto 6px",
                    background: done ? COLORS.verified : COLORS.border, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontSize: 11, color: done ? COLORS.ink : COLORS.muted, fontWeight: done ? 700 : 500 }}>{s}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", background: "#E6F2EE", color: COLORS.verified, padding: 12, borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {escrow.status === "held" && (isPayer ? "Your money is safe. The owner only gets paid when you confirm move-in." : "The payment is secured. It will be released when the student confirms move-in.")}
            {escrow.status === "pending" && "Waiting for Paystack to confirm the payment. This page updates automatically."}
            {escrow.status === "released" && "Funds were released to the owner. This deal is complete."}
            {escrow.status === "disputed" && "The funds are frozen while the issue is reviewed. They will not be released to the owner."}
            {escrow.status === "refunded" && "This payment was refunded."}
          </span>
        </div>

        {canAct && !showDispute && (
          <>
            <button
              onClick={release}
              disabled={busy}
              style={{ width: "100%", background: COLORS.danfo, border: "none", borderRadius: 8, padding: "13px 0", fontWeight: 800, fontSize: 14, color: COLORS.ink, cursor: "pointer", marginBottom: 10, opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Working..." : "I've moved in — release funds"}
            </button>
            <button
              onClick={() => setShowDispute(true)}
              style={{ width: "100%", background: "#fff", border: `1px solid ${COLORS.urgent}`, borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 13.5, color: COLORS.urgent, cursor: "pointer" }}
            >
              Report a problem
            </button>
          </>
        )}

        {canAct && showDispute && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: COLORS.ink, marginBottom: 8 }}>What went wrong?</div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The room isn't as advertised / the owner is unreachable"
              rows={4}
              style={{ width: "100%", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, fontSize: 16, boxSizing: "border-box", resize: "none", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowDispute(false); setActionError(""); }} style={{ flex: 1, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={submitDispute} disabled={busy} style={{ flex: 1, background: COLORS.urgent, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 800, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
                {busy ? "Sending..." : "Freeze funds & report"}
              </button>
            </div>
          </div>
        )}

        {escrow.status === "disputed" && escrow.dispute_reason && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, fontSize: 12.5, color: COLORS.ink }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Reported problem</div>
            {escrow.dispute_reason}
          </div>
        )}

        {actionError && <div style={{ color: COLORS.urgent, fontSize: 12.5, marginTop: 10 }}>{actionError}</div>}
      </div>
    </div>
  );
}
