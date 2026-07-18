# Fairway Club — Booking Demo Guide

A walkthrough of how the demo works, written for a human to read. There are two sides:

- **Customer app** — what a golfer uses on their phone to book a bay (styled like a LINE mini-app).
- **Staff console** — what the club's staff use on a computer: a **Dashboard**, a **Customers** directory, and a **Reports** page.

Everything runs in the browser with no login. Bookings are stored locally and the two sides talk to each other **live when both are open in the same browser**.

---

## Live links

| Page | Who it's for | Link |
|------|--------------|------|
| Customer app | Golfer (phone) | https://pnwpnwpnw.github.io/golf-sim-demo/customer.html |
| Dashboard | Staff | https://pnwpnwpnw.github.io/golf-sim-demo/dashboard.html |
| Customers | Staff | https://pnwpnwpnw.github.io/golf-sim-demo/customers.html |
| Reports | Staff | https://pnwpnwpnw.github.io/golf-sim-demo/reports.html |
| Full demo (side-by-side) | Presenting | https://pnwpnwpnw.github.io/golf-sim-demo/full-demo.html |

> **The best way to see it work:** open the **customer app** in one browser tab and the **dashboard** in another (same computer/browser). Make a booking on the customer side and watch it appear on the dashboard instantly. The **Full demo** link shows both at once — phone on the left, staff console on the right.
>
> ⚠️ **Note:** the live sync only works within the **same browser**. If you open the customer app on your phone and the dashboard on a separate computer, they will **not** share data — each device keeps its own.

---

## The booking rules (baked into the demo)

- **Opening hours:** 09:00–21:00
- **Two bays** (Bay 1, Bay 2) — the customer never picks a bay; the system **auto-assigns** the free one
- **Session length:** 30 minutes up to 3 hours, in 30-minute steps
- **Booking window:** the next 14 days
- **5-minute buffer** reserved after every session so the bay can be reset
- **Promo:** book a full 3-hour session and the **last hour is free**
- **Prices (demo values):** 30 min = ฿400, 1 hour = ฿600, 3 hours = ฿1,200 (last hour free)

---

## Part 1 — The Customer App

A golfer opens the link and moves through a short, guided flow. Here's each step.

### Step 1 — Pick a day, length, and time
- **Choose a day** from the horizontal strip (Today is first, up to 14 days ahead).
- **How long?** Pick a session length. The price shows on each chip, and the 3-hour option is flagged **"LAST HR FREE"** with the original price struck through.
- **Available start times** appear as a grid. Each open slot shows when it would end (e.g. "ends 10:00"). A slot marked **"1 left"** in amber means only one bay is free at that time. Slots that are **booked, blocked, past, or too late to fit** are greyed out and can't be tapped.
- Tap a start time to select it. The bar at the bottom updates with your session summary and price. Tap **Continue**.

### Step 2 — Your details
- A summary card shows the bay (auto-assigned), date, time, duration, any promo, and total.
- Enter your **name** (required) and **phone** (optional).
- Tap **Continue to payment**.

### Step 3 — Pay and send your slip
- A **PromptPay QR code** and the club's bank details are shown (both mocked — no real payment happens).
- Tap **Upload transfer slip** to attach a screenshot (also mocked — it just simulates a file).
- Tap **Send slip**.
- **Demo control:** there's a toggle labelled **"Force slip mismatch."** Leave it off for a normal successful booking. Turn it **on** to simulate a payment that fails verification (useful for showing the rejection flow).

### Step 4 — Verifying
- A short "Verifying your slip…" screen appears (~2 seconds). Behind the scenes, the booking is immediately created as **pending** so staff can see it arrive on their dashboard.

### Step 5 — Result
- **Success:** a confirmation screen with your **booking reference** (e.g. `GS-4K2P9`), the session details, and a note that it now appears on the staff dashboard. You can **book another** or view **My bookings**.
- **Failure** (if you flipped the toggle): the booking is **cancelled**, the slot is **released** back to availability, and you're invited to rebook. No charge is made.

