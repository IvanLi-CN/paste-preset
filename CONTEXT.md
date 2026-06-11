# PastePreset

PastePreset is a browser-only image processing tool centered on fast clipboard
and file-drop workflows. Its domain language distinguishes the immediately
available cached UI from the heavier offline codec preparation that can happen
later.

## Language

**Cached App Shell**:
The minimal local UI bundle that can render immediately on a return visit,
including the root document, core scripts, styles, icons, version metadata, and
common image-processing assets.
_Avoid_: Offline-first shell, bootstrap HTML

**Background Warmup**:
The deferred caching pass that prepares optional heavy codec assets after the
cached app shell is already visible.
_Avoid_: Eager preload, first-load precache

**Full Offline-Ready**:
The runtime state where optional heavy codec assets have finished caching and
advanced offline formats can run without another network visit.
_Avoid_: Fully installed, fully synced
