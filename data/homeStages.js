// homeStages.js — what Home shows above This week (UI Redesign plan D28, Phase 2): where each
// open litter or planned pairing is (its stage), the line of stage pills under Today, and the
// six tiles: up to three that follow the stages, then the steady ones (her website while one
// is linked, then Sales, Financials and People until program types choose them).
//
// Read from her records each time Home opens, never stored. Pure: pages/today.js loads the
// records and passes them in, so tests drive every rule. A tile only opens a screen that is
// built (D37); a stage tile with nowhere to go yet isn't drawn, and its slot falls back to a
// steady tile. Tiles never repeat a tab (tabs carry their own counts).

// The prototype's HOME_STAGES: [label, pill tone], and STAGE_RANK: most urgent first.
export const HOME_STAGES = {
  between: ['Between litters', 'gray'],
  planning: ['Planning', 'blue'],
  expecting: ['Expecting', 'blue'],
  newborns: ['Newborns', 'green'],
  picks: ['Picks open', 'amber'],
  gohome: ['Going home', 'amber'],
  after: ['After go-home', 'gray'],
};
export const STAGE_RANK = ['gohome', 'picks', 'newborns', 'expecting', 'planning', 'between', 'after'];

// Pups are newborns for their first three weeks (D28's table).
export const NEWBORN_DAYS = 21;
// A litter whelped longer ago than this is past its stages (one nobody closed), unless a
// pup still has a go-home date coming.
export const STAGE_MAX_DAYS = 26 * 7;
export const GESTATION_DAYS = 63;
const SOLD_STATUSES = ['deposit_paid', 'paid_in_full', 'delivered'];
const OPEN_SALE_STATUSES = ['deposit_pending', 'deposit_paid', 'paid_in_full'];

const ymd = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const utc = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
/** Whole days from a to b (YYYY-MM-DD). */
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Nov 25" */
export const shortDate = (d) => (ymd(d) ? `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}` : '');
/** "Wed Nov 25" */
export const dayDate = (d) => (ymd(d) ? `${WEEKDAYS[new Date(utc(d)).getUTCDay()]} ${shortDate(d)}` : '');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Willow × Ash": a litter's or pairing's dam and sire, by call name. */
export function pairName(rec, dogsById) {
  const n = (id) => dogsById.get(id)?.call_name || '—';
  return `${n(rec?.dam_id)} × ${n(rec?.sire_id)}`;
}

/**
 * One litter's stage, or null for a closed or archived one.
 *   pups      its puppies (not archived)
 *   pickups   go-home (placement) events dated today or later, for any dog
 *   waitlist  whether the waitlist is on: with it, picks open on `picks_opened_date`;
 *             without it, pups past three weeks are simply for sale (the prototype's default)
 */
export function litterStage(litter, { pups = [], pickups = [], today, waitlist = true }) {
  if (!litter || litter.is_archived || litter.status === 'closed') return null;
  const whelp = ymd(litter.whelp_date);
  if (litter.status === 'expected' || !whelp || whelp > today) return 'expecting';
  const ids = new Set(pups.map((p) => p.id));
  if (pickups.some((e) => e.subject_type === 'dog' && ids.has(e.subject_id))) return 'gohome';
  if (daysBetween(whelp, today) > STAGE_MAX_DAYS) return null;
  const settled = pups.length && pups.every((p) => p.status !== 'puppy' || ['placed', 'keeping'].includes(p.disposition));
  if (settled || litter.status === 'sold') return 'after';
  if (daysBetween(whelp, today) < NEWBORN_DAYS) return 'newborns';
  if (!waitlist || ymd(litter.picks_opened_date)) return 'picks';
  return 'newborns';
}

/**
 * Every open litter's and pairing's stage, most urgent first; "Between litters" when there
 * are none. → [{ k, who, litter?, pairing? }]
 */
export function kennelStages({ litters = [], pairings = [], dogs = [], pickups = [], today, waitlist = true }) {
  const dogsById = new Map(dogs.map((d) => [d.id, d]));
  const out = [];
  const withLitter = new Set();
  for (const l of litters) {
    if (l.pairing_id) withLitter.add(l.pairing_id);
    const pups = dogs.filter((d) => d.litter_id === l.id && !d.is_archived);
    const k = litterStage(l, { pups, pickups, today, waitlist });
    if (k) out.push({ k, who: pairName(l, dogsById), litter: l });
  }
  for (const p of pairings) {
    if (p.is_archived || withLitter.has(p.id)) continue;
    if (p.status === 'planned') out.push({ k: 'planning', who: pairName(p, dogsById), pairing: p });
    else if (['bred', 'confirmed_pregnant'].includes(p.status)) out.push({ k: 'expecting', who: pairName(p, dogsById), pairing: p });
  }
  if (!out.length) return [{ k: 'between', who: '' }];
  return out.sort((a, b) => STAGE_RANK.indexOf(a.k) - STAGE_RANK.indexOf(b.k));
}

