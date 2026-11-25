// shellNav.js — what the shell offers (UI Redesign plan Phase 1): the six tabs, the rows of
// the Business and More hubs, and which tab each page belongs to. nav.js draws them;
// pages/business.js and pages/more.js list the rows.
//
// Edition-agnostic: a tab or row with a `flag` shows only when that editionFlags gate is on
// (Lite turns the Pro-only ones off), and a page in editionConfig.shellHiddenPages (the
// Demo leaves out Settings and Import / Export) never shows. Paths are app-root-relative,
// like the rest of the app's links; nav.js prefixes them for the page they're drawn on.
import { editionFlags, shellHiddenPages } from './editionConfig.js';

// [key, label, icon, path, flag]: the prototype's TAB_DEF, in its order.
export const TABS = [
  { key: 'home', label: 'Home', icon: 'house', path: 'pages/today.html' },
  { key: 'waitlist', label: 'Waitlist', icon: 'list-ordered', path: 'pages/waitlist.html', flag: 'waitlist' },
  { key: 'dogs', label: 'Dogs', icon: 'dog', path: 'pages/dogs.html' },
  { key: 'litters', label: 'Litters', icon: 'paw-print', path: 'pages/breeding.html' },
  { key: 'business', label: 'Business', icon: 'briefcase', path: 'pages/business.html' },
  { key: 'more', label: 'More', icon: 'ellipsis', path: 'pages/more.html' },
];

// Setup, at the foot of the desktop rail and as the gear on Home.
export const SETUP_PATH = 'pages/settings.html';

// The hubs' rows, card by card, as the prototype's S.business and S.more draw them. A row
// whose screen isn't built yet (Add-ons, Pricing and schedules, Help from support) isn't
// listed: nothing planned ships (D5). `sub` is the subline; pages/business.js and
// pages/more.js fill in the ones that count records (`count`, `dynamic`).
export const BUSINESS_ROWS = [
  [
    { key: 'sales', icon: 'tag', label: 'Sales & Placements', sub: 'Puppy sales, payments and go-home dates', path: 'pages/sales.html', count: 'sales' },
    { key: 'studs', icon: 'concierge-bell', label: 'Stud Services', sub: 'Outside females bred to your males, and fees', path: 'pages/stud-services.html', flag: 'studServices', count: 'studs' },
    { key: 'contracts', icon: 'file-pen-line', label: 'Contracts', sub: 'Contracts sent, signed and drafted', path: 'pages/contracts.html', flag: 'contracts', dynamic: 'contracts' },
    { key: 'people', icon: 'users', label: 'People', sub: 'Clients, care team, kennels and waitlist families', path: 'pages/contacts.html', flag: 'contactsSection' },
  ],
  [
    { key: 'financials', icon: 'coins', label: 'Financials', sub: 'Income, expenses and net for the year', path: 'pages/financials.html' },
    { key: 'reports', icon: 'chart-column', label: 'Reports', sub: 'Year in review, litter P&L and more', path: 'pages/reports.html', flag: 'reports' },
  ],
  [
    { key: 'accounts', icon: 'landmark', label: 'Accounts', sub: 'Bank, payment and referral accounts', path: 'pages/accounts.html', flag: 'accounts' },
  ],
];

export const MORE_ROWS = [
  [
    { key: 'setup', icon: 'settings', label: 'Setup', sub: 'Your program, waitlist, pricing, devices', path: SETUP_PATH },
  ],
  [
    { key: 'sharing', icon: 'share-2', label: 'Sharing', sub: 'Companion messages, Furever, Assistant, Dog cards', path: 'pages/companion.html', flag: 'companion' },
    { key: 'storage', icon: 'folder', label: 'Storage', sub: 'Documents and shows', path: 'pages/documents.html', flag: 'documents' },
    { key: 'kels', icon: 'sparkles', label: 'Kels', sub: 'Guided help with common jobs', path: 'pages/kels.html' },
  ],
  [
    { key: 'backup', icon: 'cloud', label: 'Backup & Restore', sub: 'No backup yet', path: 'pages/import-export.html#backup-restore', dynamic: 'backup' },
    { key: 'impexp', icon: 'arrow-down-up', label: 'Import / Export', sub: 'CSV import, export, duplicate check', path: 'pages/import-export.html' },
  ],
  [
    { key: 'danger', icon: 'shield-alert', label: 'Danger zone', sub: 'Data totals, reset, or delete', path: 'pages/import-export.html#danger-zone-section', danger: true },
  ],
];

