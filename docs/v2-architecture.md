# Smarty V2 — Target Architecture

Status: target architecture for a full rebuild, not a description of the current code.

## 1. Product and engineering decisions

- Architecture: modular monolith.
- Runtime: browser-first static web application using native JavaScript ES modules.
- Data strategy: local-first, with optional authenticated cloud synchronization.
- Local persistence: IndexedDB as primary store; localStorage only for small preferences/fallback.
- Cloud: existing Supabase project, Auth and PostgreSQL with RLS.
- Playback: HTML5 video, HLS.js and native HLS fallback; VLC handoff as an optional external action.
- Playlist ingestion: isolated M3U/M3U8 parser and import pipeline.
- Hosting: static hosting; no mandatory application server.
- Compatibility: preserve current data and keep the existing pages available until V2 passes parity tests.

## 2. Dependency direction

```text
UI (views/components)
        |
        v
Application (use-cases/controllers)
        |
        v
Domain (entities, rules, ports)
        ^
        |
Infrastructure (IndexedDB, Supabase, HTTP, HLS)
```

Rules:
- Domain modules must not import DOM, Supabase, IndexedDB or HLS.js.
- UI modules must not call Supabase or IndexedDB directly.
- Application use-cases coordinate domain rules and injected service interfaces.
- Infrastructure implements interfaces defined for application/domain needs.
- Player lifecycle is isolated from channel catalogue and account state.
- External data is validated at boundaries before entering application state.

## 3. Proposed repository structure

```text
smarty/
├── index.html
├── README.md
├── package.json
├── assets/
│   ├── css/
│   │   ├── app.css                 # composition/import entry
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── player.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── app.js                  # composition root only
│   │   ├── core/
│   │   │   ├── config.js
│   │   │   ├── state.js
│   │   │   ├── events.js
│   │   │   └── errors.js
│   │   ├── domain/
│   │   │   ├── channel.js
│   │   │   ├── playlist.js
│   │   │   ├── favorite.js
│   │   │   └── history.js
│   │   ├── modules/
│   │   │   ├── catalogue/
│   │   │   ├── playlists/
│   │   │   ├── favorites/
│   │   │   ├── history/
│   │   │   ├── search/
│   │   │   ├── preferences/
│   │   │   └── account/
│   │   ├── player/
│   │   │   ├── player-controller.js
│   │   │   ├── hls-adapter.js
│   │   │   ├── native-adapter.js
│   │   │   └── vlc-handoff.js
│   │   ├── services/
│   │   │   ├── m3u-parser.js
│   │   │   ├── playlist-importer.js
│   │   │   ├── iptv-org-client.js
│   │   │   └── sync-engine.js
│   │   ├── storage/
│   │   │   ├── indexeddb.js
│   │   │   ├── local-preferences.js
│   │   │   ├── migrations.js
│   │   │   └── repositories/
│   │   ├── cloud/
│   │   │   ├── supabase-client.js
│   │   │   ├── auth-repository.js
│   │   │   └── sync-repository.js
│   │   └── ui/
│   │       ├── components/
│   │       ├── views/
│   │       ├── renderers/
│   │       └── notifications.js
│   └── images/
├── supabase/
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── browser/
└── .github/
    └── workflows/
        └── validate.yml
```

The directory tree is a target. Create modules only when their responsibility is implemented; avoid empty folders and speculative abstractions.

## 4. Core application modules

### Catalogue
Owns country metadata, catalogue loading, channel normalization, local filtering and global search. External IPTV-org APIs are accessed through a client adapter.

### Playlist domain
Owns playlist identity, metadata, validation, import lifecycle and saved playlist operations. The parser is pure and independently testable.

### Player
Owns source selection, HLS/native playback, loading/error/timeout states, stop/retry and VLC handoff. It receives a validated stream descriptor and emits playback events; it does not own favorites or account logic.

### Personal library
Favorites, history, playlists and preferences are separate use-cases backed by repositories. UI reads state through application services rather than directly from storage.

### Storage
IndexedDB repositories are the primary persistence mechanism. A versioned migration layer upgrades the current `smarty-iptv` database and imports any compatible localStorage records. Failed upgrades must not clear user data.

### Account and cloud
Supabase Auth manages identity. The cloud repository only reads/writes the authenticated user's records under RLS. The publishable key is public client configuration; service-role credentials must never be shipped to the browser.

