# History

## 2026-06-08

- Canonicalized the offline PWA topic from the legacy draft
  `docs/pwa-offline-support.md`.
- Locked the production deployment truth to root-path hosting at
  `https://paste-preset.ivanli.cc/`.
- Replaced the previous immediate-takeover service worker behavior with an
  explicit waiting-update contract surfaced through the UI.
- Captured and persisted reviewed visual evidence for the waiting-update prompt
  and offline desktop shell.
- Tightened the runtime so passive tabs that already observed a waiting update
  also refresh on `controllerchange`, avoiding mixed asset sets after update
  activation.
