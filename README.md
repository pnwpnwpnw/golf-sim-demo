# Fairway Club — Golf Simulator Booking Demo

A **standalone, client-facing demo** of a golf-simulator booking system: a
mobile customer app (simulating a LINE LIFF mini-app) and a desktop staff
console, wired together so they *feel* connected. It's a static mockup — **no
backend, no database, no real payments**. Both pages share a small local data
layer so actions in one show up in the other.

> ⚠️ **Demo only.** Not connected to any real system. All data is mock/simulated.

## Files

| File | What it is |
|------|------------|
| `customer.html` | Mobile-first customer booking app (LINE LIFF simulation) |
| `dashboard.html` | Desktop staff dashboard (bookings timeline, pending slips, walk-ins, blocks) |
| `reports.html` | Analytics/reports page (revenue, peak hours, session mix, bay split) |
| `data-layer.js` | Shared "database" both pages read/write via `localStorage` |

## How to run

No server needed — open the HTML files in a browser:

1. Open `customer.html` and `dashboard.html` in **two windows, side by side**.
2. Use the **same browser** for all pages (they sync through that browser's
   `localStorage` — different browsers = separate data).
3. Reach the reports page from the **Reports** tab in the dashboard nav.

Make a booking in the customer app → it appears in the dashboard's pending-slips
queue and timeline. Approve/reject a slip, add a walk-in, or block time in the
dashboard → the customer app's availability updates to match.

**Reset the demo data:** open any page, then in the browser console run
`DataLayer.resetAll()` and refresh. This restores the seeded starting state
(today's bookings + 13 days of history for the reports page).

## What's real vs. what's demo dressing

**Locked-in / real design decisions** (reflected in `data-layer.js`):

- Ref-code format `GS-XXXXX` (2-letter prefix + 5 readable base32 chars)
- 5-minute buffer between bookings in a bay
- 30-minute booking grid, sessions start on :00 / :30
- Flexible duration: 30 min up to 3 hours
- Operating hours 09:00–21:00, 14-day rolling window, 2 bays
- Status model: `pending-payment → confirmed | cancelled`, plus `blocked`
- Bays are interchangeable → the customer never picks one; a free bay is
  auto-assigned

**Cosmetic / mocked (not yet signed off — treat as proposals):**

- Pricing ladder: 30 min ฿400 · 1 hr ฿600 · **3 hrs = pay 2 (last hour free)**
- QR/PromptPay + bank details, the 2-second "slip verification", slip upload
- "Fairway Club" branding, colours, copy
- Seed bookings and the 13 days of report history (synthetic; historical bay
  assignment is random, not the real auto-assign algorithm)

## Branding

- Accent: rich fairway green (`#1F5C3D`)
- Headings: Space Grotesk · Body: Inter · Codes/labels: JetBrains Mono