### Synchronization
The sync engine is independent of UI and Supabase SDK. It should:
1. Load local changes and remote revision.
2. Compare per-record versions/change metadata.
3. Resolve concurrent edits deterministically.
4. Preserve deletions using tombstones or equivalent versioned deletion records.
5. Push a bounded change set using optimistic concurrency.
6. Mark local changes as synchronized only after server confirmation.
7. Queue retries when offline and expose a recoverable sync status.

Do not use whole-snapshot last-write-wins as the final V2 conflict model. It can discard independent changes across devices. The existing `user_sync_state` table may remain as a compatibility/initial transport while the sync model is validated; schema changes require a separate migration plan.

## 5. Data ownership and privacy

| Data | Local | Cloud default |
|---|---:|---:|
| Country/channel catalogue cache | Yes | No |
| Playback session/current channel | Optional | No |
| Favorites | Yes | Yes, when sync enabled |
| Watch history | Yes | Yes, when sync enabled |
| Theme/preferences | Yes | Yes, when sync enabled |
| Saved playlist names/metadata | Yes | User choice |
| Full playlist contents and stream URLs | Yes | Explicit opt-in only |
| Account session | Supabase-managed | Supabase-managed |

The app must explain what is synced before enabling cloud sync. Never upload imported playlist URLs or stream credentials silently.

## 6. Error and offline model

- Local browsing of already-saved content must not wait for cloud authentication.
- Cloud failure must not block local writes.
- Network calls need bounded timeouts, clear user-facing states and retry policy.
- Remote M3U import must explain CORS restrictions.
- Player errors should distinguish unsupported format, network failure, fatal HLS error and source rejection where possible.
- Empty, loading, offline and error states are first-class UI states.

## 7. Test and release gates

### Unit
Parser edge cases, URL validation, domain rules, reducers/state transitions, merge/conflict resolution and migration transforms.

### Integration
IndexedDB repositories, Supabase repository with authenticated test users, sync retry/conflict/deletion behavior, catalogue client response handling.

### Browser
Import file, saved playlist CRUD, favorites/history persistence, mobile navigation, auth lifecycle, two-device sync, player stop/retry and supported HLS playback.

### Release gate
- All unit and integration tests pass.
- Browser smoke tests pass on desktop and mobile viewport.
- Existing local data migration is verified against representative fixtures.
- Supabase RLS ownership is verified with two separate users.
- No private keys or user stream credentials appear in the bundle/logs.
- V2 cutover is reversible; old page remains available until post-release validation.

## 8. Rebuild sequence

1. Freeze and document current behavior (completed in the legacy audit).
2. Create V2 shell, design tokens and application composition root.
3. Implement domain models and repositories.
4. Implement M3U parser/importer and catalogue adapters.
5. Implement channel browsing, filtering, search and playlist management.
6. Implement player adapters and lifecycle.
7. Implement favorites, history and preferences.
8. Implement account UI and Supabase adapters.
9. Implement versioned sync engine and data migration.
10. Add full automated/browser test coverage.
11. Run parity review, prepare rollback and only then consider the V2 release.

## 9. Implementation status on the V2 branch

Implemented in the current development branch:
- Canonical RTL application shell and Smarty Vision light/dark responsive interface.
- Local-first IndexedDB storage with localStorage compatibility migration.
- Isolated M3U parser, IPTV-org catalogue client, playlist library operations, favorites/history domain logic, stream player, Supabase adapter and cloud snapshot merge module.
- Mobile search/navigation controls and active-view state synchronization.
- Unit tests for M3U parsing, IPTV-org responses, playlist CRUD operations, favorites/history transitions, player lifecycle, snapshot merging, UI contracts and local-storage migration.

Still required before release:
- Complete extraction of the application controller into feature-level use-cases and UI modules.
- Replace whole-snapshot last-write-wins synchronization with per-record revisions, deletion tombstones and optimistic concurrency.
- Browser verification of file/URL imports, player playback on supported devices, sign-in/sign-out, and real two-device sync.
- Verify RLS with separate test accounts and complete migration/recovery tests.

The architecture document remains the target design; the implementation is incremental and must not be considered feature-parity complete until the release gates above pass.

The canonical Smarty V2 application entry point is `index.html`.
