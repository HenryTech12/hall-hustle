import { useEffect, useState, useCallback } from "react";
import { listingsApi } from "../api/listings";
import StoriesBar from "../components/StoriesBar";
import StoryViewer from "../components/StoryViewer";
import ListingCard from "../components/ListingCard";
import { COLORS } from "../styles/tokens";

export default function FeedPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeStory, setActiveStory] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listingsApi.browse();
      setListings(data);
    } catch {
      setError("Couldn't load listings. Pull to refresh or check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <StoriesBar onOpenStory={setActiveStory} />
      <StoryViewer listing={activeStory} onClose={() => setActiveStory(null)} />

      <div style={{ padding: "12px 0" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.muted, fontSize: 13 }}>Loading listings...</div>
        )}

        {!loading && error && (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.urgent, fontSize: 13 }}>{error}</div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.muted, fontSize: 13 }}>
            No listings yet. Be the first to post one from the + tab.
          </div>
        )}

        {!loading &&
          listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}

        {!loading && listings.length > 0 && (
          <div style={{ textAlign: "center", padding: "18px 20px 26px", color: COLORS.muted, fontSize: 12 }}>
            You're caught up. New listings drop as balloting news comes in.
          </div>
        )}
      </div>
    </div>
  );
}
