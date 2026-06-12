# Cached shell first, warm heavy offline assets in the background

PastePreset now serves the cached app shell immediately on repeat visits instead of waiting on a navigation network round-trip, while still checking for updates in the background and keeping activation behind an explicit user action. Heavy optional codec assets such as HEIC and animated-format helpers move to a separate warmup manifest so common offline flows stay fast and advanced offline support becomes a second-phase readiness state instead of a startup blocker.
