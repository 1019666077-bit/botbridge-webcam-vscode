# Changelog

All notable changes to **Bot Bridge Webcam** are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-10-12

### Changed

- Marketplace listing metadata: added the **AI** and **Chat** categories,
  expanded the keyword list, and sharpened the display name and description.

## [0.1.0] - 2026-10-12

### Added

- Initial release.
- Registers the local webcam MCP server with VS Code via
  `contributes.mcpServerDefinitionProviders` and
  `vscode.lm.registerMcpServerDefinitionProvider`, launched over stdio with `uv`.
- Commands: **Check Environment**, **Refresh MCP Server**, **Open Homepage**.
- Settings for `uv` path, camera index, photo resolution, JPEG quality, package
  spec, and an enable/disable switch.
- Local-only capture: the extension never opens the camera and never uploads
  images. The `webcam_mcp` process owns all pixel work.

### Security

- `uvPath` and `packageSpec` are `"scope": "machine"` and are read from
  user/machine scope only, so a cloned workspace cannot redirect the executable
  or inject a package this extension would run.
- The webcam MCP package is pinned to an immutable commit SHA (the commit behind
  tag `v0.2.0`) instead of a movable tag.
