import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { listingsApi } from "../api/listings";
import ListingCard from "../components/ListingCard";
import { COLORS } from "../styles/tokens";

const HALLS = ["Moremi", "Kofo Ademola", "Mariere", "Fagunwa", "El-Kanemi", "Jaja", "Amina", "Eni Njoku"];

export default function SearchPage() {
  const [hallName, setHallName] = useState("");
  const [listingType, setListingType] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const runSearch = async (overrides = {}) => {
    setLoading(true);
    setSearched(true);
    try {
      const params = {};
      const hn = overrides.hall_name ?? hallName;
      const lt = overrides.listing_type ?? listingType;
      if (hn) params.hall_name = hn;
      if (lt) params.listing_type = lt;
      const data = await listingsApi.browse(params);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
        <SearchIcon size={16} color={COLORS.muted} />
        <input
          value={hallName}
          onChange={(e) => setHallName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search by hall name..."
          style={{ border: "none", outline: "none", fontSize: 16, flex: 1, background: "transparent", minWidth: 0 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        {HALLS.map((h) => (
          <button
            key={h}
            onClick={() => {
              setHallName(h);
              runSearch({ hall_name: h });
            }}
            style={{
              border: `1px solid ${COLORS.border}`,
              background: hallName === h ? COLORS.danfo : "#fff",
              borderRadius: 20,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.ink,
              cursor: "pointer",
            }}
          >
            {h}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "", label: "All" },
          { key: "need_space", label: "Need space" },
          { key: "have_space", label: "Have space" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setListingType(t.key);
              runSearch({ listing_type: t.key });
            }}
            style={{
              border: "none",
              background: listingType === t.key ? COLORS.ink : "#fff",
              color: listingType === t.key ? COLORS.danfo : COLORS.ink,
              borderRadius: 20,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 13, padding: 30 }}>Searching...</div>}

      {!loading && searched && results.length === 0 && (
        <div style={{ textAlign: "center", color: COLORS.muted, fontSize: 13, padding: 30 }}>No listings match that search.</div>
      )}

      {!loading && results.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
    </div>
  );
}
