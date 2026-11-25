// search.js — Search (UI Redesign plan §1 "Search", Phase 2; the prototype's S.search): one
// box over every screen, dog, litter, pairing, waitlist family, person, sale, stud service,
// contract, event, document, money entry, setting and report, in the active kennel's scope.
// Results are grouped by kind with the matching words highlighted, five a group until
// "Show all"; every word must match. The empty box shows her recent searches (this device).
// The search is kept in the address (?q=), so back from a result returns to it.
import { buildIndex, search, words, highlight, addRecent, GROUP_LIMIT } from '../data/searchIndex.js';
import { editionFlags, shellHiddenPages } from '../data/editionConfig.js';
import { getRecentSearches, setRecentSearches } from '../data/settings.js';
import { dogRepo } from '../data/dogRepo.js';
import { litterRepo } from '../data/litterRepo.js';
import { pairingRepo } from '../data/pairingRepo.js';
import { contactRepo } from '../data/contactRepo.js';
import { saleRepo } from '../data/saleRepo.js';
import { eventRepo } from '../data/eventRepo.js';
import { expenseRepo } from '../data/expenseRepo.js';
import { kennelRepo } from '../data/kennelRepo.js';
import { dogsInScope, inScopeOnly, subjectInScope, expenseInScope } from '../data/kennelScope.js';
import { icon } from '../assets/icon.js';
import { esc, param } from '../assets/ui.js';

const screen = document.getElementById('screen');
const input = document.getElementById('q-search');
const bar = screen.querySelector('.fbar');
document.getElementById('search-icon')?.replaceWith(Object.assign(document.createElement('template'), { innerHTML: icon('search') }).content);
const chev = `<span class="chev">${icon('chevron-right')}</span>`;

let index = null;
const showAll = new Set();

// Records only the edition has: their repos load only where the feature is on.
async function optional(flag, load) {
  if (!editionFlags[flag]) return [];
  try { return await load(); } catch { return []; }
}

async function loadIndex() {
  const [dogs, litters, pairings, contacts, sales, events, expenses, kennels] = await Promise.all([
    dogRepo.getAll(), litterRepo.getAll(), pairingRepo.getAll(), contactRepo.getAll(), saleRepo.getAll(),
    eventRepo.getAll(), expenseRepo.getAll(), kennelRepo.getAll(),
  ]);
  const [entries, studServices, contracts, documents] = await Promise.all([
    optional('waitlist', async () => (await import('../data/waitlistEntryRepo.js')).waitlistEntryRepo.getAll()),
    optional('studServices', async () => (await import('../data/studServiceRepo.js')).studServiceRepo.getAll()),
    optional('contracts', async () => (await import('../data/contractRepo.js')).contractRepo.getAll()),
    optional('documents', async () => (await import('../data/documentRepo.js')).documentRepo.getAll()),
  ]);
  // Scope (Multi-Kennel Scope Spec §7): the maps resolve every subject, the lists are scoped.
  const maps = {
    dog: new Map(dogs.map((d) => [d.id, d])), litter: new Map(litters.map((l) => [l.id, l])),
    pairing: new Map(pairings.map((p) => [p.id, p])), stud_service: new Map(studServices.map((s) => [s.id, s])),
  };
  return buildIndex({
    dogs: dogsInScope(dogs), litters: inScopeOnly(litters), pairings: inScopeOnly(pairings), contacts,
    entries: inScopeOnly(entries), sales: inScopeOnly(sales), studServices: inScopeOnly(studServices),
    contracts: inScopeOnly(contracts), documents: documents.filter((d) => subjectInScope('dog', d.dog_id, maps)),
    events: events.filter((e) => subjectInScope(e.subject_type, e.subject_id, maps)),
    expenses: expenses.filter((x) => expenseInScope(x, maps)), kennels,
  }, { flags: editionFlags, hidden: shellHiddenPages });
}

function resultsHtml(q) {
  const w = words(q);
  if (!w.length) {
    const recent = getRecentSearches();
    return `${recent.length ? `<section class="card"><div class="section-h"><h2>Recent</h2></div><div class="rows">${recent.map((r) => `<button type="button" class="row" data-sterm="${esc(r)}"><span class="row-ic gray">${icon('history')}</span><span class="row-main"><span class="row-t">${esc(r)}</span></span>${chev}</button>`).join('')}</div></section>` : ''}
      <p class="lede">Searches every dog, litter, waitlist family, contact, sale, event, money entry, setting and report. Press / on a keyboard to search from anywhere.</p>`;
  }
  if (!index) return '<p class="fcount">Searching…</p>';
  const groups = search(index, q);
  if (!groups.length) return `<section class="card empty">${icon('search-x')}<p>Nothing found for “${esc(q.trim())}”. Check the spelling, or try fewer words.</p></section>`;
  const n = groups.reduce((t, g) => t + g.hits.length, 0);
  return `<p class="fcount">${n} result${n > 1 ? 's' : ''} for “${esc(q.trim())}”</p>${groups.map(({ group, hits }) => {
    const shown = showAll.has(group) ? hits : hits.slice(0, GROUP_LIMIT);
    return `<section class="card"><div class="section-h"><h2>${esc(group)}</h2><span class="fcount">${hits.length}</span></div><div class="rows">${shown.map((r) => `<button type="button" class="row" data-href="${esc(r.href)}"><span class="row-ic">${icon(r.icon)}</span><span class="row-main"><span class="row-t"><span>${highlight(r.title, w)}</span></span>${r.sub ? `<span class="row-s">${highlight(r.sub, w)}</span>` : ''}</span>${chev}</button>`).join('')}
      ${hits.length > shown.length ? `<button type="button" class="row" data-smore="${esc(group)}"><span class="row-main"><span class="row-t" style="color:var(--primary)">Show all ${hits.length}</span></span></button>` : ''}</div></section>`;
  }).join('')}`;
}

function render() {
  while (bar.nextSibling) bar.nextSibling.remove();
  bar.insertAdjacentHTML('afterend', resultsHtml(input.value));
}

function keepInAddress() {
  const url = new URL(location.href);
  const q = input.value.trim();
  if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

input.addEventListener('input', () => { showAll.clear(); render(); keepInAddress(); });
screen.addEventListener('click', (e) => {
  const b = e.target.closest('[data-href], [data-sterm], [data-smore]');
  if (!b) return;
  if (b.dataset.sterm != null) { input.value = b.dataset.sterm; showAll.clear(); render(); keepInAddress(); input.focus(); return; }
  if (b.dataset.smore) { showAll.add(b.dataset.smore); render(); return; }
  setRecentSearches(addRecent(getRecentSearches(), input.value));
  location.href = b.dataset.href;
});
// The header's search button, here, just puts her back in the box.
document.addEventListener('kennelos:search', () => input.focus());

input.value = param('q') || '';
render();
input.focus();
loadIndex().then((ix) => { index = ix; render(); }).catch((e) => {
  index = [];
  render();
  console.warn('KennelOS: search', e);
});
