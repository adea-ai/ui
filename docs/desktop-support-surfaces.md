# Desktop support surfaces

Adea and Cortana use the same support menu and composed dialogs. The host owns native updates, clipboard permissions, external browser routing, app identity, and help resources; the shared library owns their presentation and keyboard behavior.

- `createAppMenuItems` supplies About, Help Center, Send Feedback, desktop Updates, and Settings in that order. Supply one `primaryItem` for Adea mobile or Cortana Index. Destinations run after menu closure and receive its stable trigger. Cortana uses `AccountMenu showSession={false}`; Adea retains its session actions.
- `UpdateDialog` accepts the actual desktop `appIcon`, complete installed `changelog`, and an `UpdateAdapter`. Hosts must preserve the complete compiled changelog rather than truncate its older versions. `pollIntervalMs` enables bounded polling during native downloads, installs, and cancellation; `cancel` and `openExternal` stay native adapters. Installation receives the expected version so native approval, signing, and race checks remain authoritative.
- `AboutDialog` presents the app icon, name, version, copyright, copy-version action, and source link. It has an accessible About name without a second visible About heading or marketing description. Supply `copyVersionInfo` or `openExternal` when the desktop host owns those permissions.
- `HelpCenter` presents the host's real keyboard shortcuts and project resources. Supply platform-correct keys and native external-link handling. Feedback opens an issue template for the user to review and submit; it never sends a report automatically.

Use the public `components/composites/*` subpaths in both apps. Do not recreate these dialogs, their menu labels/order, or their appearance in either consumer. Keep the workshop stories, packed consumer contracts, and Chromium/WebKit interaction tests as the shared regression gates.

`AccountMenu placement="right-end" gutter={4} hideArrow` anchors a rail menu beside its trigger with its bottom aligned. Use this shared placement API when the host rail needs it; the default remains `top-start`. Do not replace the composed menu or restyle its positioning in app CSS.
