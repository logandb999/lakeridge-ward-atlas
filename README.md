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

To hide Google's business labels and icons, create a cloud map style in the Lakeridge Ward Atlas project's **Google Maps Platform → Map Styles**. Choose **Create style → JSON**, paste `config/google-map-style.json` (Google converts this legacy style to its cloud format), then customize/save/publish it as **Ward map — no business labels**. In **Map Management**, create a **JavaScript** Map ID and associate the published style with it. Set `VITE_GOOGLE_MAPS_MAP_ID` to that ID in Vercel Production and local env files, then rebuild/redeploy. This is a public configuration value, separate from the API key. Until configured, the existing demo map remains usable with Google's default labels. Cloud style updates may take a few hours to propagate. Household markers are app overlays and are not removed by this style.

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
   `https://lakeridge-ward-atlas.vercel.app/api/auth/callback`
3. Set these **server-side** environment variables in Vercel Production:
   - `GOOGLE_CLIENT_ID`: the web client's ID.
   - `GOOGLE_CLIENT_SECRET`: the web client's secret.
   - `AUTH_SECRET`: a random session-signing value at least 32 characters long. Generate locally with `openssl rand -hex 32` and enter it privately.
   - `ATLAS_ALLOWED_EMAIL`: exactly one Google email address. Comparison is case-insensitive; aliases and other emails are not implicitly authorized.
   - `ATLAS_APP_URL`: `https://lakeridge-ward-atlas.vercel.app`.
   - Keep the existing `DATABASE_URL` and optional map key.
4. Deploy after configuring these values. Missing settings fail closed. No database migration is needed for this authentication change. The old `ATLAS_ACCESS_TOKEN` is unused and can be removed from Vercel.

For local full-stack development, use separate Development values in `.env.local`, set `ATLAS_APP_URL=http://localhost:3001`, and add `http://localhost:3001/api/auth/callback` to the Google client's authorized redirect URIs. Run `npm run dev`; Vite-only mode cannot serve authentication endpoints. Never use `VITE_` for server secrets.

The server uses Google's authorization-code flow with PKCE, a signed 10-minute browser-bound state/nonce cookie, and server-side ID-token verification. Only `openid`, `email`, and `profile` scopes are requested; no Google data API access or refresh token is retained. Sessions expire after eight hours. Session cookies use HttpOnly and SameSite=Lax, plus Secure and the `__Host-` prefix on HTTPS. Writes and logout require the configured origin. Changing the allowed email revokes the old email's access on the next request; rotating `AUTH_SECRET` invalidates all sessions.

Vercel deployment protection is separate from app sign-in. Keep it configured as intended; Google login does not change that setting. If the public domain changes, update both `ATLAS_APP_URL` and the Google redirect URI before redeploying.

## Household flags and safe imports

Household details support editable residency, apartment, address, shared-occupancy, reported-move, and **Do not contact** flags. The directory can filter these flags and “Member of another ward.” Ward affiliation is explicit user-entered information, with an optional ward name; do not infer it from a household's language or name. Existing records default to unverified affiliation. New addresses can use the **Unassigned** zone until real ward zones are defined.

Use **Addresses → Import households** (also available in Data & Setup). Select a JSON array of complete atlas `Property` records with finite map coordinates. The private LCR review JSON is an intermediate artifact and cannot be imported directly. Every imported record needs a persistent ID; repeated sources should also preserve `importIdentity: { source, recordId }` across exports. Keep separate household identities at shared addresses. Import identity is never inferred from address alone.

The preview lists additions, existing records, and conflicts. Imports append new records only. Re-imported records are skipped; changed household identities or additional flags on existing records require manual review. Existing notes, contact restrictions, visits, follow-ups, and ward affiliation are never overwritten by an import. The server repeats validation and comparison against the loaded revision, so a stale preview cannot overwrite another save. The legacy replace-all import has been removed.