/** The pills under Today: "Willow × Ash · Picks open". → [{ label, tone }] */
export const stagePills = (stages) => stages.map((s) => ({ label: `${s.who ? `${s.who} · ` : ''}${HOME_STAGES[s.k][0]}`, tone: HOME_STAGES[s.k][1] }));

// --- the tiles ---------------------------------------------------------------------------
// A tile: { key, icon, title, sub, href } (href relative to pages/).

/**
 * A stage's tiles, from what she has on record for those litters and pairings. Two litters
 * at one stage share a tile ("Picks · 2 litters").
 *   ctx: { today, dogs, sales, events (weights and pickups from the pups), contractsToSign,
 *          flags (editionFlags), balanceDue(sale) → number, money(n) → text }
 */
export function stageTiles(k, entries, ctx) {
  const { today, dogs = [], sales = [], events = [], flags = {}, contractsToSign = 0 } = ctx;
  const dogsById = new Map(dogs.map((d) => [d.id, d]));
  const one = entries.length === 1 ? entries[0] : null;
  const many = (title) => `${title} · ${plural(entries.length, 'litter')}`;
  const pupsOf = (l) => dogs.filter((d) => d.litter_id === l.id && !d.is_archived);
  const litterHref = (l) => `litter.html?id=${encodeURIComponent(l.id)}`;
  const lits = entries.map((e) => e.litter).filter(Boolean);
  const pups = lits.flatMap(pupsOf);
  const pupIds = new Set(pups.map((p) => p.id));
  const out = [];
  if (k === 'planning') {
    // The dam's heat log: her page, where heats and progesterone are logged.
    const p = one?.pairing;
    if (p) {
      const dam = dogsById.get(p.dam_id);
      out.push({ key: 'heat', icon: 'flame', title: 'Heat log', sub: `${dam?.call_name || '—'}${ymd(p.planned_date) ? ` · planned ${shortDate(p.planned_date)}` : ''}`, href: `dog.html?id=${encodeURIComponent(p.dam_id)}` });
    } else {
      out.push({ key: 'heat', icon: 'flame', title: 'Heat log', sub: plural(entries.length, 'pairing') + ' planned', href: 'pairings.html' });
    }
  } else if (k === 'expecting') {
    const e = one;
    if (e) {
      const rec = e.litter || e.pairing;
      const pairing = e.pairing;
      const due = ymd(e.litter?.whelp_date) || ymd(pairing?.expected_due_date);
      const bred = ymd(pairing?.planned_date);
      const day = bred ? daysBetween(bred, today) : null;
      const dam = dogsById.get(rec.dam_id)?.call_name || '—';
      out.push({
        key: 'countdown', icon: 'baby',
        title: day != null && day >= 0 && day <= GESTATION_DAYS + 7 ? `Day ${day} of ${GESTATION_DAYS}` : 'Expecting',
        sub: `${dam}${due ? ` · due ${shortDate(due)}` : ''}`,
        href: e.litter ? litterHref(e.litter) : `pairing.html?id=${encodeURIComponent(pairing.id)}`,
      });
    } else {
      out.push({ key: 'countdown', icon: 'baby', title: 'Expecting', sub: plural(entries.length, 'litter'), href: 'breeding.html' });
    }
  } else if (k === 'newborns') {
    const weighed = events.filter((ev) => ev.event_type === 'weight_check' && ev.subject_type === 'dog' && pupIds.has(ev.subject_id) && ymd(ev.event_date) && ev.event_date <= today)
      .map((ev) => ev.event_date).sort().pop();
    out.push({ key: 'weigh', icon: 'scale', title: one ? 'Weigh puppies' : many('Weigh puppies'), sub: weighed ? `Last weighed ${shortDate(weighed)}` : 'No weights yet', href: one ? litterHref(one.litter) : 'litters.html' });
    if (one) out.push({ key: 'births', icon: 'baby', title: 'Births', sub: `${plural(pups.length, 'pup')} on record`, href: litterHref(one.litter) });
  } else if (k === 'picks') {
    if (flags.waitlist && lits.some((l) => ymd(l.picks_opened_date))) {
      const opened = lits.map((l) => ymd(l.picks_opened_date)).filter(Boolean).sort()[0];
      out.push({ key: 'picks', icon: 'list-ordered', title: one ? 'Picks' : many('Picks'), sub: `Opened ${shortDate(opened)}`, href: 'waitlist.html' });
    }
    const offered = pups.filter((p) => ['available', 'placed'].includes(p.disposition));
    const inHand = offered.filter((p) => sales.some((s) => s.dog_id === p.id && SOLD_STATUSES.includes(s.status))).length;
    if (offered.length) out.push({ key: 'deposits', icon: 'wallet', title: 'Deposits', sub: `${inHand} of ${offered.length} in`, href: 'sales.html' });
  } else if (k === 'gohome') {
    const pickups = events.filter((ev) => ev.event_type === 'placement' && ev.subject_type === 'dog' && pupIds.has(ev.subject_id) && ymd(ev.event_date) >= today);
    const first = pickups.map((ev) => ev.event_date).sort()[0];
    const going = new Set(pickups.map((ev) => ev.subject_id)).size;
    out.push({ key: 'gohome', icon: 'car', title: one ? 'Go-home' : many('Go-home'), sub: `${dayDate(first)} · ${plural(going, 'pup')}`, href: one ? litterHref(one.litter) : 'scheduled-placements.html' });
    const owing = sales.filter((s) => pupIds.has(s.dog_id) && OPEN_SALE_STATUSES.includes(s.status))
      .map((s) => ({ s, due: Number(ctx.balanceDue?.(s)) || 0 })).filter((x) => x.due > 0);
    if (owing.length) {
      const total = owing.reduce((t, x) => t + x.due, 0);
      const fams = new Set(owing.map((x) => x.s.buyer_contact_id)).size;
      out.push({ key: 'balances', icon: 'wallet', title: 'Balances due', sub: `${ctx.money ? ctx.money(total) : total} · ${plural(fams, 'family', 'families')}`, href: 'sales.html' });
    }
    if (flags.contracts && contractsToSign) out.push({ key: 'contracts', icon: 'file-pen-line', title: 'Contracts', sub: `${contractsToSign} to sign`, href: 'contracts.html' });
  } else if (k === 'after') {
    if (flags.reports) out.push({ key: 'litterpl', icon: 'coins', title: 'Litter P&L', sub: one ? one.who : plural(entries.length, 'litter'), href: 'litter-finances-report.html' });
  }
  return out;
}

