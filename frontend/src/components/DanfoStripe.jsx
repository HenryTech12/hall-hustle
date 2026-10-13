import { COLORS } from "../styles/tokens";

export default function DanfoStripe({ height = 6 }) {
  return (
    <div
      style={{
        height,
        width: "100%",
        flexShrink: 0,
        backgroundImage: `repeating-linear-gradient(-45deg, ${COLORS.stripe} 0px, ${COLORS.stripe} 10px, ${COLORS.danfo} 10px, ${COLORS.danfo} 20px)`,
      }}
    />
  );
}
