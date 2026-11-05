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

The API requires `DATABASE_URL` and `ATLAS_ACCESS_TOKEN` in the Vercel project environment. Generate a long random access token, set it as `ATLAS_ACCESS_TOKEN`, and provide it only to intended users. Run `npm run db:migrate` against the Neon database before using the API. For local full-stack development, use `npm run dev` after installing the Vercel CLI dependency; this runs Vercel's local function host.

The shared database stores the atlas records as a JSONB snapshot in `atlas_state`, with a revision number. Saves atomically compare that revision before updating, so a stale browser cannot overwrite newer changes. Run `npm run db:migrate` with `DATABASE_URL` set **before deploying this version**. The migration copies existing `properties` records on first run and is safe to rerun; the legacy table remains untouched. After migration, `atlas_state` is the source of truth. The API requires a shared bearer token; this is a basic private-app gate, not per-user authentication or auditing. Do not use real household information until you have reviewed whether this access model meets your privacy requirements.

### Optional Google Maps key

The app uses the vector map when `VITE_GOOGLE_MAPS_API_KEY` is not set. To enable Google Maps, add `VITE_GOOGLE_MAPS_API_KEY` as an environment variable in Vercel and restrict that browser key to your deployed domain and the Google Maps APIs you enable. Vite embeds `VITE_` variables into browser code, so this key is public; do not put server secrets in a `VITE_` variable.

### Data and privacy

Property and follow-up records are shared through the authenticated API and Neon database. The browser stores the access token locally. Edits remain in memory until the server confirms them; the status bar reports saving, saved, and failed states. Failed saves can be retried. Revision conflicts preserve the open changes and offer a JSON download before loading the latest records. Loading latest records replaces unsaved changes only after confirmation. Refresh records to see other leaders' updates; this version does not push updates live.

The token is checked before the workspace opens. Failed connection or save states block editing. The app warns before leaving with unsaved edits; use the download option to retain a copy before closing a failed or conflicted session. Individual user accounts, permission enforcement, and auditing remain future work.

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

5. **Role Switching**:
   - Switch active mock leader (Bishop, Relief Society President, Elders Quorum President, Ministering Coordinator, etc.) to test organization-specific views.

6. **Data Persistence & Reset**:
   - Shared database persistence with visible save status, retries, and revision conflict protection.
   - Includes clear/load-sample actions, JSON export backup, and JSON import. These actions affect the shared atlas.

## Validation

- `npm run lint` — TypeScript checks.
- `npm run build` — production build.
- `TZ=America/Denver node --import tsx --test tests/storageService.test.ts` — access, save queue, retry, conflict recovery, and local date regression tests.

Deployment smoke check: verify a wrong token keeps the access screen open, sign in with a valid token, add a fictional address and wait for “Saved,” then refresh in a second browser. Edit from both browsers without refreshing; the stale browser should offer conflict recovery. Remove test records afterward.
