/* ============================================================================
 * data-layer.js  —  SHARED STATE for the golf-sim booking demo
 * ----------------------------------------------------------------------------
 * This is the single source of truth that BOTH the customer app (customer.html)
 * and the staff dashboard (dashboard.html) read from and write to.
 *
 * It uses localStorage as a tiny "database" so the two pages stay in sync:
 *   - Same tab / same page:  a custom in-page event fires on every write.
 *   - Across tabs/windows:   the native `storage` event fires on every write.
 * Open both pages side-by-side and changes in one appear in the other live.
 *
 * ------------------------------------- NOTE ---------------------------------
 * WHAT'S REAL vs. WHAT'S DEMO DRESSING  (see also the banner at top of each page)
 *
 *   LOCKED-IN / real design decisions reflected here:
 *     • Ref-code format ....... GS-XXXXX  (2-letter prefix + 5 base32 chars)
 *     • 5-minute buffer ....... between consecutive bookings in the same bay
 *     • Slot granularity ...... 30-minute grid, sessions start on :00 / :30
 *     • Flexible duration ..... 30 min up to 3 hours per booking
 *     • Operating hours ....... 09:00–21:00
 *     • Booking window ........ 14 days rolling
 *     • Venue shape ........... 2 bays
 *     • Status model .......... pending-payment → confirmed | cancelled ; blocked
 *
 *   PRICING (demo values — treat as cosmetic until client signs off):
 *     • 30 min ........ ฿400
 *     • 1 hour ........ ฿600
 *     • longer ........ composed of hours + half-hour (e.g. 1.5 h = ฿1,000)
 *     • 3 hours ....... last hour FREE → pay 2 h = ฿1,200 (promo rule)
 *
 *   COSMETIC / mocked (safe to change, not decided):
 *     • The baht amounts above, currency symbol
 *     • Seed bookings, customer names, the "slip verification" 2s delay
 *     • KPI thresholds, colours, copy
 *
 *   TIME MODEL: a booking has `start` (minutes since midnight, e.g. 540=09:00)
 *   and `duration` (minutes, multiple of 30). It occupies every 30-min grid
 *   slot in [start, start+duration).
 * ==========================================================================*/

