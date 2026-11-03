# Smarty V2 — Legacy Audit and Feature Inventory

Audit baseline: `main` at commit `d0d0586fe6b8e34b8be83258c2e1af26032d4688` (checked 2026-11-03).

This document records the current implementation before the full rebuild. It is a requirements baseline, not a claim that every feature has passed browser testing.

## 1. Current repository reality

At the audit baseline, `index.html` was a standalone IPTV/VLC page with inline implementation and Bootstrap dependencies. The V2 implementation now uses `index.html` as its canonical application shell and loads the modular services from `assets/js/app.js` and `assets/css/app.css`.

The V2 shell is wired to the existing application controller's DOM contract. The earlier standalone markup has been replaced by the Smarty Vision interface; the IPTV feature inventory below describes the existing modular services that the V2 shell preserves.

## 2. Existing feature inventory

### Catalogue and channel discovery
- Fetches country metadata from the IPTV-org API.
- Loads country-specific M3U playlists from IPTV-org.
- Provides global channel search by combining IPTV-org channel and stream datasets.
- Caches the global search catalogue in memory for the current page session.
- Filters the currently loaded channel list by name and group.
- Renders channels in batches of 48.

### Playlist management
- Imports local M3U/M3U8 files through the file input.
- Imports remote HTTP(S) M3U URLs through browser fetch; success depends on CORS.
- Parses channel name, tvg-id, tvg-logo, group-title and tvg-country metadata.
- Stores up to 10 saved playlists locally.
- Opens and deletes saved playlists.
- Rejects non-HTTP(S) stream and logo URLs.

### Playback
- Plays HLS using HLS.js where supported.
- Falls back to native HLS support where available.
- Exposes VLC protocol handoff using `vlc://`.
- Provides stop and playback status controls.
- Uses Plyr controls when its global library is available.
- Playback depends on source availability, codecs, browser policy, HTTPS/mixed-content rules and embedding/device support.

### Personal library
- Favorites can be added and removed.
- Watch history records the last 30 distinct streams.
- Theme preference is stored locally.
- Saved playlists are persisted locally.
- Mobile navigation exposes channel, favorites, history and import shortcuts.

### Accounts and cloud sync
- Supabase email/password sign-up, sign-in and sign-out.
- Restores the persisted Supabase session.
- Stores one JSON snapshot per authenticated user in `public.user_sync_state`.
- Uses IndexedDB with a localStorage fallback.
- First sync attempts to merge legacy local favorites, history and playlists.
- Subsequent sync uses snapshot-level last-write-wins timestamps.
- Cloud sync is optional; the app is intended to remain usable without an account.

## 3. Current files and responsibilities

| Current path | Current responsibility | V2 disposition |
|---|---|---|
| `index.html` | Canonical Smarty V2 application shell | Active entry point; connected to the modular application controller |
| `v1.html` | Modular application HTML shell | Replace only after V2 shell reaches parity; retain rollback route |
| `assets/css/app.css` | Current modular UI styling | Rebuild into organized CSS layers |
| `assets/js/app.js` | App orchestration, DOM rendering, catalogue, favorites, history, auth and sync logic | Split into application/core/modules/ui |
| `assets/js/m3u.js` | M3U parsing and URL validation | Retain behavior; expand parser tests |
| `assets/js/player.js` | HLS/native playback and VLC handoff | Rebuild as isolated player service |
| `assets/js/storage.js` | IndexedDB/localStorage and generic cloud adapter | Rebuild storage adapters and sync engine separately |
| `assets/js/supabase.js` | Supabase client, auth and sync-state persistence | Retain project configuration and compatible API initially |
| `supabase/migrations` | Existing database migrations (not visible in current repository tree) | Preserve database; add versioned migrations only when required |
| `tests/m3u.test.js` | Parser unit tests | Expand |
| `tests/storage.test.js` | Storage adapter tests | Expand and isolate test state |
| `.github/workflows/validate.yml` | Syntax checks and Node tests | Extend with integration/browser checks |