/**
 * The six tiles: each stage's first tile, most urgent stage first, then each one's second,
 * up to three; then the steady tiles, none repeating a title or a tab.
 *   stages   kennelStages()
 *   ctx      stageTiles()'s ctx
 *   steady   the steady tiles in order (Website first while a site is linked)
 *   tabs     the tab keys the shell shows
 */
export function homeTiles({ stages, ctx, steady = [], tabs = [] }) {
  const byStage = new Map();
  for (const s of stages) { if (!byStage.has(s.k)) byStage.set(s.k, []); byStage.get(s.k).push(s); }
  const per = [...byStage.entries()].map(([k, list]) => stageTiles(k, list, ctx));
  const seen = new Set();
  const out = [];
  for (let i = 0; out.length < 3 && per.some((l) => l[i]); i++) {
    for (const l of per) {
      const t = l[i];
      if (t && !seen.has(t.title) && out.length < 3) { seen.add(t.title); out.push(t); }
    }
  }
  for (const t of steady) {
    if (out.length >= 6) break;
    if (seen.has(t.title) || tabs.includes(t.key)) continue;
    seen.add(t.title);
    out.push(t);
  }
  return out;
}

// --- This week and Coming up -------------------------------------------------------------
export const WEEK_DAYS = 7;

// A row's icon by event type (Lucide names the prototype uses).
const EVENT_ICON = {
  vaccination: 'syringe', preventative: 'syringe', medication: 'syringe', vet_visit: 'stethoscope', surgery: 'stethoscope',
  illness: 'stethoscope', injury: 'stethoscope', screening_test: 'stethoscope', genetic_test: 'stethoscope', ofa_pennhip: 'stethoscope',
  breed_specific_test: 'stethoscope', heat_cycle: 'flame', progesterone_test: 'flame', breeding_tie: 'heart-handshake',
  ultrasound: 'scan-line', pregnancy_update: 'baby', whelping_summary: 'baby', weight_check: 'scale', placement: 'car',
  boarding: 'house', show: 'trophy', title_earned: 'trophy', milestone: 'paw-print',
};
export const eventIcon = (type) => EVENT_ICON[type] || 'calendar-check';

