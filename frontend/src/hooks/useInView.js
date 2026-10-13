import { useEffect, useRef, useState } from "react";

/**
 * Returns whether the observed element is currently "in focus" on screen —
 * i.e. the post is the one the person is actually looking at while
 * scrolling, not just technically present in the DOM. Threshold of 0.6
 * means at least 60% of the card must be visible before we count it as
 * focused, which avoids two adjacent cards both claiming focus during a
 * fast scroll.
 */
export function useInView(threshold = 0.6) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
