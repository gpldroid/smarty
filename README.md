# Smarty IPTV

A local-first, responsive IPTV web application. The development branch consolidates the features from the original `index.html` and `v1.html` while retaining `v1.html` as a compatibility/reference page.

## Current capabilities

- Browse IPTV-org countries and load country M3U playlists.
- Import an M3U file or an HTTP(S) playlist URL (remote URL imports depend on the source's CORS policy).
- Parse channel names, logos and group metadata with basic URL validation.
- Search the active playlist and search the IPTV-org channel catalogue globally.
- Stream HLS with HLS.js where supported, or native HLS where available.
- Open the current stream in VLC on devices where the VLC protocol handler is installed.
- Save favorites, recent channels, playlists and theme preference locally using IndexedDB with a localStorage fallback.
- Optional Supabase email/password accounts and per-user cloud synchronization for favorites, history, playlists and theme.
- Responsive RTL interface for mobile and desktop, with keyboard-accessible controls.

## Development notes

The app is static and can be hosted on GitHub Pages. Open `index.html` through a local static HTTP server for reliable ES module loading; opening it as a `file://` URL may be blocked by browser module security.

The app remains local-first and can be used without an account. Optional cloud sync uses the Supabase project configured in `assets/js/supabase.js` with a public publishable key and the pinned `@supabase/supabase-js` client. Users must create an account or sign in before syncing. The `public.user_sync_state` table stores one JSON snapshot per authenticated user and enforces ownership with RLS. First sync merges legacy local-only data; subsequent conflicts use last-write-wins timestamps to ensure deletions are not resurrected. Local storage remains available if authentication or cloud sync is unavailable. Never put service-role keys or private API secrets in client-side files.

## Known limitations

- Stream availability, codecs, geographic restrictions, HTTPS mixed-content rules and provider CORS settings are outside the application's control.
- A browser cannot guarantee that every IPTV URL can be played. VLC handoff requires VLC and an operating-system protocol handler.
- The global catalogue search downloads IPTV-org JSON datasets on first use and caches the processed result in memory for the current session.
- Remote M3U imports can fail when the playlist host does not allow cross-origin browser requests.
- No server-side proxy is included; arbitrary playlist URLs are fetched directly by the user's browser.

## Security and privacy

Untrusted channel names are rendered as text nodes, not HTML. Stream and logo URLs are restricted to HTTP(S). The app stores playlist data, favorites, history and theme locally on the user's device. Cloud synchronization is optional and only sends the signed-in user's favorites, history, saved playlists and theme to their own RLS-protected row. Imported playlist URLs and channel data are not uploaded as a separate account-wide catalogue.

## Compatibility

The original `v1.html` remains in the repository during migration. Do not remove it until feature parity and real-device playback tests have been completed.
