# Smarty IPTV

A local-first, responsive IPTV web application. The development branch consolidates the features from the original `index.html` and `v1.html` while retaining `v1.html` as a compatibility/reference page.

## Current capabilities

- Browse IPTV-org countries and load country M3U playlists.
- Import an M3U file or an HTTP(S) playlist URL (remote URL imports depend on the source's CORS policy).
- Parse channel names, logos and group metadata with basic URL validation.
- Search the active playlist and search the IPTV-org channel catalogue globally.
- Stream HLS with HLS.js where supported, or native HLS where available.
- Open the current stream in VLC on devices where the VLC protocol handler is installed.
- Save favorites, recent channels and theme preference locally using IndexedDB with a localStorage fallback.
- Responsive RTL interface for mobile and desktop, with keyboard-accessible controls.

## Development notes

The app is static and can be hosted on GitHub Pages. Open `index.html` through a local static HTTP server for reliable ES module loading; opening it as a `file://` URL may be blocked by browser module security.

The app does not require an account or cloud service. A cloud storage adapter interface is present in `assets/js/storage.js`, but no provider is configured in this repository. Cloud sync remains disabled until a provider, authentication flow, user-consent UX, and server-side authorization rules are implemented. Do not put service-role keys or private API secrets in client-side files.

## Known limitations

- Stream availability, codecs, geographic restrictions, HTTPS mixed-content rules and provider CORS settings are outside the application's control.
- A browser cannot guarantee that every IPTV URL can be played. VLC handoff requires VLC and an operating-system protocol handler.
- The global catalogue search downloads IPTV-org JSON datasets on first use and caches the processed result in memory for the current session.
- Remote M3U imports can fail when the playlist host does not allow cross-origin browser requests.
- No server-side proxy is included; arbitrary playlist URLs are fetched directly by the user's browser.

## Security and privacy

Untrusted channel names are rendered as text nodes, not HTML. Stream and logo URLs are restricted to HTTP(S). The app stores playlist data, favorites, history and theme locally on the user's device. No data is sent to a cloud provider by default.

## Compatibility

The original `v1.html` remains in the repository during migration. Do not remove it until feature parity and real-device playback tests have been completed.
