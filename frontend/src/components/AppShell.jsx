import { Outlet } from "react-router-dom";
import TopHeader from "./TopHeader";
import BottomNav from "./BottomNav";
import { COLORS } from "../styles/tokens";

export default function AppShell() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#DDD3BB",
        display: "flex",
        justifyContent: "center",
      }}
    >
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
        <TopHeader />
        <div style={{ flex: 1, overflowY: "auto", background: COLORS.feedBg }}>
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </div>
  );
}
