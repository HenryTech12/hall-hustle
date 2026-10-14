# HallHustle Frontend

React + Vite frontend for HallHustle, wired to the FastAPI backend, with
PWA support so students can install it to their home screen like a native
app.

## Stack
- React 18 + React Router
- Vite + `vite-plugin-pwa` (installable, offline-capable app shell)
- Axios for API calls, native WebSocket for real-time chat
- Plain inline styles matching the brand tokens in `src/styles/tokens.js`
  (danfo bus yellow/black stripe motif — same identity as the earlier
  prototype)

## Setup

```bash
npm install
cp .env.example .env
# set VITE_API_BASE_URL to wherever your backend is running

npm run dev       # http://localhost:3000, hot reload
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

Point `VITE_API_BASE_URL` at your FastAPI backend (see the
`hallhustle-backend` project). For local development that's usually
`http://localhost:8000`.

## What's wired up

- **Auth** — signup → OTP verification → login, JWT stored in
  `localStorage`, auto-attached to every API call via an axios
  interceptor (`src/api/client.js`)
- **Feed** — `GET /listings` + `GET /listings/urgent` power the main feed
  and the Instagram-style stories bar
- **Listing detail** — shows a "Pay via escrow (Paystack)" button for
  `have_space` listings, which calls `POST /payments/escrow/initialize`
  and redirects to Paystack's hosted checkout
- **Compose** — creates a listing, then uploads a photo separately via
  `POST /uploads/listing-photo/{id}` (Cloudinary) and patches the photo
  URL onto the listing
- **Chat** — `useWebSocketChat` hook connects to
  `WS /messages/ws/{listing_id}/{other_user_id}?token=...` for real-time
  messages, and falls back to polling `GET /messages/thread/...` every 4s
  if the socket can't connect (e.g. blocked by a restrictive network)
- **Bank details** — lets a user register payout details
  (`POST /auth/bank-details`) so they can receive escrow releases
- **Payment callback** — `/payments/callback` is where Paystack redirects
  after checkout; shown as a simple confirmation screen

## PWA — what "installable" actually means here

`vite-plugin-pwa` generates a web app manifest and service worker at
build time. On a phone, visiting the deployed site in Chrome or Safari
will offer an "Add to Home Screen" / "Install app" prompt, and it'll open
full-screen without browser chrome, with its own icon — no app store
needed.

**What is cached:** the app shell (JS/CSS bundle, icons) via the service
worker, so the app itself loads instantly on repeat visits, even on a
flaky connection.

**What is deliberately NOT cached:** anything under `/api` or any live
data (listings, messages, auth) — see `navigateFallbackDenylist` in
`vite.config.js`. Caching those would risk showing a student stale
listings or, worse, a stale "logged in" state after they've logged out
elsewhere. Every data fetch always hits your live backend.

**Icons:** placeholder icons are included in `public/icons/` (a simple
"H" mark on the brand's ink/danfo-yellow palette) so the manifest is
valid out of the box. Swap these for real branded icons before shipping
— `icon-192.png`, `icon-512.png`, and `icon-512-maskable.png` (the
maskable one needs ~10% safe-zone padding since Android may crop it to a
circle or squircle).

**Testing the installed experience locally:** `vite-plugin-pwa`'s dev
mode is disabled by default (`devOptions.enabled: false` in
`vite.config.js`) since service workers in dev mode often cause more
confusion than they're worth (stale caches during hot reload). To
actually test the install prompt and offline shell caching, run
`npm run build && npm run preview` and open that URL — production builds
are where the service worker is active.

## Known gaps / next steps

- **Real photo upload UX** — currently a single "tap to add a photo"
  square; consider multi-photo support if listings need more than one
  image.
- **Inbox thread names** — the inbox list currently doesn't resolve the
  other participant's name (backend `/messages/inbox` returns raw
  message rows, not enriched with user profiles) — worth adding a joined
  query backend-side if this bothers you before launch.
- **Push notifications** — the PWA shell doesn't yet register for web
  push (new message / listing interest alerts). Doable with the same
  service worker once you're ready — would need a backend endpoint to
  store push subscriptions and trigger sends.
- **Escrow release/dispute UI** — the payer can currently only release
  funds via the raw API (`POST /payments/escrow/{id}/release`); there's
  no frontend screen yet showing "funds held, tap to release" once a
  payment completes. Natural next screen to build.
- **No test suite** — same caveat as the backend; manually verified
  end-to-end (signup → login → create listing → browse → message →
  WebSocket chat) against a live local backend during development, but
  no automated frontend tests yet.

## Project structure

```
src/
  main.jsx              Entry point
  App.jsx                Routes
  context/
    AuthContext.jsx      Login state, token, current user
  api/
    client.js            Axios instance + auth header injection
    auth.js, listings.js, messages.js, payments.js, uploads.js
  hooks/
    useWebSocketChat.js  Real-time chat with polling fallback
  components/
    AppShell.jsx          Phone-frame layout wrapping authenticated pages
    TopHeader.jsx, BottomNav.jsx, DanfoStripe.jsx
    ListingCard.jsx        Feed card with dual in-app/WhatsApp CTA
    StoriesBar.jsx, StoryViewer.jsx
    ProtectedRoute.jsx
  pages/
    SignupPage, VerifyOtpPage, LoginPage
    FeedPage, SearchPage, ComposePage, InboxPage, ProfilePage
    ListingDetailPage    Escrow payment initiation
    ChatPage             Real-time WebSocket chat screen
    BankDetailsPage      Payout bank account setup
    PaymentCallbackPage  Post-Paystack-checkout confirmation
  styles/
    tokens.js            Shared brand colors/fonts
```