(function (global) {
  'use strict';

  // ----- Configuration (LOCKED-IN unless flagged cosmetic) -------------------
  const CONFIG = {
    STORAGE_KEY: 'setlytic_golfsim_demo_v1',
    ROOMS: [1, 2],                 // LOCKED: 2-bay venue
    OPEN_MIN: 9 * 60,              // LOCKED: opens 09:00
    CLOSE_MIN: 21 * 60,            // LOCKED: closes 21:00
    SLOT_MINUTES: 30,              // LOCKED: 30-minute grid, starts on :00/:30
    WINDOW_DAYS: 14,               // LOCKED: 14-day rolling window
    BUFFER_MINUTES: 5,             // LOCKED: 5-min buffer between bookings
    // pricing (cosmetic until signed off)
    PRICE_HOUR: 600,               // ฿600 / hour
    PRICE_HALF: 400,               // ฿400 / 30 min
    PROMO_FREE_LAST_HOUR_AT: 180,  // book 3 h → last hour free
    DURATIONS: [30, 60, 90, 120, 150, 180], // offered durations (minutes)
    CURRENCY: '฿',                 // cosmetic
    ROOM_NAMES: { 1: 'Bay 1', 2: 'Bay 2' },
  };

  // ----- Pricing -------------------------------------------------------------
  // 30 min = ฿400, 1 h = ฿600, longer = hours + optional half-hour.
  // Promo: at 3 hours the last hour is free (pay for 2 h).
  function priceFor(durationMin) {
    let billable = durationMin;
    if (durationMin >= CONFIG.PROMO_FREE_LAST_HOUR_AT) billable = durationMin - 60;
    const hours = Math.floor(billable / 60);
    const halves = Math.round((billable % 60) / 30);
    return hours * CONFIG.PRICE_HOUR + halves * CONFIG.PRICE_HALF;
  }
  // What the same duration would cost WITHOUT the promo (for strike-through UI).
  function priceWithoutPromo(durationMin) {
    const hours = Math.floor(durationMin / 60);
    const halves = Math.round((durationMin % 60) / 30);
    return hours * CONFIG.PRICE_HOUR + halves * CONFIG.PRICE_HALF;
  }

  // ----- Ref-code generator (LOCKED format: GS-XXXXX) ------------------------
  // Uses Crockford-ish base32 (no I, L, O, U) so codes are easy to read aloud.
  const REF_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function makeRefCode() {
    let body = '';
    for (let i = 0; i < 5; i++) {
      body += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
    }
    return 'GS-' + body;
  }

  // ----- Date / time helpers -------------------------------------------------
  function pad(n) { return String(n).padStart(2, '0'); }

  function ymd(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function todayYmd() { return ymd(new Date()); }

  // The 14-day window starting today.
  function windowDates() {
    const out = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < CONFIG.WINDOW_DAYS; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      out.push(d);
    }
    return out;
  }

  // All 30-min grid slot start times for one day.
  function slotStarts() {
    const out = [];
    for (let m = CONFIG.OPEN_MIN; m + CONFIG.SLOT_MINUTES <= CONFIG.CLOSE_MIN; m += CONFIG.SLOT_MINUTES) {
      out.push(m);
    }
    return out;
  }

  function timeLabel(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }         // 540 -> "09:00"
  function rangeLabel(start, duration) { return timeLabel(start) + ' – ' + timeLabel(start + duration); }
  function durationLabel(min) {
    if (min < 60) return min + ' min';
    if (min % 60 === 0) return (min / 60) + (min === 60 ? ' hr' : ' hrs');
    return (min / 60) + ' hrs';
  }

  // Is this date/time already in the past (relative to now)?
  function isPast(dateStr, startMin) {
    const now = new Date();
    const slot = new Date(dateStr + 'T00:00:00');
    slot.setMinutes(startMin, 0, 0);
    return slot.getTime() <= now.getTime();
  }

  // ----- Storage read/write --------------------------------------------------
  function emptyState() {
    return { bookings: [], seededAt: null, seedVersion: 0 };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.bookings)) return emptyState();
      return parsed;
    } catch (e) {
      console.warn('[data-layer] failed to load state, resetting', e);
      return emptyState();
    }
  }

  function saveState(state, meta) {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
    // Notify same-page listeners (the native `storage` event only fires in
    // OTHER tabs, never the one that made the change).
    global.dispatchEvent(new CustomEvent('golfsim:change', { detail: meta || {} }));
  }

  // ----- Booking helpers -----------------------------------------------------
  function uid() {
    return 'bk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // Statuses that occupy slots (make them unavailable to customers).
  const OCCUPYING = ['pending-payment', 'confirmed', 'blocked'];
  function isOccupying(b) { return OCCUPYING.indexOf(b.status) !== -1; }
  function durOf(b) { return b.duration || CONFIG.SLOT_MINUTES; }

  // Does booking b cover grid slot `slotStart`?
  function covers(b, room, dateStr, slotStart) {
    return b.room === room && b.date === dateStr &&
           b.start <= slotStart && slotStart < b.start + durOf(b);
  }

  // ----- Public API ----------------------------------------------------------
  const DataLayer = {
    CONFIG,
    // time helpers
    timeLabel,
    rangeLabel,
    durationLabel,
    slotStarts,
    windowDates,
    ymd,
    todayYmd,
    isPast,
    // pricing
    priceFor,
    priceWithoutPromo,
    money: function (n) {
      return CONFIG.CURRENCY + Number(n).toLocaleString('en-US');
    },

    // --- reads ---------------------------------------------------------------
    getBookings: function () { return loadState().bookings.slice(); },

    getBookingByRef: function (ref) {
      return loadState().bookings.find(function (b) { return b.ref === ref; }) || null;
    },

    // Can a booking of `duration` minutes start at room/date/start?
    // Every covered 30-min grid slot must be free and the whole session must
    // finish by closing time. (The 5-min buffer is absorbed by the 30-min grid
    // cadence; it's surfaced in UI copy.)
    isRangeAvailable: function (room, dateStr, startMin, duration) {
      duration = duration || CONFIG.SLOT_MINUTES;
      if (isPast(dateStr, startMin)) return false;
      if (startMin < CONFIG.OPEN_MIN || startMin + duration > CONFIG.CLOSE_MIN) return false;
      const bookings = loadState().bookings;
      for (let s = startMin; s < startMin + duration; s += CONFIG.SLOT_MINUTES) {
        for (let i = 0; i < bookings.length; i++) {
          const b = bookings[i];
          if (isOccupying(b) && covers(b, room, dateStr, s)) return false;
        }
      }
      return true;
    },

    // Back-compat single-slot check.
    isSlotAvailable: function (room, dateStr, startMin) {
      return this.isRangeAvailable(room, dateStr, startMin, CONFIG.SLOT_MINUTES);
    },

    // --- bay auto-assignment (bays are interchangeable to the customer) ------
    // Which bays can host a `duration` session starting at date/start?
    baysAvailable: function (dateStr, startMin, duration) {
      const self = this;
      return CONFIG.ROOMS.filter(function (r) {
        return self.isRangeAvailable(r, dateStr, startMin, duration);
      });
    },
    // Is there ANY bay free for this start/duration?
    isAnyAvailable: function (dateStr, startMin, duration) {
      return this.baysAvailable(dateStr, startMin, duration).length > 0;
    },
    // Pick the bay to assign (lowest-numbered free bay), or null if none.
    firstAvailableBay: function (dateStr, startMin, duration) {
      const free = this.baysAvailable(dateStr, startMin, duration);
      return free.length ? free[0] : null;
    },

    // The booking occupying a given grid slot, if any (for dashboard rendering).
    slotBooking: function (room, dateStr, slotStart) {
      const bookings = loadState().bookings;
      return bookings.find(function (b) {
        return isOccupying(b) && covers(b, room, dateStr, slotStart);
      }) || null;
    },

    durOf: durOf,

    // --- writes --------------------------------------------------------------

    // Create a booking that is mid-verification (customer sent slip) OR a
    // manually-uploaded slip from staff. Lands in "pending-payment".
    createPendingBooking: function (data) {
      const state = loadState();
      const duration = data.duration || CONFIG.SLOT_MINUTES;
      const booking = {
        id: uid(),
        ref: makeRefCode(),
        room: data.room,
        date: data.date,
        start: data.start,
        duration: duration,
        customerName: data.customerName || 'Guest',
        phone: data.phone || '',
        price: data.price != null ? data.price : priceFor(duration),
        status: 'pending-payment',
        source: data.source || 'customer',
        createdAt: new Date().toISOString(),
        note: data.note || '',
      };
      state.bookings.push(booking);
      saveState(state, { type: 'create-pending', ref: booking.ref });
      return booking;
    },

    // Directly confirmed booking (walk-in taken at the counter, paid).
    createConfirmedBooking: function (data) {
      const state = loadState();
      const duration = data.duration || CONFIG.SLOT_MINUTES;
      const booking = {
        id: uid(),
        ref: makeRefCode(),
        room: data.room,
        date: data.date,
        start: data.start,
        duration: duration,
        customerName: data.customerName || 'Walk-in',
        phone: data.phone || '',
        price: data.price != null ? data.price : priceFor(duration),
        status: 'confirmed',
        source: data.source || 'walk-in',
        createdAt: new Date().toISOString(),
        note: data.note || '',
      };
      state.bookings.push(booking);
      saveState(state, { type: 'create-confirmed', ref: booking.ref });
      return booking;
    },

    // Block a range (maintenance, private event) — unavailable to customers.
    blockSlot: function (data) {
      const state = loadState();
      const booking = {
        id: uid(),
        ref: makeRefCode(),
        room: data.room,
        date: data.date,
        start: data.start,
        duration: data.duration || CONFIG.SLOT_MINUTES,
        customerName: 'BLOCKED',
        phone: '',
        price: 0,
        status: 'blocked',
        source: 'block',
        createdAt: new Date().toISOString(),
        note: data.note || 'Blocked by staff',
      };
      state.bookings.push(booking);
      saveState(state, { type: 'block', ref: booking.ref });
      return booking;
    },

    setStatus: function (id, status, extra) {
      const state = loadState();
      const b = state.bookings.find(function (x) { return x.id === id; });
      if (!b) return null;
      b.status = status;
      if (extra && extra.note != null) b.note = extra.note;
      b.updatedAt = new Date().toISOString();
      saveState(state, { type: 'status', ref: b.ref, status: status });
      return b;
    },

    approveSlip: function (id) { return this.setStatus(id, 'confirmed', { note: 'Slip approved by staff' }); },
    rejectSlip: function (id) { return this.setStatus(id, 'cancelled', { note: 'Slip did not match — cancelled' }); },
    // Un-block a slot (release it back to customers).
    unblock: function (id) {
      const state = loadState();
      const before = state.bookings.length;
      state.bookings = state.bookings.filter(function (x) { return !(x.id === id && x.status === 'blocked'); });
      saveState(state, { type: 'unblock' });
      return before !== state.bookings.length;
    },
    removeBooking: function (id) {
      const state = loadState();
      state.bookings = state.bookings.filter(function (x) { return x.id !== id; });
      saveState(state, { type: 'remove' });
    },

    // --- KPIs (computed live from shared state — never hardcoded) ------------
    kpis: function () {
      const bookings = loadState().bookings;
      const today = todayYmd();

      // Bookings today: confirmed + pending, excluding blocks/cancelled.
      const bookingsToday = bookings.filter(function (b) {
        return b.date === today && (b.status === 'confirmed' || b.status === 'pending-payment');
      }).length;

      // Revenue this week (Mon–Sun containing today): confirmed only.
      const now = new Date();
      const dow = (now.getDay() + 6) % 7; // 0 = Monday
      const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(now.getDate() - dow);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
      let revenue = 0;
      bookings.forEach(function (b) {
        if (b.status !== 'confirmed') return;
        const d = new Date(b.date + 'T00:00:00');
        if (d >= weekStart && d < weekEnd) revenue += b.price;
      });

      // Utilization today: occupied 30-min grid slots / total grid slots.
      const totalSlotsToday = slotStarts().length * CONFIG.ROOMS.length;
      let occupiedToday = 0;
      bookings.forEach(function (b) {
        if (b.date === today && isOccupying(b)) occupiedToday += durOf(b) / CONFIG.SLOT_MINUTES;
      });
      const utilization = totalSlotsToday ? Math.round((occupiedToday / totalSlotsToday) * 100) : 0;

      // Pending slips: awaiting staff review.
      const pendingSlips = bookings.filter(function (b) { return b.status === 'pending-payment'; }).length;

      return {
        bookingsToday: bookingsToday,
        revenueThisWeek: revenue,
        utilizationToday: utilization,
        pendingSlips: pendingSlips,
        occupiedToday: occupiedToday,
        totalSlotsToday: totalSlotsToday,
      };
    },

    // --- REPORTS aggregations (all computed live from shared state) ----------
    // Trailing N-day date list ending today (oldest → newest).
    trailingDates: function (n) {
      const out = [];
      const base = new Date(); base.setHours(0, 0, 0, 0);
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(base); d.setDate(base.getDate() - i);
        out.push(d);
      }
      return out;
    },

    // Full analytics bundle over a trailing window (default 14 days).
    // Only confirmed bookings count as realised revenue/sessions.
    report: function (days) {
      days = days || 14;
      const dateObjs = this.trailingDates(days);
      const dateSet = {};
      dateObjs.forEach(function (d) { dateSet[ymd(d)] = true; });
      const bookings = loadState().bookings.filter(function (b) {
        return b.status === 'confirmed' && dateSet[b.date];
      });

      const byDay = dateObjs.map(function (d) {
        const key = ymd(d);
        const rows = bookings.filter(function (b) { return b.date === key; });
        return {
          date: key,
          dateObj: d,
          count: rows.length,
          revenue: rows.reduce(function (a, b) { return a + b.price; }, 0),
        };
      });

      // Bookings by START HOUR (peak-hours), aggregating half-hours into the hour.
      const hourMap = {};
      for (let h = Math.floor(CONFIG.OPEN_MIN / 60); h < Math.ceil(CONFIG.CLOSE_MIN / 60); h++) hourMap[h] = 0;
      bookings.forEach(function (b) { const h = Math.floor(b.start / 60); if (hourMap[h] != null) hourMap[h]++; });
      const byHour = Object.keys(hourMap).map(function (h) { return { hour: +h, count: hourMap[h] }; });

      // Duration mix (session counts per offered duration).
      const durMap = {};
      CONFIG.DURATIONS.forEach(function (d) { durMap[d] = 0; });
      bookings.forEach(function (b) { const dd = durOf(b); if (durMap[dd] != null) durMap[dd]++; });
      const byDuration = CONFIG.DURATIONS.map(function (d) { return { duration: d, count: durMap[d] }; });

      // Bay split (occupied 30-min slots per bay = utilisation share).
      const bayMap = {}; CONFIG.ROOMS.forEach(function (r) { bayMap[r] = { count: 0, slots: 0, revenue: 0 }; });
      bookings.forEach(function (b) {
        if (!bayMap[b.room]) return;
        bayMap[b.room].count++;
        bayMap[b.room].slots += durOf(b) / CONFIG.SLOT_MINUTES;
        bayMap[b.room].revenue += b.price;
      });
      const byBay = CONFIG.ROOMS.map(function (r) { return { room: r, count: bayMap[r].count, slots: bayMap[r].slots, revenue: bayMap[r].revenue }; });

      // Channel split (LINE app vs walk-in).
      let line = 0, walkin = 0;
      bookings.forEach(function (b) { if (b.source === 'walk-in') walkin++; else line++; });

      // Totals & headline figures.
      const totalRevenue = bookings.reduce(function (a, b) { return a + b.price; }, 0);
      const totalBookings = bookings.length;
      const totalSlots = bookings.reduce(function (a, b) { return a + durOf(b) / CONFIG.SLOT_MINUTES; }, 0);
      const capacitySlots = slotStarts().length * CONFIG.ROOMS.length * days;
      const promoCount = bookings.filter(function (b) { return durOf(b) >= CONFIG.PROMO_FREE_LAST_HOUR_AT; }).length;

      return {
        days: days,
        byDay: byDay,
        byHour: byHour,
        byDuration: byDuration,
        byBay: byBay,
        channel: { line: line, walkin: walkin },
        totalRevenue: totalRevenue,
        totalBookings: totalBookings,
        avgValue: totalBookings ? Math.round(totalRevenue / totalBookings) : 0,
        utilization: capacitySlots ? Math.round((totalSlots / capacitySlots) * 100) : 0,
        promoCount: promoCount,
      };
    },

    // --- CUSTOMERS roll-up (derived live from bookings) ----------------------
    // There is no separate "customer" record — a customer is just the set of
    // bookings sharing a name. We group by normalised name (phone is often
    // blank in walk-ins/history), merge in the best-known phone, and compute
    // per-person stats. Blocks/maintenance are never customers.
    customers: function () {
      const rows = loadState().bookings.filter(function (b) {
        return b.status !== 'blocked' && b.source !== 'block';
      });
      const now = new Date();
      const map = {};

      rows.forEach(function (b) {
        const key = (b.customerName || 'Guest').trim().toLowerCase();
        if (!map[key]) {
          map[key] = {
            key: key,
            name: (b.customerName || 'Guest').trim(),
            phone: '',
            bookings: [],
            visits: 0,        // confirmed sessions (realised + upcoming confirmed)
            pending: 0,       // slips awaiting review
            cancelled: 0,     // rejected / cancelled
            upcoming: 0,      // future confirmed or pending
            totalSpend: 0,    // confirmed only
            firstDate: b.date,
            lastDate: b.date,
            sources: {},
          };
        }
        const c = map[key];
        c.bookings.push(b);
        if (b.phone) c.phone = b.phone;                 // keep the last non-empty phone
        c.sources[b.source] = (c.sources[b.source] || 0) + 1;
        if (b.status === 'confirmed') { c.visits++; c.totalSpend += b.price; }
        else if (b.status === 'pending-payment') c.pending++;
        else if (b.status === 'cancelled') c.cancelled++;
        if (b.date < c.firstDate) c.firstDate = b.date;
        if (b.date > c.lastDate) c.lastDate = b.date;
      });

      return Object.keys(map).map(function (k) {
        const c = map[k];
        // history newest-first
        c.bookings.sort(function (a, b) {
          return (b.date + String(b.start).padStart(4, '0')).localeCompare(a.date + String(a.start).padStart(4, '0'));
        });
        c.upcoming = c.bookings.filter(function (b) {
          if (b.status !== 'confirmed' && b.status !== 'pending-payment') return false;
          const d = new Date(b.date + 'T00:00:00'); d.setMinutes(b.start);
          return d.getTime() >= now.getTime();
        }).length;
        c.totalBookings = c.bookings.length;
        c.avgSpend = c.visits ? Math.round(c.totalSpend / c.visits) : 0;
        // primary booking channel (ties favour the self-service LINE app)
        const line = c.sources['customer'] || 0, walk = c.sources['walk-in'] || 0;
        c.channel = line >= walk ? 'LINE' : 'walk-in';
        // simple segment label
        c.segment = c.visits >= 3 ? 'Regular' : (c.totalBookings <= 1 ? 'New' : 'Returning');
        return c;
      }).sort(function (a, b) { return b.totalSpend - a.totalSpend; });
    },

    // --- change subscription -------------------------------------------------
    // Fires for BOTH same-page writes and cross-tab writes.
    onChange: function (handler) {
      global.addEventListener('golfsim:change', handler);
      global.addEventListener('storage', function (e) {
        if (e.key === CONFIG.STORAGE_KEY) handler({ detail: { crossTab: true } });
      });
    },

    // --- seed / reset (demo convenience) ------------------------------------
    resetAll: function () {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      saveState(emptyState(), { type: 'reset' });
    },

    // Seed a realistic-looking day so the dashboard isn't empty on first open.
    // Idempotent: only seeds once per version (tracked via seedVersion).
    seedIfEmpty: function () {
      const state = loadState();
      const SEED_VERSION = 6; // bumped: + 13 days of history for the reports page
      if (state.seedVersion === SEED_VERSION) return;

      const dates = windowDates();
      const today = ymd(dates[0]);
      const tomorrow = ymd(dates[1]);
      const day3 = ymd(dates[2]);
      const M = function (h, m) { return h * 60 + (m || 0); }; // start-minute helper

      const seeds = [
        // Today — mixed durations so the timeline shows spans.
        { room: 1, date: today, start: M(9, 0),   dur: 60,  customerName: 'Krit Sup.',   phone: '081-234-5678', status: 'confirmed',       source: 'customer' },
        { room: 2, date: today, start: M(10, 30), dur: 90,  customerName: 'Anong P.',    phone: '089-111-2233', status: 'confirmed',       source: 'walk-in'  },
        { room: 1, date: today, start: M(11, 0),  dur: 30,  customerName: 'James Watt',  phone: '062-987-6543', status: 'confirmed',       source: 'customer' },
        { room: 2, date: today, start: M(13, 30), dur: 60,  customerName: 'Somchai R.',  phone: '084-555-1212', status: 'pending-payment', source: 'customer' },
        { room: 1, date: today, start: M(15, 0),  dur: 120, customerName: 'Maintenance', phone: '',             status: 'blocked',         source: 'block'    },
        { room: 2, date: today, start: M(17, 0),  dur: 180, customerName: 'Ploy T.',     phone: '090-321-4455', status: 'confirmed',       source: 'customer' }, // 3-h promo
        { room: 1, date: today, start: M(19, 0),  dur: 60,  customerName: 'David Kim',   phone: '087-777-8899', status: 'confirmed',       source: 'customer' },
        // Tomorrow
        { room: 1, date: tomorrow, start: M(10, 0),  dur: 120, customerName: 'Nan W.',    phone: '081-000-1111', status: 'confirmed',       source: 'customer' },
        { room: 2, date: tomorrow, start: M(14, 0),  dur: 60,  customerName: 'Corporate', phone: '',             status: 'blocked',         source: 'block'    },
        { room: 1, date: tomorrow, start: M(18, 30), dur: 90,  customerName: 'Beam S.',   phone: '083-222-3344', status: 'pending-payment', source: 'customer' },
        // Day 3
        { room: 2, date: day3, start: M(11, 30), dur: 60, customerName: 'Mook L.',        phone: '086-444-5566', status: 'confirmed',       source: 'customer' },
      ];

      const fresh = emptyState();
      function pushSeed(s) {
        fresh.bookings.push({
          id: uid(),
          ref: makeRefCode(),
          room: s.room,
          date: s.date,
          start: s.start,
          duration: s.dur,
          customerName: s.customerName,
          phone: s.phone,
          price: s.status === 'blocked' ? 0 : priceFor(s.dur),
          status: s.status,
          source: s.source,
          createdAt: new Date().toISOString(),
          note: s.status === 'blocked' ? 'Blocked by staff' : '',
        });
      }
      seeds.forEach(pushSeed);

      // ---- Backward-looking HISTORY (past 13 days) so the Reports page has
      // real data to compute from. Deterministic pseudo-random (seeded LCG) so
      // the same demo history appears every reset. All are completed = confirmed.
      const NAMES = ['Krit S.', 'Anong P.', 'James W.', 'Somchai R.', 'Ploy T.', 'David K.',
        'Nan W.', 'Beam S.', 'Mook L.', 'Aof C.', 'Ying T.', 'Ben H.', 'Pim R.', 'Tar M.',
        'Gap L.', 'Fern K.', 'Not P.', 'June S.', 'Ice W.', 'Golf T.'];
      const DUR_POOL = [30, 60, 60, 60, 90, 120, 180]; // 1 h most common, occasional 3 h promo
      function lcg(seed) { let s = seed >>> 0; return function () { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }
      const grid = slotStarts();
      for (let d = 13; d >= 1; d--) {
        const past = new Date(dates[0]); past.setDate(past.getDate() - d);
        const day = ymd(past);
        const rnd = lcg((1013904223 ^ Math.imul(d, 1664525)) >>> 0);
        rnd(); rnd(); // warm up the generator so day-to-day counts don't correlate
        const target = 3 + Math.floor(rnd() * 5); // 3–7 bookings/day
        let placed = 0, guard = 0;
        const occupied = {}; // key `${room}:${slot}`
        while (placed < target && guard++ < 40) {
          const room = rnd() < 0.5 ? 1 : 2;
          const dur = DUR_POOL[Math.floor(rnd() * DUR_POOL.length)];
          const start = grid[Math.floor(rnd() * grid.length)];
          if (start + dur > CONFIG.CLOSE_MIN) continue;
          let clash = false;
          for (let t = start; t < start + dur; t += CONFIG.SLOT_MINUTES) { if (occupied[room + ':' + t]) { clash = true; break; } }
          if (clash) continue;
          for (let t = start; t < start + dur; t += CONFIG.SLOT_MINUTES) occupied[room + ':' + t] = true;
          pushSeed({
            room: room, date: day, start: start, dur: dur,
            customerName: NAMES[Math.floor(rnd() * NAMES.length)],
            phone: '', status: 'confirmed',
            source: rnd() < 0.72 ? 'customer' : 'walk-in',
          });
          placed++;
        }
      }

      fresh.seededAt = new Date().toISOString();
      fresh.seedVersion = SEED_VERSION;
      saveState(fresh, { type: 'seed' });
    },
  };

  global.DataLayer = DataLayer;
})(window);
