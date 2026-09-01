# PRD: VS File Manager

| | |
|---|---|
| **Product** | VS File Manager (VS Code extension) |
| **Version** | 1.0.0 (draft) |
| **Status** | Draft |
| **Date** | 2026-09-01 |
| **Owner** | Aaron Liu |
| **Repository** | https://github.com/aaronpliu/vsfilemanager |

---

## 1. Overview

VS File Manager is a Visual Studio Code extension that provides an advanced structured file editor for JSON, YAML, XML, and TOML files, plus file synchronization and batch-update capabilities. It targets developers who need to edit complex configuration files quickly, keep same-named config files in sync across a project, and apply shared changes to many files at once.

## 2. Background & Problem Statement

Structured configuration files (JSON, YAML, XML, TOML) are ubiquitous in modern projects, but editing them in a raw text editor is error-prone:

- **Deeply nested structures** (e.g., `config.db.pool.maxConnections`) require careful bracket/indentation handling; a single misplaced comma or indent breaks the file.
- **Same-named config files** (e.g., `config/app.json` in multiple modules or microservices) drift out of sync when a shared value is changed in only one of them.
- **Repeated edits across files** (e.g., changing a database host in 10 files) are tedious and inconsistent when done manually.

Existing solutions (plain text editors, JSON-specific viewers) do not combine hierarchical editing, cross-file synchronization, and batch operations in a single tool.

## 3. Goals

- **G1 — Structured editing:** Let users view and edit structured files as a hierarchy of key-value blocks using dot notation (e.g., `config.db.host`), with in-place value editing that preserves the original type.
- **G2 — File synchronization:** Automatically detect same-named files and propagate block-level changes across them, with user control over which files are updated.
- **G3 — Batch updates:** Allow users to apply the same key-value change to multiple structured files simultaneously.
- **G4 — Multi-format support:** Support JSON, YAML, XML, and TOML with round-trip fidelity (no unintended format or comment loss).
- **G5 — Low friction:** Entry points from the command palette and the editor context menu; minimal setup; clear prompts and notifications.

## 4. Non-Goals

- Not a full replacement for dedicated editors (e.g., JSON schema validation, YAML linting, XML schema-aware editing).
- No remote/cloud storage or collaboration features — all processing is local to the workspace.
- No support for binary formats (e.g., `.msgpack`, `.protobuf`).
- No syntax highlighting or text editing features — the block editor complements, not replaces, the built-in text editor.

## 5. Target Users & Personas

| Persona | Profile | Primary needs |
|---|---|---|
| **Backend/DevOps engineer** | Maintains microservices, each with its own config files | Keep same-named config files in sync; apply shared config changes across services |
| **Full-stack developer** | Works with app configuration (package, build, deploy configs) | Quickly edit nested JSON/YAML without breaking structure |
| **QA / automation engineer** | Manages test fixtures and environment configs | Batch-update test configs; reliably edit complex nested fixtures |

## 6. Use Cases & User Stories

- **US-1** As a developer, I want to edit a deeply nested JSON value by path so I don't have to count braces/indentation.
- **US-2** As a developer, I want to add or delete blocks at any depth so I can restructure my config from a hierarchy view.
- **US-3** As a developer, I want to search for a key in a large config so I can navigate to it quickly.
- **US-4** As a developer, when I save a block-editor change, I want to be prompted to propagate it to other same-named files so my configs don't drift.
- **US-5** As a developer, I want to manually trigger a sync from the current file to selected same-named files.
- **US-6** As a developer, I want to update one key across many files in one step so I don't have to open each file.
- **US-7** As a developer, I want the file format and comments preserved after editing so I don't introduce unrelated diffs.

## 7. Functional Requirements

Priority legend: **P0** = must have (MVP), **P1** = should have, **P2** = nice to have.

### 7.1 Block Editor (FR-1)

