// searchIndex.js — what search looks through (UI Redesign plan §1 "Search", Phase 2; the
// prototype's searchIndex / S.search): screens, dogs, litters and pairings, waitlist
// families, people, sales, stud services and contracts, history events, documents, money,
// settings and reports, each as { group, icon, title, sub, href } (href relative to pages/).
//
// Pure: pages/search.js loads the records (in the active kennel's scope) and passes them in.
// A group whose feature is off in this edition is left out, and so is any screen the shell
// doesn't offer (shellNav.isOffered), so a result never leads to a page that isn't there.
// Every word typed must match the title, subline or group; matches are highlighted.
import { shellTabs, hubRows, BUSINESS_ROWS, MORE_ROWS, isOffered } from './shellNav.js';
import { REPORTS } from './reportCatalog.js';
import { KENNEL_SECTIONS } from './kennelSections.js';
import {
  descriptor, DOG_STATUS, DISPOSITION, LITTER_STATUS, PAIRING_STATUS, SALE_STATUS, WAITLIST_ENTRY_STATUS,
  EVENT_TYPES, DOC_TYPES, EXPENSE_CATEGORIES, CONTRACT_STATUS, CONTRACT_TYPE, STUD_SERVICE_STATUS, CONTACT_TYPE,
} from './vocab.js';

// The prototype's SEARCH_GROUPS, in its order.
export const SEARCH_GROUPS = ['Go to', 'Dogs', 'Litters', 'Waitlist', 'People', 'Sales', 'History', 'Documents', 'Money', 'Settings', 'Reports'];
// Results shown per group before "Show all".
export const GROUP_LIMIT = 5;
// Recent searches kept on this device.
export const RECENT_MAX = 5;

