import { createContext, useContext, useState } from "react";

const SoundPreferenceContext = createContext(null);

export function SoundPreferenceProvider({ children }) {
  // Starts muted (required for autoplay to work at all in any browser).
  // The moment the person taps unmute on any single post — a real user
  // gesture — we flip this globally, so every subsequent post they scroll
  // to also plays with sound, matching Instagram/TikTok behavior. Browsers
  // generally honor this because the gesture already "unlocked" audio for
  // the page for the rest of the session.
  const [soundEnabled, setSoundEnabled] = useState(false);
  return (
    <SoundPreferenceContext.Provider value={{ soundEnabled, setSoundEnabled }}>
      {children}
    </SoundPreferenceContext.Provider>
  );
}

export function useSoundPreference() {
  const ctx = useContext(SoundPreferenceContext);
  if (!ctx) throw new Error("useSoundPreference must be used within SoundPreferenceProvider");
  return ctx;
}