| ID | Priority | Requirement |
|---|---|---|
| FR-1.1 | P0 | Provide a command **Edit Structured Blocks** (`vsfilemanager.editStructuredBlocks`) that opens a hierarchical block-editor webview for the active file. |
| FR-1.2 | P0 | The command must be available for `.json`, `.yaml`, `.yml`, `.xml`, `.toml` files only. |
| FR-1.3 | P0 | The webview renders the file as a hierarchy of key-value blocks organized by depth level. |
| FR-1.4 | P0 | Users can edit values in place; the original value type (string, number, boolean, object, array) is preserved. |
| FR-1.5 | P0 | Users can add new blocks at any depth level. |
| FR-1.6 | P0 | Users can delete blocks (including nested objects/arrays) via a trash/delete control. |
| FR-1.7 | P0 | Users can search for keys using a search bar. |
| FR-1.8 | P0 | Users can change the depth level to expand/collapse the hierarchy view. |
| FR-1.9 | P0 | A **Save Changes** action writes modifications back to the file. |
| FR-1.10 | P0 | A **Reload** action discards unsaved changes and re-reads the file. |
| FR-1.11 | P0 | Only one block editor may be open per file; re-invoking the command focuses the existing editor instead of opening a duplicate. |
| FR-1.12 | P1 | When adding a block, users can specify its insertion position: beginning of the level, before a specific existing key, or at the end (added in v1.3.7). |
| FR-1.13 | P1 | The depth selector in the Add Block form stays in sync with the main view's depth selector. |
| FR-1.14 | P1 | Newly added blocks keep their specified position after save (not appended to the end). |
| FR-1.15 | P1 | After saving, a notification with a **Save Changes** action is shown in the bottom-right. |
| FR-1.16 | P1 | Search results support keyboard navigation (arrow keys). |
| FR-1.17 | P1 | The search box is floating and collapsible/expandable. |
| FR-1.18 | P1 | The command is exposed in the editor context menu (right-click) for supported file types. |
| FR-1.19 | P2 | Array elements are handled with clear key labels and editable values. |

### 7.2 File Synchronization (FR-2)

| ID | Priority | Requirement |
|---|---|---|
| FR-2.1 | P0 | After saving changes in the block editor, detect files with the same name in the workspace. |
| FR-2.2 | P0 | If same-named files are found (and auto-sync prompt is enabled), show a prompt asking whether to sync the changes. |
| FR-2.3 | P0 | Users select target files from a multi-select list; only the changed blocks are written to the selected files (block-level sync, not whole-file replacement). |
| FR-2.4 | P0 | Provide a manual command **Sync Structured Files** (`vsfilemanager.syncFiles`) that propagates the active file's block values to selected same-named files. |
| FR-2.5 | P1 | The auto-sync prompt can be disabled via the `vsfilemanager.syncPrompt` setting. |

### 7.3 Batch Updates (FR-3)

| ID | Priority | Requirement |
|---|---|---|
| FR-3.1 | P0 | Provide a command **Batch Update Structured Files** (`vsfilemanager.batchUpdate`). |
| FR-3.2 | P0 | Users select any number of supported structured files in the workspace from a multi-select list. |
| FR-3.3 | P0 | Users enter the target key as a dot-notation path (e.g., `config.db.host`). |
| FR-3.4 | P0 | Users enter the new value; the extension auto-detects the type: number (`5432`), boolean (`true`/`false`), object/array (valid JSON input), otherwise string. |
| FR-3.5 | P0 | The change is applied to all selected files simultaneously. |
| FR-3.6 | P1 | The file picker supports cancel; user gets feedback if the operation is aborted. |

### 7.4 Format Support (FR-4)

| ID | Priority | Requirement |
|---|---|---|
| FR-4.1 | P0 | JSON (`.json`) — full support for nested objects and arrays. |
| FR-4.2 | P0 | YAML (`.yaml`, `.yml`) — preserves comments and structure on round-trip. |
| FR-4.3 | P0 | XML (`.xml`) — round-trip parsing via `fast-xml-parser`. |
| FR-4.4 | P0 | TOML (`.toml`) — supports tables and primitive values. |
| FR-4.5 | P2 | Architecture allows adding more formats (parser interface per format). |

### 7.5 Settings (FR-5)

