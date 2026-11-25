// business.js — the Business hub (UI Redesign plan Phase 1; the prototype's S.business):
// sales, stud services, contracts and people; financials and reports; accounts. The rows
// are data/shellNav.js's BUSINESS_ROWS that this edition offers. Sales and Stud Services
// show how many there are, and Contracts what's waiting, in the active kennel's scope like
// their own pages.
import { BUSINESS_ROWS, hubRows } from '../data/shellNav.js';
import { mountHub, updateRow, countEnd } from '../assets/hubRows.js';
import { saleRepo } from '../data/saleRepo.js';
import { studServiceRepo } from '../data/studServiceRepo.js';
import { contractRepo } from '../data/contractRepo.js';
import { inScopeOnly } from '../data/kennelScope.js';

const screen = document.getElementById('screen');
const cards = hubRows(BUSINESS_ROWS);
mountHub(screen, cards);
const offered = new Set(cards.flat().map((r) => r.key));

async function counts() {
  if (offered.has('sales')) {
    const sales = inScopeOnly(await saleRepo.getAll());
    updateRow(screen, 'sales', { end: countEnd(sales.length) });
  }
  if (offered.has('studs')) {
    const studs = inScopeOnly(await studServiceRepo.getAll());
    updateRow(screen, 'studs', { end: countEnd(studs.length) });
  }
  if (offered.has('contracts')) {
    const all = inScopeOnly(await contractRepo.getAll());
    const sent = all.filter((c) => c.status === 'sent').length;
    const draft = all.filter((c) => c.status === 'draft').length;
    updateRow(screen, 'contracts', { sub: `${sent} waiting on signatures · ${draft} draft` });
  }
}
counts().catch((e) => console.warn('KennelOS: Business counts', e));
