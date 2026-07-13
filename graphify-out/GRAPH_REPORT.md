# Graph Report - .  (2026-07-13)

## Corpus Check
- Corpus is ~587 words - fits in a single context window. You may not need a graph.

## Summary
- 36 nodes · 31 edges · 9 communities (5 shown, 4 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.9)
- Token cost: 1,238 input · 777 output

## Community Hubs (Navigation)
- Renderer UI
- Package Config
- Electron Main
- NPM Scripts
- NPM Dependencies
- NPM DevDependencies
- Audio UI
- Video UI

## God Nodes (most connected - your core abstractions)
1. `scripts` - 3 edges
2. `{ app, BrowserWindow, ipcMain, dialog }` - 1 edges
3. `path` - 1 edges
4. `youtubedl` - 1 edges
5. `main` - 1 edges
6. `test` - 1 edges
7. `keywords` - 1 edges
8. `author` - 1 edges
9. `license` - 1 edges
10. `electron` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Download Interface Components** — index_url_input, index_format_video, index_format_audio, index_download_btn [EXTRACTED 1.00]

## Communities (9 total, 4 thin omitted)

### Community 0 - "Renderer UI"
Cohesion: 0.18
Nodes (10): Download Button, Status Container, URL Input Field, downloadBtn, formatVideo, { ipcRenderer }, progressBar, statusContainer (+2 more)

### Community 1 - "Package Config"
Cohesion: 0.25
Nodes (7): author, description, keywords, license, main, name, version

### Community 2 - "Electron Main"
Cohesion: 0.33
Nodes (4): { app, BrowserWindow, ipcMain, dialog }, os, path, youtubedl

### Community 3 - "NPM Scripts"
Cohesion: 0.67
Nodes (3): scripts, start, test

## Knowledge Gaps
- **27 isolated node(s):** `{ app, BrowserWindow, ipcMain, dialog }`, `path`, `os`, `youtubedl`, `name` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `NPM Scripts` to `Package Config`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `NPM DevDependencies` to `Package Config`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `dependencies` connect `NPM Dependencies` to `Package Config`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `{ app, BrowserWindow, ipcMain, dialog }`, `path`, `os` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._