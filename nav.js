// nav.js — the shell (UI Redesign plan Phase 1): the forest header band, the tab bar (a left
// rail on desktop) and the one back history across tabs, drawn on every page into the frame
// each page's HTML already has:
//
//   <div class="app" id="app"><div class="shell">
//     <nav class="tabbar" id="tabbar" aria-label="Main"></nav>
//     <div class="main">
//       <header class="appbar" id="appbar"></header>
//       <div class="screen …" id="screen" tabindex="-1"> <div id="app-nav" hidden></div> … </div>
//     </div>
//   </div></div>
//
// The markup is the prototype's (render(), bar(), brandBlock(), searchBtn), so forest.css /
// forest-shell.css style it unchanged. The frame is in the HTML, so drawing it moves nothing
// (Load Performance plan Phase 1). #app-nav stays as an empty anchor at the top of the screen:
// the strips drawn "under the nav" (the tour, the website, cloud notices) land there.
//
// The header's title is the screen's: a converted screen names it on #screen
// (data-shell-title, data-shell-icon); a page in the old look keeps its own <h1>, which moves
// up into the band (and follows the page when it renames it, as a record's page does once
// loaded). Tabs and hub rows come from data/shellNav.js; the history from data/navHistory.js.
import { editionLabel, editionFlags } from './data/editionConfig.js';
import { getNavKennels, getActiveKennelId } from './data/settings.js';
import { shellTabs, tabOf, isOffered, SETUP_PATH } from './data/shellNav.js';
import { arrive, leave, goBack, loadHistory, saveHistory, takeBacking, setBacking } from './data/navHistory.js';
import { icon } from './assets/icon.js';

// Pages live one directory deep (/pages/*.html); index.html sits at the app root. Links are
// stored app-root-relative and prefixed at render time so they resolve from either level
// (and from any GitHub Pages sub-path).
function rootPrefix() {
  return location.pathname.includes('/pages/') ? '../' : '';
}
const fileOf = (p) => String(p || '').split('#')[0].split('?')[0].split('/').pop() || 'index.html';
const here = () => location.pathname + location.search + location.hash;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** The element that scrolls: the screen under the header band (the page itself before the
 *  shell is drawn, and on the few pages without one). */
export function scroller() {
  return document.getElementById('screen') || document.scrollingElement || document.documentElement;
}

let stack = [];
let restoreY = null;

function arriveHere(navType) {
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  const r = arrive(loadHistory(), { here: here(), navType: navType || nav?.type || 'navigate', histLen: history.length, backing: takeBacking() });
  stack = r.stack;
  restoreY = r.restore;
  saveHistory(stack);
}

function currentTab(tabs) {
  const keys = new Set(tabs.map((t) => t.key));
  const own = tabOf(location.pathname);
  if (own && keys.has(own)) return own;
  for (let i = stack.length - 1; i >= 0; i--) {
    const t = tabOf(stack[i].u.split('?')[0].split('#')[0]);
    if (t && keys.has(t)) return t;
  }
  return 'home';
}

// --- the header band ------------------------------------------------------------------------
const edTag = () => (editionLabel ? ` <span class="ed-tag">${esc(String(editionLabel).toUpperCase())}</span>` : '');
// The kennel line under the brand: drawn with its space held (so the band and the rail never
// grow when the name arrives), then filled from the stored copy and corrected by
// kennelSetupUI / kennelScopeUI. Invisible while there's no name. It opens Kennels where
// there is a Kennels page.
function kennelSwitch() {
  const kennels = isOffered({ path: 'pages/kennels.html', flag: 'multiKennel' });
  return kennels
    ? `<button type="button" class="kennel-switch" data-shell-kennel data-go="pages/kennels.html" style="visibility:hidden"><span class="ks-name">&nbsp;</span> ${icon('chevron-down')}</button>`
    : `<span class="kennel-switch" data-shell-kennel style="visibility:hidden"><span class="ks-name">&nbsp;</span></span>`;
}
const brandName = () => `<div class="brand-name">KennelOS${edTag()}</div>`;
const brandBlock = () => `<div class="brand">${brandName()}${kennelSwitch()}</div>`;
const backBtn = () => (stack.length > 1 ? `<button type="button" class="icon-btn back-btn" aria-label="Back" data-back>${icon('arrow-left')}</button>` : '');
export const SEARCH_PATH = 'pages/search.html';
const searchBtn = `<button type="button" class="icon-btn search-btn" aria-label="Search everything (press /)" data-search>${icon('search')}<span class="lbl">Search</span><kbd>/</kbd></button>`;