### My bookings
- Tap **"View my bookings"** (top of the first screen) any time to see your history. Each entry shows a status pill: **VERIFYING** (awaiting staff), **CONFIRMED**, or **CANCELLED**. This list **updates live** as staff approve or reject.

---

## Part 2 — The Staff Console

Three pages, linked by the green nav bar at the top: **Dashboard · Customers · Reports.**

### Dashboard — "Today at a glance"

The staff home base. It has four parts:

**1. KPI cards (top row)**
- **Bookings today** — count of confirmed + pending sessions today, plus how many time-slots are used.
- **Revenue this week** — confirmed bookings, Monday–Sunday.
- **Utilization today** — percentage of the day's bay-slots that are occupied.
- **Pending slips** — how many customer payments are waiting for review (shows a red badge when there are any).

**2. Bookings timeline**
- A grid of the day's slots, one column per bay. Use the **‹ ›** arrows to move between days.
- Each booking is a coloured block: **green = confirmed**, **amber = pending slip**, **striped grey = blocked**.
- **Hover an empty slot** to get a **＋ Add** shortcut, or **click a blocked slot** to release it.

**3. Pending slips (right side)**
- The queue of customer payments awaiting review. Each shows the customer, reference, amount, session, and a (mock) transfer slip.
- **✓ Approve** confirms the booking (the customer's app updates to CONFIRMED).
- **✕ Reject** cancels it and frees the slot.
- This is where a booking made in the customer app lands the moment the customer taps "Send slip."

**4. Upcoming bookings (below the timeline)**
- A running list of the next confirmed, pending, and blocked bookings, with reference, customer, bay, when, and status.

**Staff actions (top-right buttons):**
- **＋ Add walk-in booking** — book someone at the counter; it's confirmed instantly.
- **⊘ Block time** — mark a bay unavailable (maintenance, private event). Blocked time disappears from customer availability immediately.

### Customers — the directory

A roll-up of everyone who has booked, built automatically from the booking history.

- **KPI cards:** total customers, repeat customers (and %), average spend per customer, and how many have an upcoming session.
- **Directory (left):** every customer with their avatar, a segment tag (**Regular / Returning / New**), phone, channel, lifetime spend, and visit count.
  - **Search** by name or phone.
  - **Sort** by top spend, most visits, most recent, or name.
- **Detail panel (right):** click any customer to see their profile — visits, lifetime value, average per visit, upcoming count, channel, first-seen date — and their **full booking history** with status pills.
- Updates live: approve a booking on the Dashboard and that customer's numbers change here.

### Reports — the analytics

Business trends over a trailing window (toggle **Last 7 days / Last 14 days**). All figures are computed from confirmed bookings.

- **Hero KPIs:** revenue, bookings, average booking value, utilisation, and 3-hour promos redeemed.
- **Revenue by day** — bar chart, today highlighted; expandable to a table.
- **Bookings by start hour** — when demand peaks.
- **Session length mix** — which durations customers choose.
- **Bay utilisation** — how evenly the two bays are used (auto-assign aims to keep them balanced).
- **Booking channel** — LINE self-service vs. staff-entered walk-ins.

---

## How the two sides connect (the demo story)

1. A customer books on their phone app → the booking appears as a **pending slip** on the staff **Dashboard**.
2. Staff **approve** the slip → the customer's app flips to **CONFIRMED**, and the booking joins the timeline.
3. The **Customers** page now counts that person, and **Reports** rolls the revenue into its charts.
4. If staff **block** a bay or add a **walk-in**, those slots vanish from the customer app's availability right away.

This back-and-forth is the point of the demo — one shared set of bookings, seen from both the customer's and the club's perspective, updating live.

---

## Resetting the demo

The demo seeds itself with a realistic set of bookings (today's schedule plus ~13 days of history so the Reports page has data). To start clean, use the **↻ Reset demo data** button on the **Full demo** page, which clears everything and re-seeds.

*All names, prices, payment details, and slips are mock data — nothing here charges real money or sends real messages.*
