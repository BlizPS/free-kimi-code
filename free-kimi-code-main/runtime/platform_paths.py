"""Canonical LazyDev user paths shared by the native Python CLI and hooks."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Mapping, Callable


def _exists(path: str) -> bool:
    try:
        return Path(path).exists()
    except OSError:
        return False


def is_termux_environment(env: Mapping[str, str] | None = None, exists: Callable[[str], bool] = _exists) -> bool:
    """Detect native Termux and Debian/Ubuntu launched through proot-distro."""
    env = env or os.environ
    marker = bool(
        env.get("TERMUX_VERSION")
        or env.get("TERMUX_APP__VERSION_NAME")
        or env.get("TERMUX_APP__PACKAGE_NAME")
        or "/com.termux/" in str(env.get("PREFIX", ""))
        or "/com.termux/" in str(env.get("TERMUX_PREFIX", ""))
        or "/com.termux/" in str(env.get("TERMUX__PREFIX", ""))
    )
    android = any(exists(item) for item in ("/system", "/data/app", "/apex", "/storage/emulated/0"))
    termux_prefix = any(
        exists(item) for item in (
            str(env.get("TERMUX_PREFIX", "")),
            str(env.get("TERMUX__PREFIX", "")),
            "/data/data/com.termux/files/usr",
        ) if item
    )
    return marker or (android and termux_prefix)


def platform_paths(
    platform_name: str | None = None,
    env: Mapping[str, str] | None = None,
    home: Path | None = None,
    exists: Callable[[str], bool] = _exists,
) -> dict[str, Path | bool]:
    """Return canonical LazyDev config, Kimi, and artifact paths."""
    env = env or os.environ
    platform_name = platform_name or sys.platform
    home = home or Path.home()
    termux = is_termux_environment(env, exists)

    if platform_name.startswith("win"):
        profile = Path(env.get("USERPROFILE") or home)
        config = Path(env.get("APPDATA") or (profile / "AppData" / "Roaming")) / "lazydev"
        artifact = profile / "lazydevfile"
    elif platform_name == "darwin":
        config = Path(env.get("XDG_CONFIG_HOME") or (home / "Library" / "Application Support")) / "lazydev"
        artifact = Path("/storage/emulated/0/lazydevfile") if termux else home / "lazydevfile"
    else:
        config = Path(env.get("XDG_CONFIG_HOME") or (home / ".config")) / "lazydev"
        artifact = Path("/storage/emulated/0/lazydevfile") if termux else home / "lazydevfile"

    return {
        "platform": platform_name,
        "termux": termux,
        "home": home,
        "configDirectory": config,
        "kimiHome": config / "kimi-code",
        "artifactDirectory": artifact,
    }


def ensure_artifact_directory(
    platform_name: str | None = None,
    env: Mapping[str, str] | None = None,
    home: Path | None = None,
) -> Path:
    """Create the canonical artifact directory and a safe Termux home alias when possible."""
    info = platform_paths(platform_name=platform_name, env=env, home=home)
    canonical = Path(info["artifactDirectory"])
    canonical.mkdir(parents=True, exist_ok=True)
    if info.get("termux"):
        alias = Path(info["home"]) / "lazydevfile"
        try:
            if alias != canonical and not alias.exists() and not alias.is_symlink():
                alias.parent.mkdir(parents=True, exist_ok=True)
                alias.symlink_to(canonical, target_is_directory=True)
        except OSError:
            # The post-write artifact router remains the fallback on restricted filesystems.
            pass
    return canonical