const label = (vocab, v) => (v ? descriptor(vocab, v).label : '');
const page = (path) => String(path || '').replace(/^pages\//, '');
const join = (...parts) => parts.filter(Boolean).join(' · ');
const id = (v) => encodeURIComponent(v);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const date = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}, ${d.slice(0, 4)}` : '');
const money = (n) => (n == null || n === '' || !Number.isFinite(Number(n)) ? '' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

// Screens beyond the tabs and the hubs' rows, where the shell offers them.
const MORE_SCREENS = [
  { icon: 'bell-ring', label: 'Reminders', sub: 'Everything you set a reminder for', path: 'pages/reminders.html' },
  { icon: 'calendar-days', label: 'Coming up', sub: 'Everything dated from today on', path: 'pages/upcoming.html' },
  { icon: 'calendar-days', label: 'Calendar', sub: 'A month at a time', path: 'pages/calendar.html' },
  { icon: 'house', label: 'Away from home', sub: 'Dogs boarding or away', path: 'pages/board.html' },
  { icon: 'heart-handshake', label: 'Pairings', sub: 'Planned and past pairings', path: 'pages/pairings.html' },
  { icon: 'paw-print', label: 'Active breeding', sub: 'Heats, breedings and pregnancies now', path: 'pages/active-breeding.html' },
  { icon: 'house', label: 'Kennels', sub: 'Your kennels and outside kennels', path: 'pages/kennels.html', flag: 'multiKennel' },
];

// Setup's places on the Settings page (its sections' anchors).
const SETTINGS_PLACES = [
  { icon: 'settings', label: 'Your kennel', sub: 'Kennel name, prefix and setup', path: 'pages/settings.html#kennel-setup-section' },
  { icon: 'settings', label: 'Guided tour', sub: 'Take the tour again', path: 'pages/settings.html#tour-section' },
];

/**
 * Every entry search can find.
 *   recs:   { dogs, litters, pairings, entries, contacts, sales, studServices, contracts,
 *             events, documents, expenses, kennels } (each optional)
 *   flags:  editionFlags; hidden: editionConfig.shellHiddenPages
 */
export function buildIndex(recs = {}, { flags = {}, hidden = [] } = {}) {
  const out = [];
  const add = (group, icon, title, sub, href) => { if (title) out.push({ group, icon, title: String(title), sub: String(sub || ''), href }); };
  const dogs = recs.dogs || [];
  const contacts = recs.contacts || [];
  const dogsById = new Map(dogs.map((d) => [d.id, d]));
  const contactsById = new Map(contacts.map((c) => [c.id, c]));
  const dogName = (did) => dogsById.get(did)?.call_name || '';
  const personName = (cid) => contactsById.get(cid)?.name || '';
  const pair = (r) => `${dogName(r.dam_id) || '—'} × ${dogName(r.sire_id) || '—'}`;
  const littersById = new Map((recs.litters || []).map((l) => [l.id, l]));
  const pairingsById = new Map((recs.pairings || []).map((p) => [p.id, p]));
  const offered = (item) => isOffered(item, flags, hidden);

  // Go to: the tabs, the hubs' rows, then the other screens.
  for (const t of shellTabs(flags, hidden)) add('Go to', t.icon, t.label, 'Tab', page(t.path));
  for (const r of [...hubRows(BUSINESS_ROWS, flags, hidden), ...hubRows(MORE_ROWS, flags, hidden)].flat()) add('Go to', r.icon, r.label, r.sub, page(r.path));
  for (const s of MORE_SCREENS) if (offered(s)) add('Go to', s.icon, s.label, s.sub, page(s.path));

  for (const d of dogs) {
    add('Dogs', 'dog', d.call_name, join(label(DOG_STATUS, d.status), d.status === 'puppy' && label(DISPOSITION, d.disposition), d.registered_name, d.breed), `dog.html?id=${id(d.id)}`);
  }
  for (const l of recs.litters || []) {
    add('Litters', 'paw-print', l.nickname ? `${l.nickname} (${pair(l)})` : pair(l), join(label(LITTER_STATUS, l.status), date(l.whelp_date)), `litter.html?id=${id(l.id)}`);
  }
  for (const p of recs.pairings || []) {
    add('Litters', 'heart-handshake', `Pairing: ${pair(p)}`, join(label(PAIRING_STATUS, p.status), date(p.planned_date)), `pairing.html?id=${id(p.id)}`);
  }
  if (flags.waitlist && offered({ path: 'pages/waitlist-entry.html' })) {
    for (const e of recs.entries || []) {
      const c = contactsById.get(e.contact_id);
      const name = c?.name || e.application?.name || '';
      add('Waitlist', 'list-ordered', name, join(label(WAITLIST_ENTRY_STATUS, e.status), c?.email, c?.phone), `waitlist-entry.html?id=${id(e.id)}`);
    }
  }
  if (flags.contactsSection && offered({ path: 'pages/contact.html' })) {
    for (const c of contacts) add('People', 'user-round', c.name, join((c.contact_type || []).map((t) => label(CONTACT_TYPE, t)).join(', '), c.email, c.phone), `contact.html?id=${id(c.id)}`);
  }
  for (const s of recs.sales || []) {
    add('Sales', 'tag', `${dogName(s.dog_id) || 'A pup'} → ${personName(s.buyer_contact_id) || 'buyer'}`, join(label(SALE_STATUS, s.status), money(s.price), date(s.sale_date)), `sale.html?id=${id(s.id)}`);
  }
  if (flags.studServices) {
    for (const s of recs.studServices || []) {
      add('Sales', 'concierge-bell', `Stud service: ${dogName(s.our_dog_id) || '—'} · ${dogName(s.partner_dog_id) || personName(s.partner_contact_id) || 'partner'}`, join(label(STUD_SERVICE_STATUS, s.status), personName(s.partner_contact_id)), `stud-service.html?id=${id(s.id)}`);
    }
  }
  if (flags.contracts) {
    for (const c of recs.contracts || []) {
      const who = personName(c.related_contact_id) || dogName(c.related_dog_id);
      add('Sales', 'file-pen-line', `${label(CONTRACT_TYPE, c.contract_type) || 'Contract'}${who ? `: ${who}` : ''}`, join(label(CONTRACT_STATUS, c.status), who, date(c.signed_date)), `contract.html?id=${id(c.id)}`);
    }
  }
  for (const ev of recs.events || []) {
    const subj = ev.subject_type === 'dog' ? dogName(ev.subject_id)
      : ev.subject_type === 'pairing' ? (pairingsById.get(ev.subject_id) ? pair(pairingsById.get(ev.subject_id)) : '')
        : (littersById.get(ev.subject_id) ? pair(littersById.get(ev.subject_id)) : '');
    const href = `${ev.subject_type === 'dog' ? 'dog' : ev.subject_type === 'pairing' ? 'pairing' : 'litter'}.html?id=${id(ev.subject_id)}&openEvent=${id(ev.id)}`;
    const kind = label(EVENT_TYPES, ev.event_type);
    add('History', 'calendar-check', `${kind}${ev.title && ev.title.trim().toLowerCase() !== kind.toLowerCase() ? `: ${ev.title}` : ''}`, join(subj, date(ev.event_date)), href);
  }
  if (flags.documents && offered({ path: 'pages/documents.html' })) {
    for (const d of recs.documents || []) {
      add('Documents', 'file-text', d.title || label(DOC_TYPES, d.doc_type), join(label(DOC_TYPES, d.doc_type), dogName(d.dog_id), date(d.doc_date), d.issuer_or_lab, d.result), `documents.html?dog=${id(d.dog_id)}`);
    }
  }
  for (const x of recs.expenses || []) {
    add('Money', 'arrow-up-right', join(label(EXPENSE_CATEGORIES, x.category), x.vendor) || 'Expense', join(date(x.expense_date), money(x.amount), x.notes), 'financials.html?view=expenses');
  }
  for (const s of SETTINGS_PLACES) if (offered(s)) add('Settings', s.icon, s.label, s.sub, page(s.path));
  if (offered({ path: 'pages/kennel.html', flag: 'multiKennel' })) {
    const own = (recs.kennels || []).filter((k) => k.is_own_kennel && !k.is_archived);
    for (const k of own) {
      for (const s of KENNEL_SECTIONS.filter((x) => x.when(k))) {
        add('Settings', 'settings', s.label, own.length > 1 ? k.kennel_name : 'Your kennel', `kennel.html?id=${id(k.id)}#${s.key}`);
      }
    }
  }
  if (flags.reports && offered({ path: 'pages/reports.html' })) {
    for (const r of REPORTS) add('Reports', 'chart-column', r.title, r.blurb, r.href);
  }
  return out;
}

