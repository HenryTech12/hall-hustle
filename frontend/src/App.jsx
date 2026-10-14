import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SoundPreferenceProvider } from "./context/SoundPreferenceContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";

import SignupPage from "./pages/SignupPage";
import VerifyOtpPage from "./pages/VerifyOtpPage";
import LoginPage from "./pages/LoginPage";
import FeedPage from "./pages/FeedPage";
import SearchPage from "./pages/SearchPage";
import ComposePage from "./pages/ComposePage";
import InboxPage from "./pages/InboxPage";
import ProfilePage from "./pages/ProfilePage";
import ListingDetailPage from "./pages/ListingDetailPage";
import ChatPage from "./pages/ChatPage";
import BankDetailsPage from "./pages/BankDetailsPage";
import PaymentCallbackPage from "./pages/PaymentCallbackPage";
import EscrowPage from "./pages/EscrowPage";
import EscrowListPage from "./pages/EscrowListPage";
import RoommatePage from "./pages/RoommatePage";

export default function App() {
  return (
    <AuthProvider>
      <SoundPreferenceProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Full-screen routes rendered outside the tab-bar shell */}
          <Route
            path="/chat/:listingId/:otherUserId"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments/callback"
            element={
              <ProtectedRoute>
                <PaymentCallbackPage />
              </ProtectedRoute>
            }
          />

          {/* Main app shell with bottom nav */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<FeedPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/compose" element={<ComposePage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/bank-details" element={<BankDetailsPage />} />
            <Route path="/listing/:id" element={<ListingDetailPage />} />
            <Route path="/escrow/:id" element={<EscrowPage />} />
            <Route path="/escrows" element={<EscrowListPage />} />
            <Route path="/roommates" element={<RoommatePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </SoundPreferenceProvider>
    </AuthProvider>
  );
}