## 4. Risks and gaps found during static inspection

These are code-review observations; they require tests before being treated as reproduced runtime defects.

1. **Entry-point mismatch:** the previous README and standalone page did not point to the modular application. This was resolved by making `index.html` the canonical V2 entry point.
2. **Monolithic controller:** `app.js` owns DOM access, API calls, feature logic, storage coordination, authentication and synchronization. This is the primary extraction target.
3. **Cloud adapter merge semantics:** `storage.js` performs pull → merge → push, while `app.js` implements the merge. This is a useful seam, but the sync lifecycle and error recovery are not yet covered by integration tests.
4. **Snapshot-level conflict resolution:** last-write-wins can lose independent changes made on two devices between syncs. V2 should use per-entity change metadata or a deterministic operation/change-set strategy, with explicit deletion tombstones if needed.
5. **Timestamp dependence:** local device clocks determine conflict winners and can be skewed. Cloud server timestamps and version/revision checks should be considered.
6. **Playlist sync/privacy boundary:** saved playlists include channel URLs. Current README says saved playlists are synced, while it also says imported playlist URLs are not uploaded as a separate catalogue. V2 must clearly define what playlist data is cloud-synced and obtain user consent for private playlist content.
7. **Remote URL import:** direct browser fetch is CORS-limited. V2 should communicate this limitation rather than imply every URL can be imported.
8. **Player error handling:** HLS fatal errors are surfaced, but browser playback is inherently source-dependent. V2 needs timeout, retry policy, source diagnostics and clear VLC fallback states.
9. **Global search payload:** catalogue datasets are downloaded and processed in the browser. V2 should measure payload and latency, then consider caching/pagination without introducing a backend dependency unnecessarily.
10. **Test coverage:** existing tests cover basic M3U parsing and generic storage adapter behavior. They do not cover DOM flows, player lifecycle, auth session transitions, sync conflict cases, migration or browser playback.
11. **CDN dependencies:** HLS.js/Plyr and Supabase JS are loaded from external CDNs. Pin versions, define failure behavior and review CSP/dependency integrity as part of release hardening.
12. **Rendering safety:** V2 channel rendering continues to use DOM text nodes for untrusted channel names and validates media URLs before use.

## 5. V2 parity acceptance checklist

- [ ] Country list loads and can be filtered.
- [ ] Country playlist can be loaded.
- [ ] Local M3U/M3U8 file import works.
- [ ] Remote HTTP(S) playlist import reports CORS/network failures clearly.
- [ ] Parser preserves supported metadata and rejects unsafe schemes.
- [ ] Global channel search works with loading, empty and error states.
- [ ] Local channel filtering works.
- [ ] Batch rendering works without duplicate or missing channels.
- [ ] HLS.js playback works on supported browsers.
- [ ] Native HLS fallback works where supported.
- [ ] VLC handoff works where protocol handler is installed.
- [ ] Stop/restart and fatal player errors are handled.
- [ ] Favorites persist across reloads.
- [ ] History persists and is capped according to product rules.
- [ ] Saved playlists can be created, opened, renamed/deleted according to V2 requirements.
- [ ] Theme preference persists.
- [ ] App works without signing in and without network after local data has been saved (within browser/source limitations).
- [ ] Sign-up, sign-in, sign-out and session restore work.
- [ ] Sync between two browsers/devices is tested.
- [ ] Simultaneous edits and deletions do not silently resurrect or overwrite data.
- [ ] Existing local data has a tested migration/import path.
- [ ] The V2 entry point remains reversible through the feature branch and pull request until release approval.

## 6. Explicit non-goals for the first V2 milestone

- No IPTV stream proxy/server is introduced.
- No arbitrary server-side fetching of user playlist URLs.
- No forced account requirement.
- No destructive database schema replacement.
- No destructive replacement of existing user data or database structures.