/**
 * This week's and Coming up's rows.
 *   reminders  pending reminders (eventRepo.getReminders), in scope
 *   upcoming   dated events from today on (eventRepo.getUpcoming), in scope
 *   away       dogs away from home (awayBoard.getAwayBoardRows)
 *   label(ev)  the event's subject in words ("Wren", "Willow × Ash")
 *   typeLabel(type)  the event type's label
 * → { week: [row], later: [row] }, a row being { icon, tone, title, sub, pill?, href, date }:
 *   week has overdue reminders and anything dated in the next seven days, soonest first;
 *   later has the dogs away, then what's dated after that.
 */
export function agendaRows({ reminders = [], upcoming = [], away = [], today, label, typeLabel, dogName }) {
  const weekEnd = addDays(today, WEEK_DAYS - 1);
  const week = [];
  const later = [];
  const seen = new Set();
  for (const ev of reminders) {
    const d = ymd(ev.reminder_date);
    if (!d || d > weekEnd) continue;
    seen.add(ev.id);
    const over = d < today;
    week.push({
      key: `r:${ev.id}`, icon: eventIcon(ev.event_type), tone: over ? 'red' : 'amber', date: d,
      title: `${label(ev)} · ${ev.title || typeLabel(ev.event_type)}`,
      sub: over ? `Was due ${dayDate(d)}` : d === today ? 'Today' : dayDate(d),
      pill: over ? { label: 'Overdue', tone: 'red' } : null,
      href: subjectHref(ev),
    });
  }
  for (const ev of upcoming) {
    if (seen.has(ev.id)) continue;
    const d = ymd(ev.event_date);
    if (!d || d < today) continue;
    const row = {
      key: `e:${ev.id}`, icon: eventIcon(ev.event_type), tone: d <= weekEnd ? 'blue' : '', date: d,
      title: `${label(ev)} · ${ev.title || typeLabel(ev.event_type)}`,
      sub: d === today ? 'Today' : dayDate(d),
      href: subjectHref(ev, `&openEvent=${encodeURIComponent(ev.id)}`),
    };
    (d <= weekEnd ? week : later).push(row);
  }
  week.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const awayRows = away.map((r) => ({
    key: `a:${r.sourceId}`, icon: 'house', tone: '', date: r.returnDate || '',
    title: `${dogName(r.dogId)} · away`,
    sub: [r.reason, r.location, r.returnDate ? `back ${dayDate(r.returnDate)}` : 'no return date'].filter(Boolean).join(' · '),
    href: r.href,
  }));
  return { week, later: [...awayRows, ...later] };
}

function addDays(d, n) {
  const t = new Date(utc(d) + n * 864e5);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** An event's subject page (pages/), with an optional query fragment. */
export function subjectHref(ev, extra = '') {
  const id = encodeURIComponent(ev.subject_id);
  if (ev.subject_type === 'dog') return `dog.html?id=${id}${extra}`;
  if (ev.subject_type === 'pairing') return `pairing.html?id=${id}${extra}`;
  return `litter.html?id=${id}${extra}`;
}

// --- Needs you ---------------------------------------------------------------------------
// A nudge's row icon and tone, by the kind its key starts with.
const NUDGE_LOOK = [
  [/^(payment-missed|sale-deposit-overdue|waitlist-fee-overdue|waitlist-side-overdue|waitlist-offer-overdue|gohome-overdue|litteroverdue|pairingoverdue)/, 'circle-alert', 'red'],
  [/^(payment-due|extra-due|sale-)/, 'wallet', 'amber'],
  [/^(gohome|training-stay)/, 'car', 'amber'],
  [/^heatwatch/, 'flame', 'amber'],
  [/^(pairing|litter|deceased-pairing)/, 'paw-print', 'blue'],
  [/^(studstatus|studboard|studpick)/, 'concierge-bell', 'blue'],
  [/^waitlist-applications/, 'inbox', 'violet'],
  [/^(waitlist-messages|waitlist-.*-request|waitlist-back-out|portal-fact)/, 'message-square-text', 'blue'],
  [/^waitlist-open-picks/, 'list-ordered', 'blue'],
  [/^waitlist/, 'list-ordered', 'amber'],
  [/^(follow-up)/, 'heart', 'blue'],
  [/^(show-title)/, 'trophy', 'blue'],
  [/^(int-review|pup-two-sales)/, 'triangle-alert', 'amber'],
];
/** → { icon, tone } for a nudge key. */
export function nudgeLook(key) {
  const hit = NUDGE_LOOK.find(([re]) => re.test(String(key || '')));
  return hit ? { icon: hit[1], tone: hit[2] } : { icon: 'bell-ring', tone: '' };
}
