# Lakeridge Ward Atlas (Interactive Prototype)

A private, residential-first coordination web application designed to help ward leaders coordinate visits, follow-up assignments, and neighborhood notes at residential addresses.

## Core Architectural Principle

- **Properties & Physical Addresses are Primary**: Residential records are tied to physical parcels and street addresses rather than permanent ecclesiastical membership records.
- **Occupants May Change**: When residents move or rentals turn over, the property's household notes and active coordination are updated without altering historical address context or creating permanent member tracking files.
- **No AI / No Membership Imports**: Designed strictly for practical leader visit coordination with private shared persistence.

---

## Getting Started Locally

To run this exported prototype on your local machine:

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```

### 3. Open in Browser
Navigate to `http://localhost:3001` (or the local port printed in your terminal).

## Deploying to Vercel

This is a Vite app with Vercel serverless API routes for Neon-backed records. Use these settings:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install` (Vercel can also detect the npm lockfile automatically)
- **Root directory:** repository root

The API requires `DATABASE_URL` and the Google sign-in settings below in the Vercel project environment. Run `npm run db:migrate` against the Neon database before using the API. For local full-stack development, use `npm run dev` after installing the Vercel CLI dependency; this runs Vercel's local function host.

The shared database stores the atlas records as a JSONB snapshot in `atlas_state`, with a revision number. Saves atomically compare that revision before updating, so a stale browser cannot overwrite newer changes. Run `npm run db:migrate` with `DATABASE_URL` set **before deploying this version**. The migration copies existing `properties` records on first run and is safe to rerun; the legacy table remains untouched. After migration, `atlas_state` is the source of truth. The API requires a signed Google session and rechecks the configured authorized email on every request. The old shared access token is no longer accepted.

### Optional Google Maps key

The app uses the vector map when `VITE_GOOGLE_MAPS_API_KEY` is not set. To enable Google Maps, add `VITE_GOOGLE_MAPS_API_KEY` as an environment variable in Vercel and restrict that browser key to your deployed domain and the Google Maps APIs you enable. Vite embeds `VITE_` variables into browser code, so this key is public; do not put server secrets in a `VITE_` variable.

### Data and privacy

Property and follow-up records are shared through the authenticated API and Neon database. Sign-in uses an HTTP-only session cookie; OAuth tokens and session credentials are not stored in browser local storage. Edits remain in memory until the server confirms them; the status bar reports saving, saved, and failed states. Failed saves can be retried. Revision conflicts preserve the open changes and offer a JSON download before loading the latest records. Loading latest records replaces unsaved changes only after confirmation. Refresh records to see other leaders' updates; this version does not push updates live.

The Google session is checked before the workspace opens. Failed connection or save states block editing. The app warns before leaving with unsaved edits; use the download option to retain a copy before closing a failed or conflicted session. Only the single configured Google email has access. Additional leader accounts, organization permissions, and auditing remain future work.

---

## Key Workflows & Features

1. **Map-First Residential Atlas**:
   - Interactive GIS vector map showing Lakeridge Ward boundary, streets, cul-de-sacs, parks, parcel lots, and Lakeridge Lake.
   - Smooth pan, zoom, reset view, and toggleable parcel boundaries.
   - Markers color-coded by urgency (Overdue, Due This Week, Scheduled, Completed, In Good Standing).

2. **Address Search & Multi-Criteria Filtering**:
   - Filter by follow-up status, assigned organization/role (Bishopric, Relief Society, Elders Quorum, etc.), or ward zone (North Ridge, Lakeside East, Timberline, Meadowview).

3. **Property Details & Coordination**:
   - Desktop split view beside the map; mobile slide-up bottom sheet with touch-friendly hit areas ($\ge 44\text{px}$).
   - Current household summary, access notes (gate codes, dogs, steep driveways), and care notes.
   - Interactive follow-up checklist with completion toggles.
   - Chronological visit and contact history.

4. **Follow-Up Management**:
   - Create new follow-up tasks with responsible role, assignee name, due date picker, and priority.
   - Centralized Follow-Up List view tab with quick "View on Map" jump links.

5. **Google Account**:
   - The header shows the signed-in Google identity. Sign-out clears the session and workspace. Organization filters remain available.

6. **Data Persistence & Reset**:
   - Shared database persistence with visible save status, retries, and revision conflict protection.
   - Includes clear/load-sample actions, JSON export backup, and JSON import. These actions affect the shared atlas.

## Validation

- `npm run lint` — TypeScript checks.
- `npm run build` — production build.
- `TZ=America/Denver node --import tsx --test tests/*.test.ts` — Google authorization, session security, callback protection, save queue, retry, conflict recovery, and local date regression tests.

Deployment smoke check: sign in with the authorized Google account, add a fictional address and wait for “Saved,” then refresh in a second browser. Edit from both browsers without refreshing; the stale browser should offer conflict recovery. Sign out and confirm the records API returns 401. A different Google account must be denied. Remove test records afterward.

## Google sign-in setup

1. Use a dedicated **Lakeridge Ward Atlas** Google Cloud project and OAuth client, separate from Bullock OS. Configure Google Auth Platform branding and audience for the app. If the app is in Testing, add the authorized email as a test user.
2. Create an OAuth client with application type **Web application**. Add this exact authorized redirect URI:
   `https://lakeridge-ward-atlas-bullock-os.vercel.app/api/auth/callback`
3. Set these **server-side** environment variables in Vercel Production:
   - `GOOGLE_CLIENT_ID`: the web client's ID.
   - `GOOGLE_CLIENT_SECRET`: the web client's secret.
   - `AUTH_SECRET`: a random session-signing value at least 32 characters long. Generate locally with `openssl rand -hex 32` and enter it privately.
   - `ATLAS_ALLOWED_EMAIL`: exactly one Google email address. Comparison is case-insensitive; aliases and other emails are not implicitly authorized.
   - `ATLAS_APP_URL`: `https://lakeridge-ward-atlas-bullock-os.vercel.app`.
   - Keep the existing `DATABASE_URL` and optional map key.
4. Deploy after configuring these values. Missing settings fail closed. No database migration is needed for this authentication change. The old `ATLAS_ACCESS_TOKEN` is unused and can be removed from Vercel.

For local full-stack development, use separate Development values in `.env.local`, set `ATLAS_APP_URL=http://localhost:3001`, and add `http://localhost:3001/api/auth/callback` to the Google client's authorized redirect URIs. Run `npm run dev`; Vite-only mode cannot serve authentication endpoints. Never use `VITE_` for server secrets.

The server uses Google's authorization-code flow with PKCE, a signed 10-minute browser-bound state/nonce cookie, and server-side ID-token verification. Only `openid`, `email`, and `profile` scopes are requested; no Google data API access or refresh token is retained. Sessions expire after eight hours. Session cookies use HttpOnly and SameSite=Lax, plus Secure and the `__Host-` prefix on HTTPS. Writes and logout require the configured origin. Changing the allowed email revokes the old email's access on the next request; rotating `AUTH_SECRET` invalidates all sessions.

Vercel deployment protection is separate from app sign-in. Keep it configured as intended; Google login does not change that setting. If the public domain changes, update both `ATLAS_APP_URL` and the Google redirect URI before redeploying.

## Shared monthly Google Maps allowance

Atlas reserves each Google map opening in Neon before loading the Maps SDK or constructing a map. `atlas_map_usage` stores a shared monthly count with a fixed limit of **9,500**, checked atomically across all users and browser tabs. Apply `npm run db:migrate` before deploying this change; it adds the usage table without changing property records. No Maps key or no signed-in session means no map is requested. The Maps key remains `VITE_GOOGLE_MAPS_API_KEY` in Vercel Production and needs a new build after changes.

The 9,500th reservation is allowed; subsequent openings receive HTTP 429 and show a paused-map notice. Addresses, follow-ups, notes, and the sketch map remain usable. A new allowance starts at the beginning of each calendar month in **America/Los_Angeles**. No reset button or client-provided count/period can bypass the limit. Each remount (refresh, returning to the map tab, or switching back from the sketch) reserves another opening. Usage is not refunded on errors or abandoned requests, so the count can conservatively exceed actual map loads. If the counter is unavailable or its response cannot be verified, the Google map stays paused.

This is an **app-level allowance, not Google's billing counter or a guarantee of zero charges**. A browser Maps key cannot be hidden or made unconditionally dependent on our endpoint. Restrict it to Atlas's website origins and enabled APIs, and configure Google Cloud quotas and budget alerts as a second safeguard. Other apps on the billing account can consume the same SKU's free allowance. Existing maps can remain usable after the allowance is exhausted; pan/zoom does not need another reservation. Embedded Street View controls and Google POI cards are disabled to avoid opening separately billed panoramas through the app. Future geocoding/Places features need their own limits.
