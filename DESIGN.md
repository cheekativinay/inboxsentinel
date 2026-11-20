# InboxSentinel — Studio Design DNA & System Lockfile

Crafted under the **Principal Design Studio Constitution**, synthesizing the DNA of **Resend** (developer observability), **Raycast & Linear** (1px precision SaaS & tactile micro-interactions), and **Dub** (interactive hero utility).

---

## 1. Aesthetic Archetype & Design DNA
- **Design Archetype:** Resend Developer Infra (`Resend_DeveloperInfraArchetype`) + Raycast Precision SaaS (`Raycast_PrecisionSaaSArchetype`).
- **Core Value Proposition:** 24/7 B2B Cold Outbound Deliverability Watchdog & Blacklist Siren.
- **Zero-Access Architecture:** 100% passive DNS lookups over public DNS sockets; zero passwords, zero OAuth, zero mailbox access, zero legal liability.
- **Anti-Slop Guarantees:**
  - Zero pitch-black voids with neon purple/cyan gradients.
  - Zero centered 3-card generic layouts.
  - Zero emoji spam in UI copy and labels.
  - Generous whitespace, editorial rhythm, and crisp 1px hairline dividers (`#242320`).
  - Mandatory `cursor: pointer !important` on all interactive clickables.

---

## 2. Calibrated Color Palette (60-30-10 Studio Balance)
| Token | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| **Canvas Base (60%)** | `#0c0c0b` | Warm obsidian base canvas (softer and deeper than harsh `#000000`). |
| **Surface Layer (30%)** | `#141412` | Elevated container cards, tables, and command bars. |
| **Elevated Surface** | `#1b1b18` | Interactive pill backgrounds, inputs, dropdowns. |
| **Hairline Dividers** | `#242320` | Crisp 1px borders and table separators. |
| **Interactive Border** | `#33322d` | Active borders and input focus rings. |
| **Text Primary (Ink)** | `#f5f3ef` | Warm crisp off-white for headlines and data values. |
| **Text Secondary** | `#a39e93` | Muted descriptions and secondary metadata. |
| **Text Subtle** | `#706b62` | Micro-labels, protocol specs, timestamps. |
| **Semantic Accents (10%)** | Emerald `#10b981`<br/>Amber `#f59e0b`<br/>Rose `#f43f5e` | Functional status badges only (Clean, PermError, Blacklisted). |

---

## 3. Typography System
- **Interface & Body:** `Plus Jakarta Sans` (`--font-sans`) — crisp, modern grotesque with balanced optical geometry.
- **Editorial Accents:** `Newsreader` (`--font-serif`) italic — used selectively for human editorial emphasis.
- **Telemetry & DNS Data:** `JetBrains Mono` (`--font-mono`) with strict `tabular-nums` for DNS TXT records, SPF lookup counts, query latencies, and timestamps.

---

## 4. Tactile Micro-Interactions (`emil-design-eng`)
- **Interactive Cursor:** `cursor: pointer !important` enforced across `button`, `[role="button"]`, `a`, `select`, `input[type="range"]`, and preset pills.
- **Tactile Press Physics:**
  - Press: `transform: scale(0.98)` over `75ms`.
  - Release: Rebounds cleanly over `180ms cubic-bezier(0.16, 1, 0.3, 1)`.
- **Zero-Blank-Void Protocol:** The application loads with an immediate live audit of `stripe.com` so users never see an empty screen.
- **Instant Preset Chips:** Interactive pills switch audit targets with live visual indicators and no layout shifts.
- **1-Click Copy Snippet:** Instant clipboard feedback with `CheckCheck` transition.
