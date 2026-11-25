// more.js — the More hub (UI Redesign plan Phase 1; the prototype's S.more): Setup; Sharing,
// Storage and Kels; Backup & Restore and Import / Export; the Danger zone. The rows are
// data/shellNav.js's MORE_ROWS that this edition offers. Below Kels, the guided tour's row
// when there's a tour to take (wizardUI.renderWizardMenuEntry fills #shell-tour), and in
// Lite the links out to the Demo and to Pro.
import { MORE_ROWS, hubRows } from '../data/shellNav.js';
import { mountHub, updateRow, rowHtml } from '../assets/hubRows.js';
import { getLastBackupDate } from '../data/settings.js';
import { hasEditionLinks, wireEditionLinks } from '../assets/editionLinks.js';
import { demoUrl, upgradeUrl } from '../data/editionConfig.js';

const screen = document.getElementById('screen');
const cards = hubRows(MORE_ROWS);
const sections = mountHub(screen, cards);

// The tour's row, after the card with Kels (or at the end).
const tour = document.createElement('section');
tour.className = 'card big-rows';
tour.id = 'shell-tour';
tour.hidden = true;
tour.innerHTML = '<div class="rows"></div>';
const kelsCard = sections.find((s) => s.querySelector('[data-row="kels"]'));
if (kelsCard) kelsCard.after(tour); else screen.appendChild(tour);

// "Last backup today, 6:12 AM" (the prototype's subline), from this device's last backup.
function backupLine(iso, now = new Date()) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'No backup yet';
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  return `Last backup ${sameDay ? 'today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}
if (cards.flat().some((r) => r.key === 'backup')) updateRow(screen, 'backup', { sub: backupLine(getLastBackupDate()) });

// Lite: see the full app (the Demo, in a new tab) and upgrade to Pro.
if (hasEditionLinks()) {
  const links = document.createElement('section');
  links.className = 'card big-rows edition-links';
  const demo = demoUrl ? rowHtml({ key: 'demo', icon: 'arrow-up-right', label: 'See the full app', sub: 'Opens the KennelOS demo in a new tab' }) : '';
  const upgrade = upgradeUrl ? rowHtml({ key: 'upgrade', icon: 'sparkles', label: 'Upgrade to Pro', sub: 'Unlimited dogs and litters, plus every Pro feature' }) : '';
  links.innerHTML = `<div class="rows">${demo}${upgrade}</div><p class="edition-links-note f-hint" role="status" hidden></p>`;
  links.querySelector('[data-row="upgrade"]')?.classList.add('edition-link', 'edition-link-upgrade');
  links.querySelector('[data-row="demo"]')?.addEventListener('click', () => globalThis.open(demoUrl, '_blank', 'noopener'));
  const danger = sections.find((s) => s.classList.contains('danger'));
  if (danger) danger.before(links); else screen.appendChild(links);
  wireEditionLinks(links);
}