/** The words of a search, lower case. */
export const words = (q) => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);

/** Entries every word matches, by group in SEARCH_GROUPS order. → [{ group, hits }] */
export function search(index, q) {
  const w = words(q);
  if (!w.length) return [];
  const hits = index.filter((r) => { const t = `${r.title} ${r.sub} ${r.group}`.toLowerCase(); return w.every((x) => t.includes(x)); });
  return SEARCH_GROUPS.map((group) => ({ group, hits: hits.filter((r) => r.group === group) })).filter((g) => g.hits.length);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Escaped text with each matching word in <mark>. */
export function highlight(text, w) {
  const s = String(text ?? '');
  if (!w.length) return esc(s);
  const lower = s.toLowerCase();
  const marks = new Array(s.length).fill(false);
  for (const x of w) {
    for (let i = lower.indexOf(x); i >= 0; i = lower.indexOf(x, i + 1)) for (let j = i; j < i + x.length; j++) marks[j] = true;
  }
  let out = '';
  let open = false;
  for (let i = 0; i < s.length; i++) {
    if (marks[i] && !open) { out += '<mark>'; open = true; }
    if (!marks[i] && open) { out += '</mark>'; open = false; }
    out += esc(s[i]);
  }
  return open ? `${out}</mark>` : out;
}

/** Recent searches with a new one on top, at most RECENT_MAX, no repeats. */
export function addRecent(list, term) {
  const t = String(term || '').trim();
  if (!t) return list || [];
  return [t, ...(list || []).filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
}
