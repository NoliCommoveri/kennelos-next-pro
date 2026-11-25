// hubRows.js — a hub's top-level rows (the forest look's `.big-rows`, the prototype's row()),
// for Business and More (data/shellNav.js lists them). Each row opens its screen; a row's
// end shows a count when it has one. Every value is escaped.
import { icon } from './icon.js';
import { esc } from './ui.js';

const chev = `<span class="chev">${icon('chevron-right')}</span>`;

/** One row: icon, title, subline, an optional count, the chevron. */
export function rowHtml({ key, icon: ic, label, sub, end = '' }) {
  return `<button type="button" class="row" data-row="${esc(key)}"><span class="row-ic">${icon(ic)}</span><span class="row-main"><span class="row-t">${esc(label)}</span>${sub ? `<span class="row-s">${esc(sub)}</span>` : ''}</span><span class="row-end">${end}${chev}</span></button>`;
}

/** The cards: one `.card.big-rows` per group, the danger card last as the prototype has it. */
export function hubCardsHtml(cards) {
  return cards.map((rows) => `<section class="card big-rows${rows.some((r) => r.danger) ? ' danger' : ''}"><div class="rows">${rows.map(rowHtml).join('')}</div></section>`).join('');
}

/** A count at a row's end. */
export const countEnd = (n) => `<span class="amt">${esc(String(n))}</span>`;

/** Draws the cards into the screen (after its #app-nav anchor) and opens a row's page on a tap. */
export function mountHub(screen, cards, prefix = '../') {
  const box = document.createElement('div');
  box.innerHTML = hubCardsHtml(cards);
  const sections = [...box.children];
  sections.forEach((s) => screen.appendChild(s));
  const byKey = new Map(cards.flat().map((r) => [r.key, r]));
  screen.addEventListener('click', (e) => {
    const b = e.target.closest('[data-row]');
    const row = b && byKey.get(b.dataset.row);
    if (row) location.href = prefix + row.path.replace(/^pages\//, '');
  });
  return sections;
}

/** Puts a new subline or end on a drawn row. */
export function updateRow(screen, key, { sub, end }) {
  const b = screen.querySelector(`[data-row="${CSS.escape(key)}"]`);
  if (!b) return;
  if (sub != null) {
    let s = b.querySelector('.row-s');
    if (!s) { s = document.createElement('span'); s.className = 'row-s'; b.querySelector('.row-main').appendChild(s); }
    s.textContent = sub;
  }
  if (end != null) b.querySelector('.row-end').innerHTML = end + chev;
}