**Before deploying this feature**, apply `npm run db:migrate` against the production database to create `atlas_import_backups`. Each import that adds households writes a database snapshot and updates the atlas in one SQL statement. A backup failure prevents the import; an import containing only existing records does not write or increment the revision. Backups contain the prior atlas JSON and revision for deliberate administrator recovery, with no public backup endpoint. Existing export-to-JSON backups remain available. Production migrations and a live import have not been run as part of local implementation.

Source household lists and review decisions live under `.private/`, excluded by both `.gitignore` and `.vercelignore`. Never put real source lists into `src/`, `public/`, tests, or documentation. This feature does not geocode addresses or consume additional Maps requests.

### Preparing household map locations

`npm run locations:prepare` creates a private address-only lookup queue and location review from the reviewed import preview. It includes explicitly approved households and unflagged households, excludes held records, and refuses undecided flagged records. Use `-- --folder=/absolute/private/review/folder` to select another review batch.

`npm run locations:prepare -- --fetch` downloads matching public [Utah County address points](https://maps.utahcounty.gov/arcgis/rest/services/Reference/Reference_QueryTask/MapServer/0). Queries contain city names and street numbers only; no household names, contact details, membership information, or Google keys are transmitted. Results are cached in the private review folder. No Google geocoding calls are made.

Matching requires exact normalized street and city, valid coordinates, and an unambiguous address/unit point. A requested unit that resolves only to a building is labeled `building_only`; ambiguous or absent matches remain `needs_review`. This checks source address locations, not residency or ward-boundary membership. Network failures leave the queue and review intact, exit unsuccessfully, and never generate estimated coordinates. The location review is not itself an importable atlas file.

### Google Geocoding batch from Terminal

After a successful single-address test, run `npm run geocode:households -- --dry-run` to check the batch size without API requests. Run `npm run geocode:households` to geocode the prepared building list. It reads only `GOOGLE_MAPS_GEOCODING_API_KEY` from `.env.local`; this server key must be restricted to Geocoding API and the Terminal caller's public IP. `--limit=5` limits a trial run to five new requests; the default hard ceiling is 120 requests per invocation. No names, membership details, or unit numbers are sent to Google.

The script saves `.private/ward-import-2026-11-08/google-geocoding-results.json` after every response and generates `google-location-review.md` with source household IDs, addresses, match statuses, and review reasons. Rerunning resumes using unexpired results. There are no automatic retries; access, quota, and connection failures stop the batch. Results with changed streets/cities, partial matches, multiple matches, or approximate locations remain flagged. Exact rooftop matches identify a building, not an apartment or the occupants.

Use `npm run geocode:households -- --recheck-review` to recheck previously flagged records against the current assessment version. It leaves unexpired accepted matches alone and checkpoints each recheck, including records that still need review, so interrupted runs resume without repeating completed checks. `--dry-run` reports the number of required requests without calls. `--report-only` regenerates the review without lookups. Review reports include returned street names and precision when available. The only automatically recognized omitted-direction labels are Orem's E 1000 S / 1000 S and S 50 E / 50 E variants, with identical house numbers, matching city/state/country, a single non-partial rooftop result, and coordinates within narrow expected corridors. These corridors are not ward boundaries. Other direction changes and road-type differences remain flagged.

The cache retains input addresses, place IDs, assessed match statuses, and coordinates with 29-day expiration timestamps. It does not save full Google responses or API keys. Running it removes expired coordinates before fetching replacements. This command does not install a local scheduled cleanup job: the local cache must be refreshed or deleted within Google's standard 30-day caching period. The production private-review queue has separate scheduled cleanup and displays only on Google Maps; household imports now retain expiry metadata, hide expired pins, and strip cached coordinates from database backups and JSON exports. The daily cleanup also removes expired household coordinates. Household data remains available in the directory after pins expire. The scheduled refresh normally runs ahead of expiry. Pending changed locations still require reviewer approval. Do not assume the per-user permanent-storage exception applies across ward leaders. See [Google's Geocoding terms](https://cloud.google.com/maps-platform/terms/maps-service-terms#6.-geocoding-api) and [Geocoding policies](https://developers.google.com/maps/documentation/geocoding/policies). The batch does not write to the shared database or deploy the app.

## Private location review

Only the verified Google session for `loganb999@gmail.com` can use **Review approximate locations (private)**. This is enforced independently in `GET`, `POST`, and `PATCH /api/location-review`; changing the general atlas allowlist later does not grant location-review access. Review payloads and source household lists are never bundled into browser assets. Both API reads and writes use no-store responses, and writes require the app's configured origin.

Run `npm run locations:review-queue` locally to prepare `.private/ward-import-2026-11-08/location-review-upload.json`. The manifest contains still-valid interpolated results that match a reviewed address, including explicit user corrections to the exact returned street/city. Superseded addresses no longer used by any household are excluded. After deployment, sign in as the reviewer and open the private review map. **Load prepared review queue** also accepts this JSON if it was not staged during production setup. Uploads add new review records without replacing previous confirmations. The queue is separate from `atlas_state` and does not import household records.

Select a record in **Approximate — needs review**, inspect satellite imagery, drag the selected marker or click the map to adjust it, and click **Confirm this building location** to save the position and optional note. **Confirmed** shows completed reviews. Saves compare the loaded row revision, and the server records the authenticated reviewer and time. Expired coordinates cannot be confirmed; API reads remove expired coordinate fields from review records and the map excludes them. Confirmation does not extend the original coordinate-cache deadline. A daily Vercel cron calls `/api/location-review?cleanup=1` at `0 8 * * *` with `CRON_SECRET`; requests without the matching secret are denied. The 29-day cache limit leaves a day for the daily cleanup before the standard 30-day deadline. Monitor cron failures; cleanup does not fetch replacements.

### Production release preparation

The private review filter also includes **Address & household verification**. Selecting **Flag address and household for verification** saves `needs_contact`, with separate address-verification and linked-household-verification flags, without marking coordinates confirmed or changing the stored pin. Flagging is permitted even when cached coordinates have expired. A later location confirmation clears those two flags and still requires unexpired coordinates. This does not send a message or create a contact attempt.

For a prepared private manifest of specific unresolved household links, `npm run locations:flag-followups` applies only those review updates from `.private/ward-import-2026-11-08/address-followups.json`. It verifies all links first, preserves other review records and existing notes, and checks revisions while saving. Household source names remain in the private manifest and database, never application source files.

Before pushing a release that includes the review tools, run `npm run production:prepare` from a network-capable Terminal. It loads `.env.production.local`, checks the canonical production URL and reviewer, creates a local random `CRON_SECRET` if needed, and saves it to Vercel Production as a sensitive variable. It then runs the additive database migration and stages the prepared review queue without changing `atlas_state`. Existing review confirmations are preserved. Credentials and household records are not printed. Check for `productionSetupComplete: true` before pushing `main`; the subsequent Vercel build picks up the new secret and cron configuration.

## Shared monthly Google Maps allowance

Atlas reserves each Google map opening in Neon before loading the Maps SDK or constructing a map. `atlas_map_usage` stores a shared monthly count with a fixed limit of **9,500**, checked atomically across all users and browser tabs. Apply `npm run db:migrate` before deploying this change; it adds the usage table without changing property records. No Maps key or no signed-in session means no map is requested. The Maps key remains `VITE_GOOGLE_MAPS_API_KEY` in Vercel Production and needs a new build after changes.

The 9,500th reservation is allowed; subsequent openings receive HTTP 429 and show a paused-map notice. Addresses, follow-ups, notes, and the sketch map remain usable. A new allowance starts at the beginning of each calendar month in **America/Los_Angeles**. No reset button or client-provided count/period can bypass the limit. Each remount (refresh, returning to the map tab, or switching back from the sketch) reserves another opening. Usage is not refunded on errors or abandoned requests, so the count can conservatively exceed actual map loads. If the counter is unavailable or its response cannot be verified, the Google map stays paused.

This is an **app-level allowance, not Google's billing counter or a guarantee of zero charges**. A browser Maps key cannot be hidden or made unconditionally dependent on our endpoint. Restrict it to Atlas's website origins and enabled APIs, and configure Google Cloud quotas and budget alerts as a second safeguard. Other apps on the billing account can consume the same SKU's free allowance. Existing maps can remain usable after the allowance is exhausted; pan/zoom does not need another reservation. Embedded Street View controls and Google POI cards are disabled to avoid opening separately billed panoramas through the app. Future geocoding/Places features need their own limits.

## Prepared ward household import

`npm run households:prepare-import` validates the private reviewed batch and writes `.private/ward-import-2026-11-08/households-ready-to-import.json`. It preserves stable source identities, apartment numbers, contact restrictions, residency/shared-address flags, and held-out decisions. It makes no API calls or database writes. Upload this file in **Addresses → Import households**. On import the server resolves linked private reviews using their latest saved coordinates and notes, checks that each household belongs to that review, and refuses pending/expired review links. The two unresolved addresses can be imported with address-verification flags and approximate pins. Existing households are preserved; the import creates a database backup atomically with the append.

Google coordinates only appear on Google Maps, with a 29-day expiry; they are excluded from the schematic GIS map. Expired pins are hidden, and their coordinates are removed by the daily authenticated cleanup and when records are loaded. Backups and JSON exports retain household information and place IDs but omit cached Google coordinates. Re-saving expired browser data cannot restore expired pins. A daily authenticated Vercel job checks for a monthly refresh on the 25th and for coordinates expiring within four days. It requires the server-only GOOGLE_MAPS_GEOCODING_API_KEY in Production. Matching fresh results renew coordinates, while shifted reviewed pins enter the private review queue. Failed lookups retry on a later daily run.


## Scheduled household pin refresh

The daily cron at 07:00 UTC calls /api/geocoding-refresh with CRON_SECRET. It refreshes on the 25th when a building has not already refreshed that calendar month, or sooner whenever cached coordinates expire within four days. One database lease allows a maximum of 120 lookup requests per UTC day and prevents overlapping runs. The job creates its small coordination table additively when first needed.

Set GOOGLE_MAPS_GEOCODING_API_KEY as a server-only Vercel Production secret and redeploy. Use a dedicated key restricted to the Geocoding API. A home-IP-restricted key cannot serve Vercel's changing outbound IPs. The browser Maps key stays separate.

Address matches are assessed with the existing rooftop/street checks. Fresh lookups must agree with previously reviewed pins before automatic replacement. Shifted, approximate, or changed-address results enter the private review queue. Existing coordinates retain their original expiry while awaiting review. Confirming a linked review atomically updates its imported household pins. Notes, household identities, and contact restrictions are preserved. This refresh cannot guarantee uninterrupted pins when an API failure persists through expiry or a changed location awaits review.

The owner can open /api/geocoding-refresh?dryRun=1 while signed in to verify the due-building count and key configuration with no lookup requests or data changes. Cron summaries contain counts and sanitized API status codes, with no household data or credentials.


### User access

The **Admin** button opens user management for administrators. Add the exact email
used with Google sign-in, choosing **Regular user** (default) or **Admin**.
Adding access does not send email; share the app URL with the person separately.
Regular users can view and edit household records, notes, visits and follow-ups.
Admins can also manage users and open Data & Setup, including household imports.
The original `ATLAS_ALLOWED_EMAIL` account remains a protected owner/admin so access
cannot be accidentally locked out. Other admins cannot change their own access.
The existing private location-review workflow remains restricted to its designated owner.

Access lives in `atlas_users`; `atlas_user_audit` records who changed access and when.
These additive tables initialize on first use and are also included in `npm run db:migrate`.
No additional environment variables are required. Each server request checks the current
access list and role. Removal invalidates existing sessions; re-adding the same email
requires a fresh sign-in. A role change takes effect server-side on the next request;
refresh the app to update its navigation. Data already viewed cannot be recalled from a
person's browser, so only authorize people who should see the full household dataset.