| ID | Priority | Requirement |
|---|---|---|
| FR-5.1 | P0 | `vsfilemanager.enable` — enable/disable the extension. |
| FR-5.2 | P0 | `vsfilemanager.syncPrompt` — enable/disable the automatic sync prompt after block-editor saves (default enabled). |

### 7.6 Extensibility (FR-6)

| ID | Priority | Requirement |
|---|---|---|
| FR-6.1 | P1 | Extension activates on language activation for `json`, `yaml`, `yml`, `xml`, `toml` files only (lazy activation, no startup cost for other file types). |

## 8. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Compatibility | Runs on VS Code ≥ 1.75.0 (all major platforms: Windows, macOS, Linux). |
| NFR-2 | Performance | Block editor opens and renders files of typical config size (≤ ~1 MB) without perceptible delay; no blocking of the UI thread during parse/save. |
| NFR-3 | Reliability | Round-trip save must not corrupt or silently reformat the file; unsupported structures degrade gracefully with a clear error message. |
| NFR-4 | Safety | Editing/sync/batch operations must never modify files outside the workspace; changes are applied only to explicitly selected files. |
| NFR-5 | Privacy | All processing is local; the extension makes no network calls and collects no telemetry. |
| NFR-6 | Data integrity | Block-editor saves must not lose data when a file changes on disk — document current behavior; if last-write-wins is in place, note it in the UI. |
| NFR-7 | Code quality | Unit tests (Jest) must pass; lint (ESLint) clean; Husky pre-commit hooks enforce lint-staged. |
| NFR-8 | Maintainability | Parser, sync, and batch logic are modular (`src/parser`, `src/handlers`, `src/utils`) and unit-tested. |

## 9. UX Requirements

- **Entry points**: Command palette for all three commands; context menu for **Edit Structured Blocks** on supported files.
- **Onboarding**: No configuration required — the extension works out of the box; settings are optional toggles.
- **Feedback**: Notifications confirm saves and sync/batch results; error messages are actionable (e.g., unsupported file type, invalid path).
- **Consistency**: Depth-level navigation and search behave the same across all supported formats.
- **Discoverability**: The sync prompt after save introduces the sync feature naturally.

## 10. Success Metrics

| Metric | Target (indicative) |
|---|---|
| Marketplace installs | Grow steadily per release |
| Marketplace rating | ≥ 4.5 / 5 |
| Issue closure rate | ≥ 90% of filed bugs resolved within a release cycle |
| Activation rate | High % of installs actually activating on supported files |
| Feature usage | Block editor is the primary feature; sync and batch are secondary |

## 11. Release Plan

Current release: **v1.3.7** (2025-08-25).

| Milestone | Focus |
|---|---|
| v1.3.x (done) | Core editing stability: deletion fixes, array handling, add-block position control, editor management (one editor per file), context-menu command |
| v1.4.x (candidate) | Reliability: document/verify save semantics, file-change detection, error messaging improvements |
| v2.0 (candidate) | Extensibility: pluggable format support, richer array editing UX, user-configurable sync rules |

## 12. Risks & Open Questions

- **Round-trip fidelity**: YAML comment preservation and XML round-tripping are inherently lossy across parsers — validate with real-world files in CI tests.
- **Large files**: Very large structured files (multi-MB) may degrade webview performance — consider pagination or lazy rendering if reported.
- **Concurrent file changes**: Behavior when a file is modified externally while a block editor is open needs a defined policy (detect → prompt to reload vs. overwrite).
- **Multi-root workspaces**: Same-name detection and batch file selection across multiple workspace folders should be verified.
- **Sync scope**: Block-level sync semantics for arrays and renamed keys should be documented to avoid surprising merges.

## 13. Appendix: Current Feature Inventory (v1.3.7)

- Commands: `vsfilemanager.editStructuredBlocks`, `vsfilemanager.syncFiles`, `vsfilemanager.batchUpdate`
- Settings: `vsfilemanager.enable`, `vsfilemanager.syncPrompt`
- Dependencies: `fast-xml-parser`, `js-yaml`, `toml`, `tomlify-j0.4`
- Test stack: Jest (unit), Mocha/`@vscode/test-electron` (integration), ESLint + Husky + lint-staged
