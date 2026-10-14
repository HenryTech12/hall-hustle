import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, MessageCircle, Pencil, Users } from "lucide-react";
import { roommatesApi } from "../api/roommates";
import { usersApi } from "../api/users";
import { extractErrorMessage } from "../api/client";
import { COLORS, FONTS } from "../styles/tokens";

const EMPTY = {
  gender: "",
  same_gender_only: true,
  budget_min: 400000,
  budget_max: 800000,
  sleep_schedule: "flexible",
  cleanliness: 3,
  noise_tolerance: 3,
  guests_comfort: 3,
  smokes: false,
  accepts_smoking: false,
  preferred_area: "",
  bio: "",
  is_active: true,
};

const card = { background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 12 };
const label = { fontSize: 12.5, fontWeight: 700, color: COLORS.ink, marginBottom: 6, display: "block" };
const input = { width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 16, background: "#fff" };

function Chips({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          style={{ padding: "8px 12px", borderRadius: 18, border: `1px solid ${value === v ? COLORS.ink : COLORS.border}`, background: value === v ? COLORS.ink : "#fff", color: value === v ? COLORS.danfo : COLORS.ink, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Scale({ value, onChange, low, high }) {
  return (
    <div>
      <Chips value={value} onChange={onChange} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function scoreColor(score) {
  if (score >= 75) return COLORS.verified;
  if (score >= 50) return COLORS.danfoDeep;
  return COLORS.urgent;
}

export default function RoommatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [hasProfile, setHasProfile] = useState(null); // null = loading
  const [editing, setEditing] = useState(false);
  const [matches, setMatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const loadMatches = () =>
    roommatesApi.getMatches().then(setMatches).catch((e) => setError(extractErrorMessage(e, "Couldn't load matches.")));

  useEffect(() => {
    roommatesApi
      .getMine()
      .then((p) => {
        setForm({ ...EMPTY, ...p, preferred_area: p.preferred_area || "", bio: p.bio || "" });
        setHasProfile(true);
        loadMatches();
      })
      .catch((e) => {
        if (e?.response?.status === 404) setHasProfile(false);
        else setError(extractErrorMessage(e, "Couldn't load your profile."));
      });
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.gender) return setError("Please choose your gender (used only to match same-gender roommates).");
    setSaving(true);
    try {
      await roommatesApi.saveMine({
        ...form,
        budget_min: Number(form.budget_min),
        budget_max: Number(form.budget_max),
        preferred_area: form.preferred_area.trim() || null,
        bio: form.bio.trim() || null,
      });
      setHasProfile(true);
      setEditing(false);
      await loadMatches();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : extractErrorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  };

  const contact = async (m) => {
    if (m.listing_id) return navigate(`/chat/${m.listing_id}/${m.user.id}`);
    try {
      const p = await usersApi.getPublicProfile(m.user.id);
      const digits = (p.phone_number || "").replace(/\D/g, "");
      if (digits) window.open(`https://wa.me/${digits}`, "_blank");
    } catch {
      setError("Couldn't open contact details.");
    }
  };

  if (hasProfile === null && !error) return <div style={{ padding: 30, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>Loading...</div>;

  const showForm = hasProfile === false || editing;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={20} color={COLORS.ink} />
          <span style={{ fontFamily: FONTS.display, fontSize: 16, color: COLORS.ink }}>ROOMMATE MATCH</span>
        </div>
        {!showForm && (
          <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", fontWeight: 700, fontSize: 12.5, color: COLORS.muted, cursor: "pointer" }}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>

      {showForm ? (
        <form onSubmit={save}>
          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 0 }}>Answer a few questions and we'll rank verified students by compatibility.</p>

          <div style={card}>
            <span style={label}>I am</span>
            <Chips value={form.gender} onChange={set("gender")} options={[["male", "Male"], ["female", "Female"]]} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginTop: 10, color: COLORS.ink }}>
              <input type="checkbox" checked={form.same_gender_only} onChange={(e) => set("same_gender_only")(e.target.checked)} />
              Only match me with the same gender
            </label>
          </div>

          <div style={card}>
            <span style={label}>Yearly rent budget (₦)</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={input} type="number" inputMode="numeric" value={form.budget_min} onChange={(e) => set("budget_min")(e.target.value)} placeholder="Min" />
              <input style={input} type="number" inputMode="numeric" value={form.budget_max} onChange={(e) => set("budget_max")(e.target.value)} placeholder="Max" />
            </div>
          </div>

          <div style={card}>
            <span style={label}>Sleep schedule</span>
            <Chips value={form.sleep_schedule} onChange={set("sleep_schedule")} options={[["early", "Early riser"], ["flexible", "Flexible"], ["late", "Night owl"]]} />
          </div>

          <div style={card}>
            <span style={label}>Cleanliness</span>
            <Scale value={form.cleanliness} onChange={set("cleanliness")} low="Relaxed" high="Very tidy" />
          </div>
          <div style={card}>
            <span style={label}>Noise tolerance</span>
            <Scale value={form.noise_tolerance} onChange={set("noise_tolerance")} low="Need quiet" high="Fine with noise" />
          </div>
          <div style={card}>
            <span style={label}>Guests over</span>
            <Scale value={form.guests_comfort} onChange={set("guests_comfort")} low="Rarely" high="Often" />
          </div>

          <div style={card}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink, marginBottom: 8 }}>
              <input type="checkbox" checked={form.smokes} onChange={(e) => set("smokes")(e.target.checked)} /> I smoke
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink }}>
              <input type="checkbox" checked={form.accepts_smoking} onChange={(e) => set("accepts_smoking")(e.target.checked)} /> I'm okay with a roommate who smokes
            </label>
          </div>

          <div style={card}>
            <span style={label}>Preferred area (optional)</span>
            <input style={input} value={form.preferred_area} onChange={(e) => set("preferred_area")(e.target.value)} placeholder="e.g. Akoka, Iwaya, Abule Oja" />
            <span style={{ ...label, marginTop: 12 }}>Short bio (optional)</span>
            <textarea style={{ ...input, resize: "none" }} rows={2} maxLength={280} value={form.bio} onChange={(e) => set("bio")(e.target.value)} placeholder="A line about you" />
          </div>

          {error && <div style={{ color: COLORS.urgent, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <button type="submit" disabled={saving} style={{ width: "100%", background: COLORS.danfo, border: "none", borderRadius: 8, padding: "13px 0", fontWeight: 800, fontSize: 14, color: COLORS.ink, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : hasProfile ? "Save & refresh matches" : "Find my matches"}
          </button>
          {editing && (
            <button type="button" onClick={() => setEditing(false)} style={{ width: "100%", background: "none", border: "none", marginTop: 8, fontWeight: 700, color: COLORS.muted, cursor: "pointer" }}>
              Cancel
            </button>
          )}
        </form>
      ) : (
        <>
          {error && <div style={{ color: COLORS.urgent, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          {matches.length === 0 && !error && (
            <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 13, marginTop: 24 }}>
              No matches yet. As more verified students add their profiles, they'll show up here.
            </div>
          )}
          {matches.map((m) => (
            <div key={m.user.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: COLORS.ink }}>{m.user.full_name}</span>
                    {m.user.is_verified && <BadgeCheck size={15} color={COLORS.verified} />}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{[m.user.department, m.user.level].filter(Boolean).join(" · ")}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: FONTS.display, fontSize: 24, color: scoreColor(m.score), lineHeight: 1 }}>{m.score}%</div>
                  <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>MATCH</div>
                </div>
              </div>

              {m.bio && <p style={{ fontSize: 13, color: COLORS.ink, margin: "10px 0 6px" }}>{m.bio}</p>}
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
                ₦{m.budget_min.toLocaleString()} – ₦{m.budget_max.toLocaleString()} / yr{m.preferred_area ? ` · ${m.preferred_area}` : ""}
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {m.reasons.map((r) => (
                  <span key={r} style={{ fontSize: 11, fontWeight: 700, color: COLORS.verified, background: "#E6F2EE", padding: "3px 8px", borderRadius: 12 }}>{r}</span>
                ))}
                {m.cautions.map((c) => (
                  <span key={c} style={{ fontSize: 11, fontWeight: 700, color: COLORS.urgent, background: "#FBE9E4", padding: "3px 8px", borderRadius: 12 }}>{c}</span>
                ))}
              </div>

              <button onClick={() => contact(m)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", background: COLORS.ink, border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 800, fontSize: 13, color: COLORS.danfo, cursor: "pointer" }}>
                <MessageCircle size={15} /> {m.listing_id ? "Message" : "Contact on WhatsApp"}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
