# Privacy Policy — Memos Web Clipper

**Last updated:** 2026-03-28

## Overview

Memos Web Clipper is an open-source Chrome extension that helps users save thoughts and clip web content to their **self-hosted** Memos instance. This extension does not collect, store, or transmit any personal data to third parties.

## Data Collection

**This extension does not collect any personal data.**

All data processed by the extension is sent exclusively to the Memos server URL configured by the user. No analytics, telemetry, or tracking of any kind is included.

## Data Storage

The extension stores the following configuration locally in your browser via `chrome.storage.sync`:

- **Memos server URL** — the address of your self-hosted Memos instance
- **Access Token** — your personal access token for authenticating with your Memos server
- **Default tags** — your preferred default tags for clipped content
- **Visibility preference** — your preferred memo visibility setting
- **Language preference** — your chosen UI language

This data is synced across your Chrome browsers if you are signed in to Chrome sync. It is never sent to any server other than your own configured Memos instance.

## Permissions

The extension requests the following permissions:

| Permission | Purpose |
|---|---|
| `activeTab` | Read the current page content when you choose to clip it |
| `storage` | Save your configuration (server URL, token, preferences) |
| `scripting` | Execute content extraction scripts on the active tab when clipping |
| `contextMenus` | Add a right-click menu option to send selected text to Memos |
| `host_permissions` (all URLs) | Communicate with your self-hosted Memos instance, which can be at any URL |

## Network Requests

The extension only makes network requests to the Memos server URL you configure. These requests include:

- Creating memos (`POST /api/v1/memos`)
- Uploading attachments (`POST /api/v1/attachments`)
- Testing the connection (`GET /api/v1/memos`)
- Fetching content length limits (`GET /api/v1/instances/settings`)

No data is ever sent to any other server.

## Third-Party Services

This extension does not use any third-party services, analytics, or tracking tools.

## Open Source

The complete source code is available at:
https://github.com/TJKkking/memos-chrome-extension

## Contact

If you have questions about this privacy policy, please open an issue on the GitHub repository.
