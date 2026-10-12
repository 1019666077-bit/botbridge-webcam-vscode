"""Bot Bridge Webcam - local stdio bootstrap for the webcam MCP server.

This file ships with the Bot Bridge Webcam VS Code extension. It is launched by
VS Code through:

    uv run --no-project --with <packageSpec> python <extension>/scripts/webcam_stdio.py

`uv` creates an ephemeral environment containing the webcam MCP server (by
default https://github.com/1019666077-bit/webcam_mcp pinned at tag v0.2.0),
then runs this script inside it. All pixel work - opening the camera, encoding
one JPEG, releasing the device - happens in that process. The extension itself
never touches the camera and never uploads anything.

Camera settings are passed in via environment variables set by the extension:

    BB_WEBCAM_CAMERA_INDEX   camera device index (default 0)
    BB_WEBCAM_PHOTO_WIDTH    photo width in pixels (default 1920)
    BB_WEBCAM_PHOTO_HEIGHT   photo height in pixels (default 1080)
    BB_WEBCAM_JPEG_QUALITY   JPEG quality 1-100 (default 90)
"""

from __future__ import annotations

import os

from webcam_mcp.config import ServerConfig
from webcam_mcp.server import create_server


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def main() -> None:
    config = ServerConfig(
        camera_index=_env_int("BB_WEBCAM_CAMERA_INDEX", 0),
        photo_width=_env_int("BB_WEBCAM_PHOTO_WIDTH", 1920),
        photo_height=_env_int("BB_WEBCAM_PHOTO_HEIGHT", 1080),
        jpeg_quality=_env_int("BB_WEBCAM_JPEG_QUALITY", 90),
    )
    create_server(config).run(transport="stdio")


if __name__ == "__main__":
    main()
