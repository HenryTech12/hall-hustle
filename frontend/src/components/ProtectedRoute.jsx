import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../styles/tokens";

export default function ProtectedRoute({ children }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.paper }}>
        <div
          style={{
            width: 28,
            height: 28,
            border: `3px solid ${COLORS.border}`,
            borderTopColor: COLORS.urgent,
            borderRadius: "50%",
            animation: "hh-spin 0.7s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