// The old-look page's own title (its .page-header's <h1>), shown in the band instead. app.css
// hides it from the first paint (.screen.legacy .page-header h1), so nothing moves when it's
// lifted. A page without one (Kels, an invoice) is named by its <title>.
function liftedTitle() {
  return document.querySelector('#screen:not(.keep-title) .page-header h1');
}

function titleText() {
  const scr = document.getElementById('screen');
  if (scr?.dataset.shellTitle) return { text: scr.dataset.shellTitle, ic: scr.dataset.shellIcon || '' };
  const h1 = liftedTitle();
  if (h1) return { text: h1.textContent.trim(), ic: '', from: h1 };
  return { text: (document.title || '').split(' — ')[0], ic: '' };
}

function drawAppbar(bar, tabs) {
  const file = fileOf(location.pathname);
  const home = tabs.find((t) => t.key === 'home');
  if (home && file === fileOf(home.path)) {
    const setup = isOffered({ path: SETUP_PATH })
      ? `<button type="button" class="icon-btn" aria-label="Setup" data-go="${esc(SETUP_PATH)}">${icon('settings')}</button>` : '';
    bar.innerHTML = `${backBtn()}${brandBlock()}<div class="head-icons">${setup}</div>${searchBtn}`;
    return;
  }
  const t = titleText();
  // A tab's own screen shows the tab's icon beside its title when it's the first screen.
  const tab = tabs.find((x) => fileOf(x.path) === file);
  const ic = stack.length <= 1 ? (t.ic || tab?.icon || '') : '';
  // Search's own screen has the box itself, not the button (the prototype's S.search).
  const onSearch = file === fileOf(SEARCH_PATH);
  bar.innerHTML = `${backBtn()}<h1>${ic ? icon(ic) : ''}<span class="shell-title">${esc(t.text)}</span></h1>${onSearch ? '' : searchBtn}`;
  if (t.from) mirrorTitle(t.from, bar.querySelector('.shell-title'));
}

let titleObserver = null;
function mirrorTitle(from, to) {
  titleObserver?.disconnect();
  if (!to || typeof MutationObserver === 'undefined') return;
  titleObserver = new MutationObserver(() => {
    const text = from.textContent.trim();
    if (to.textContent !== text) to.textContent = text;
  });
  titleObserver.observe(from, { childList: true, characterData: true, subtree: true });
}

// --- the tab bar / rail ---------------------------------------------------------------------
function drawTabbar(nav, tabs) {
  const active = currentTab(tabs);
  const setup = isOffered({ path: SETUP_PATH })
    ? `<div class="rail-foot"><button type="button" class="tab" data-go="${esc(SETUP_PATH)}"${fileOf(location.pathname) === fileOf(SETUP_PATH) ? ' aria-current="page"' : ''}>${icon('settings')}<span>Setup</span></button></div>`
    : '';
  nav.innerHTML = `<div class="rail-brand">${brandName()}${kennelSwitch()}</div>`
    + tabs.map((t) => `<button type="button" class="tab" data-go="${esc(t.path)}"${t.key === active ? ' aria-current="page"' : ''}>${icon(t.icon)}<span>${esc(t.label)}</span></button>`).join('')
    + setup;
}

// --- moving between screens -----------------------------------------------------------------
function open(path) {
  const target = rootPrefix() + path;
  const url = new URL(target, location.href);
  // Tapping the tab she's on scrolls it to the top, as the prototype's go() does.
  if (url.pathname === location.pathname && url.search === location.search && !url.hash) {
    scroller().scrollTop = 0;
    return;
  }
  location.href = url.href;
}

let backing = false;
function back() {
  const { stack: next, target } = goBack(loadHistory());
  if (!target) return;
  saveHistory(next);
  setBacking(target);
  backing = true; // this page is off the history now: leaving it mustn't write it back
  location.href = target;
}

