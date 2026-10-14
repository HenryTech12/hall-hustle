import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { paymentsApi } from "../api/payments";
import { extractErrorMessage } from "../api/client";
import { COLORS, FONTS } from "../styles/tokens";

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const [escrow, setEscrow] = useState(null);
  const [status, setStatus] = useState("checking"); // checking | held | pending | failed | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setErrorMsg("No payment reference found.");
      return;
    }
    let cancelled = false;
    let tries = 0;
    let timer;

    // The backend asks Paystack directly, so this works even before the webhook arrives.
    const check = async () => {
      try {
        const e = await paymentsApi.verifyReference(reference);
        if (cancelled) return;
        setEscrow(e);
        if (["held", "released", "disputed"].includes(e.status)) return setStatus("held");
        if (e.status === "failed") return setStatus("failed");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(extractErrorMessage(err, "Couldn't verify the payment."));
      }
      tries += 1;
      if (tries < 6) timer = setTimeout(check, 2500);
      else setStatus(errorMsg ? "error" : "pending");
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const view = {
    checking: { Icon: Clock, color: COLORS.muted, title: "CHECKING PAYMENT...", body: "Confirming with Paystack. This takes a few seconds." },
    held: { Icon: CheckCircle2, color: COLORS.verified, title: "PAYMENT SECURED", body: "Your money is held in escrow. It is only released to the owner when you confirm move-in." },
    pending: { Icon: Clock, color: COLORS.danfoDeep, title: "PAYMENT PROCESSING", body: "Paystack hasn't confirmed this payment yet. Check its status below." },
    failed: { Icon: AlertTriangle, color: COLORS.urgent, title: "PAYMENT NOT COMPLETED", body: "No money was taken. You can try again from the listing." },
    error: { Icon: AlertTriangle, color: COLORS.urgent, title: "COULDN'T CHECK PAYMENT", body: errorMsg || "Something went wrong." },
  }[status];

  return (
    <div style={{ padding: 30, textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <view.Icon size={48} color={view.color} />
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 18, color: COLORS.ink, marginBottom: 8 }}>{view.title}</div>
      <p style={{ fontSize: 13.5, color: COLORS.muted, marginBottom: 6 }}>{view.body}</p>
      {reference && <p style={{ fontSize: 11.5, color: COLORS.muted, marginBottom: 20 }}>Reference: {reference}</p>}

      {escrow && status !== "failed" && (
        <button
          onClick={() => navigate(`/escrow/${escrow.id}`)}
          style={{ display: "block", width: "100%", maxWidth: 280, margin: "0 auto 10px", background: COLORS.danfo, border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 800, fontSize: 13.5, color: COLORS.ink, cursor: "pointer" }}
        >
          View escrow &amp; release funds
        </button>
      )}
      <button onClick={() => navigate("/")} style={{ background: "none", border: "none", fontWeight: 700, fontSize: 13, color: COLORS.muted, cursor: "pointer" }}>
        Back to feed
      </button>
    </div>
  );
}
