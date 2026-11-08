# Blink web UI polish

## What changed

- Shared light/dark foundations for page backgrounds, surfaces, borders, typography, buttons and feature palettes in `apps/web/src/BlinkPolish.css`.
- Five clear navigation destinations: Home, Connections, Capture, Reels and Explore. Route-derived active states work on direct links and browser back/forward. All previous destinations remain available through Explore, existing links and existing URLs. Added a shared SVG icon set for navigation and call actions.
- Explore groups existing social and professional tools, including direct Inbox and Check-In/IRL access. Home drawer also links to Explore and Inbox.
- Mobile Inbox separates the conversation list from the active chat; Back returns to conversations. The bottom navigation hides only during a mobile conversation. Desktop keeps independent list/chat panes.
- Stronger contrast for primary action labels and sent messages; brighter readable secondary text in dark mode. The logo stays on a white backing in dark headers.
- Refined Home Check-In sizing, feed spacing, profile cover/avatar layout, cards, page headings and controls. Removed the empty profile More tab.
- IRL uses a two-column desktop workspace instead of reserving an empty third column. Owner management tools are grouped under an accessible disclosure.
- Business fields, chat and meeting surfaces use theme tokens. The Business Dashboard now shows the saved profile's actual activation state and useful navigation instead of an unfinished-page placeholder; no fabricated metrics are displayed.
- Existing confirmation/prompt flows now use a shared native modal dialog, preserving the original messages and API actions. Cancel/Escape resolves without approving an action. Group renaming remains supported.
- Custom modal keyboard handling, focus containment/restoration and scroll locking are shared. Incoming calls take priority over media panels; native confirmations use the browser's top layer. Escape never hangs up a call.
- Content-shaped loaders for the feed, profiles, people, services, plans and business discovery, plus Inbox row placeholders. Reduced-motion preferences are respected.
- Wider desktop video call stage, contained remote video and visible peer/status information. Calling audio/signaling logic is unchanged.

## Validation

- `npm run build` in `Blink/apps/web`: TypeScript and Vite production build.
- `git diff --check`.
- Browser review with local, disposable sample responses: mobile Explore and Home at 390px; active Inbox/list/back flow at 390px; cancel/Escape and restored focus for conversation confirmation; dark Business Profile Settings at desktop width; narrow dark profile at 320px; desktop IRL owner disclosure.
- The local QA harness and fixtures are ignored and excluded from the commit. They do not call or mutate real account data.

## Limits

This is a frontend polish change. Production API workflows, device permissions, camera capture, media uploads, live calls and real-account end-to-end behaviour require verification in the deployed environment. The build's existing large-chunk advisory is not addressed by this visual pass. There are no API, database, authorization or Android source changes in this commit.