// Her place on this page, saved as she leaves it.
function remember() {
  if (backing) return;
  saveHistory(leave(loadHistory(), { here: here(), y: Math.round(scroller().scrollTop || 0) }));
}

// Puts the screen back where she left it. Records are drawn after load, so it tries until
// the screen is tall enough, for up to two seconds, and stops if she scrolls first.
function restoreScroll(y) {
  const el = scroller();
  if (!y || !el) return;
  let stop = false;
  const quit = () => { stop = true; };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((e) => el.addEventListener(e, quit, { once: true, passive: true }));
  const until = performance.now() + 2000;
  const step = () => {
    if (stop) return;
    el.scrollTop = y;
    if (Math.abs(el.scrollTop - y) > 1 && performance.now() < until) requestAnimationFrame(step);
  };
  step();
}

function wire(host) {
  host.addEventListener('click', (e) => {
    const b = e.target.closest('[data-back], [data-go], [data-search]');
    if (!b || !host.contains(b)) return;
    if (b.hasAttribute('data-back')) back();
    else if (b.hasAttribute('data-go')) open(b.getAttribute('data-go'));
    else openSearch();
  });
}

// Search (Phase 2): its own screen. On it, the keys put her back in the box (search.js
// listens for the event).
function openSearch() {
  if (fileOf(location.pathname) === fileOf(SEARCH_PATH)) document.dispatchEvent(new CustomEvent('kennelos:search'));
  else open(SEARCH_PATH);
}

// "/" anywhere she isn't typing, and Ctrl+K or Cmd+K anywhere, open search.
function typing(el) {
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
function onKey(e) {
  if (e.defaultPrevented || e.altKey) return;
  const k = (e.key || '').toLowerCase();
  const cmdK = k === 'k' && (e.ctrlKey || e.metaKey) && !e.shiftKey;
  const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !typing(document.activeElement);
  if (!cmdK && !slash) return;
  if (document.querySelector('dialog[open], .modal-overlay, .sheet-back')) return;
  e.preventDefault();
  openSearch();
}

let wired = false;
function draw() {
  const tabs = shellTabs();
  const bar = document.getElementById('appbar');
  const nav = document.getElementById('tabbar');
  if (bar) drawAppbar(bar, tabs);
  if (nav) drawTabbar(nav, tabs);
  refreshKennelLine();
}

/** The kennel line under the brand (in the band on Home, and in the rail), from the stored
 *  copy (settings.getNavKennels): the kennel she's narrowed to when More than one kennel is
 *  on, else her kennel's name; none before setup. kennelSetupUI and kennelScopeUI correct
 *  the copy from the database and call this again. */
export function refreshKennelLine() {
  const nk = getNavKennels();
  const active = editionFlags.multiKennel ? getActiveKennelId() : null;
  const scoped = active && (nk?.own || []).find((k) => k.id === active)?.kennel_name;
  drawKennelLine(scoped || nk?.name || null);
}

function drawKennelLine(name) {
  document.querySelectorAll('[data-shell-kennel]').forEach((el) => {
    const span = el.querySelector('.ks-name');
    const text = name || '\u00a0'; // a space holds the line's height
    if (span && span.textContent !== text) span.textContent = text;
    el.style.visibility = name ? '' : 'hidden';
    if (el.tagName === 'BUTTON') el.disabled = !name;
  });
}

/** Draws the shell. Every page calls it through app.js, before anything else. */
export function renderNav() {
  if (!document.getElementById('tabbar') && !document.getElementById('appbar')) return;
  arriveHere();
  draw();
  if (!wired) {
    wired = true;
    ['appbar', 'tabbar'].forEach((id) => { const el = document.getElementById(id); if (el) wire(el); });
    if (document.getElementById('appbar')) document.addEventListener('keydown', onKey);
    addEventListener('pagehide', remember);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') remember(); });
    // Back to a page the browser kept in memory: the page isn't loaded again, so the
    // history and the header are brought up to date here.
    addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      backing = false;
      arriveHere('back_forward');
      draw();
    });
  }
  if (restoreY) restoreScroll(restoreY);
}