const fileOf = (path) => String(path || '').split('#')[0].split('?')[0].split('/').pop();

/** Whether a path is in this edition's build and its feature is on. */
export function isOffered(item, flags = editionFlags, hidden = shellHiddenPages) {
  if (item.flag && !flags[item.flag]) return false;
  const file = fileOf(item.path);
  return !(hidden || []).some((h) => fileOf(h) === file);
}

export const shellTabs = (flags, hidden) => TABS.filter((t) => isOffered(t, flags, hidden));

/** A hub's cards, each the rows this edition offers; empty cards dropped. */
export const hubRows = (rows, flags, hidden) =>
  rows.map((card) => card.filter((r) => isOffered(r, flags, hidden))).filter((card) => card.length);

// The tab a page belongs to. A page not listed (an import screen, a one-off) takes the tab
// of the screen she came from (nav.js walks back through the history), as the prototype's
// currentTab() does.
const TAB_PAGES = {
  home: ['today', 'dashboard', 'reminders', 'upcoming', 'calendar', 'board', 'scheduled-placements'],
  waitlist: ['waitlist', 'waitlist-entry', 'waitlist-programs', 'waitlist-import', 'waitlist-form', 'waitlist-publish'],
  dogs: ['dogs', 'dog', 'roster', 'pedigree', 'pedigree-import', 'dog-cards', 'dog-import'],
  litters: ['breeding', 'pairings', 'pairing', 'litters', 'litter', 'active-breeding', 'live-births', 'litter-import', 'pairing-import', 'breed-feeding-schedules'],
  business: ['business', 'sales', 'sale', 'sale-import', 'stud-services', 'stud-service', 'stud-service-import', 'contracts', 'contract',
    'contacts', 'contact', 'contact-import', 'do-not-sell', 'financials', 'expense-import', 'reports', 'year-review', 'accounts', 'invoice'],
  more: ['more', 'settings', 'documents', 'shows', 'companion', 'furever', 'assistant', 'import-export', 'import-batch', 'kels',
    'kennels', 'kennel', 'kennel-import', 'kennel-tests-import'],
};
const TAB_OF = Object.fromEntries(Object.entries(TAB_PAGES).flatMap(([tab, pages]) => pages.map((p) => [p, tab])));

/** The tab key for a page path or URL, or null when the page isn't one of a tab's. */
export function tabOf(path) {
  const base = fileOf(path).replace(/\.html$/, '');
  if (TAB_OF[base]) return TAB_OF[base];
  if (/-report$/.test(base)) return 'business';
  return null;
}

/** Where a page is, in her words: "Dogs" for a tab, "Business › People" for a hub's row.
 *  Kels's Finding Something says it ("… in the menu"). */
export function shellPlace(path, flags = editionFlags, hidden = shellHiddenPages) {
  const file = fileOf(path);
  const tab = shellTabs(flags, hidden).find((t) => fileOf(t.path) === file);
  if (tab) return tab.label;
  for (const [hub, rows] of [['Business', BUSINESS_ROWS], ['More', MORE_ROWS]]) {
    const row = hubRows(rows, flags, hidden).flat().find((r) => fileOf(r.path) === file && !r.path.includes('#'));
    if (row) return `${hub} › ${row.label}`;
  }
  return null;
}
