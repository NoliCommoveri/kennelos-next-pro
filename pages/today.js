// today.js — Home in the forest look (UI Redesign plan Phase 2; the prototype's S.home):
//   Today and the day's date, then a pill per open litter or pairing naming its stage (D28);
//   six tiles, three that follow the stages and three that stay (data/homeStages.js);
//   Needs you: live's nudges as rows, each opening a sheet with its buttons and Dismiss (the
//   owner's departure, 2026-11-25: the prototype's Home has no nudges); This week (reminders
//   overdue or due in seven days, and what's dated in them) and Coming up (dogs away from
//   home, then what's dated after), with All reminders and Calendar; the cloud backup line.
//
// Everything is read from her records when Home opens (in the active kennel's scope) and
// drawn in one paint. Nudges redraw by themselves when a family's message or action comes
// in while Home is open.
import { eventRepo } from '../data/eventRepo.js';
import { getAwayBoardRows } from '../data/awayBoard.js';
import { computeNudges } from '../data/nudges.js';
import { isDismissed, dismiss } from '../data/nudgeState.js';
import { dogRepo } from '../data/dogRepo.js';
import { litterRepo } from '../data/litterRepo.js';
import { pairingRepo } from '../data/pairingRepo.js';
import { saleRepo } from '../data/saleRepo.js';
import { contactRepo } from '../data/contactRepo.js';
import { dogsInScope, inScopeOnly, subjectInScope } from '../data/kennelScope.js';
import { descriptor, EVENT_TYPES } from '../data/vocab.js';
import { editionFlags } from '../data/editionConfig.js';
import { isReadOnly } from '../data/demoMode.js';
import { shellTabs, isOffered } from '../data/shellNav.js';
import { kennelStages, stagePills, homeTiles, agendaRows, nudgeLook, pairName } from '../data/homeStages.js';
import { esc, fmtMoney, alertModal, confirmModal } from '../assets/ui.js';
import { icon } from '../assets/icon.js';
import { backupLine } from '../assets/hubRows.js';
import { renderUpgradeNudge } from '../assets/upgradeNudge.js';
import { CapExceededError } from '../data/repoBase.js';
import { todayYMD } from '../data/dateUtils.js';
import { isCloudAvailable } from '../data/cloud/cloudConfig.js';
import { CLOUD_DATA_CHANGED_EVENT, getWebsiteStripCache, getLastBackupDate, getCloudBackupState } from '../data/settings.js';
import { renderTodayCloudCard } from '../assets/todayCloudCard.js';

const screen = document.getElementById('screen');
const errorBox = document.getElementById('page-error');
const head = screen.querySelector('.today-h');
const chev = `<span class="chev">${icon('chevron-right')}</span>`;

function showError(msg) {
  errorBox.hidden = false;
  errorBox.innerHTML = `<div class="stub-note warn">${icon('circle-alert')}<span>${esc(msg)}</span></div>`;
}

document.getElementById('today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

// --- the prototype's pieces ----------------------------------------------------------------
const pill = ({ label, tone }) => `<span class="pill ${esc(tone || '')}">${esc(label)}</span>`;
const rowHtml = ({ icon: ic, tone = '', title, sub, end = '', href, attrs = '' }) =>
  `<button type="button" class="row"${href ? ` data-href="${esc(href)}"` : ''}${attrs}><span class="row-ic ${esc(tone)}">${icon(ic)}</span><span class="row-main"><span class="row-t">${esc(title)}</span>${sub ? `<span class="row-s">${esc(sub)}</span>` : ''}</span><span class="row-end">${end}${chev}</span></button>`;
const tileHtml = (t) => `<button type="button" class="tile" data-href="${esc(t.href)}" data-tile="${esc(t.key)}">${icon(t.icon)}<b>${esc(t.title)}</b><span>${esc(t.sub)}</span></button>`;
const emptyLine = (text) => `<p class="lede" style="padding:4px 14px 12px">${esc(text)}</p>`;

// --- Needs you: live's nudges ------------------------------------------------------------
let nudges = [];
// Five, then "Show all", so This week stays in view (search's per-group rule).
const NEEDS_LIMIT = 5;
let needsAll = false;

function needsYouHtml() {
  const rows = nudges.filter((n) => !isDismissed(n.key));
  if (!rows.length) return '';
  const shown = needsAll ? rows : rows.slice(0, NEEDS_LIMIT);
  return `<section class="card" id="home-needs"><div class="section-h"><h2>${icon('bell-ring')}Needs you</h2><span class="fcount">${rows.length}</span></div>
    <div class="rows">${shown.map((n) => { const look = nudgeLook(n.key); return rowHtml({ icon: look.icon, tone: look.tone, title: n.title, sub: n.detail, attrs: ` data-nudge="${esc(n.key)}"` }); }).join('')}
    ${rows.length > shown.length ? `<button type="button" class="row" data-needs-all><span class="row-main"><span class="row-t" style="color:var(--primary)">Show all ${rows.length}</span></span></button>` : ''}</div></section>`;
}

function redrawNeedsYou() {
  const html = needsYouHtml();
  const old = document.getElementById('home-needs');
  if (old && html) old.outerHTML = html;
  else if (old) old.remove();
  else if (html) screen.querySelector('.home-cols')?.insertAdjacentHTML('beforebegin', html);
}

async function refreshNudges() {
  nudges = await computeNudges();
  redrawNeedsYou();
}

// The sheet a nudge opens: what it says, its buttons, Open and Dismiss.
function openNudge(key) {
  const n = nudges.find((x) => x.key === key);
  if (!n) return;
  const host = document.createElement('div');
  host.className = 'sheet-back';
  host.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(n.title)}">
      <div class="sheet-h"><h2>${esc(n.title)}</h2><button type="button" class="ghost" data-close>${icon('x')}Close</button></div>
      ${n.detail ? `<p class="lede">${esc(n.detail)}</p>` : ''}
      ${n.actions.map((a, i) => `<button type="button" class="${i ? 'btn-2' : 'primary-btn'}" data-act="${i}">${esc(a.label)}</button>`).join('')}
      <div class="actions-2">${n.subjectHref ? `<button type="button" class="btn-2" data-open>Open</button>` : ''}<button type="button" class="btn-2" data-dismiss>Dismiss</button></div>
    </div>`;
  const close = () => host.remove();
  host.addEventListener('click', async (e) => {
    if (e.target === host || e.target.closest('[data-close]')) return close();
    if (e.target.closest('[data-open]')) { location.href = n.subjectHref; return; }
    if (e.target.closest('[data-dismiss]')) { dismiss(key); close(); redrawNeedsYou(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    close();
    await runNudgeAction(key, n.actions[Number(b.dataset.act)]);
  });
  document.getElementById('app').appendChild(host);
  host.querySelector('.primary-btn, .btn-2')?.focus();
}

async function runNudgeAction(key, action) {
  try {
    // An action that can't be undone asks first (Lite's permanent departure).
    if (action.confirm && !(await confirmModal(action.ask))) return;
    // An action may return { title, message } to report what it did (the waitlist's
    // turn moving on to another family, say)…
    let report = await action.run();
    // …or `openPicks`: a litter to open picks on through the picks preview (Pro only).
    if (report && report.openPicks) {
      const { openPicksFromCheckin } = await import('../assets/waitlistPicksPanel.js');
      const litter = await litterRepo.getById(report.openPicks);
      report = litter ? await openPicksFromCheckin(litter) : null;
    }
    await refreshNudges();
    if (report && report.message) await alertModal(report);
    // …or `compose`: a note for her to send herself (the follow-up a week after a pup
    // goes home). Sent or copied, the nudge retires.
    if (report && report.compose) {
      const { openComposer } = await import('../assets/messageComposer.js');
      const sent = await openComposer(report.compose);
      if (sent && report.doneDismisses) { dismiss(key); redrawNeedsYou(); }
    }
    // …and `emails`: families to offer an email about it (the waitlist online, Pro only).
    if (report && report.emails?.length) {
      const { offerEmails } = await import('../assets/waitlistEmailUI.js');
      await offerEmails(report.emails);
    }
  } catch (e) {
    // Maturing a pup can hit Lite's cap: the upgrade nudge, not a raw error (cap spec §6).
    if (e instanceof CapExceededError) { errorBox.hidden = false; renderUpgradeNudge(errorBox, e, 'mature'); } else showError(e.message || String(e));
  }
}

// A family's message or status-page action comes in while Home is open: Needs you redraws
// (debounced, one at a time).
function watchForNudgeChanges() {
  let timer = null;
  let running = false;
  let again = false;
  const redraw = async () => {
    timer = null;
    if (running) { again = true; return; }
    running = true;
    try { await refreshNudges(); } catch { /* the next change tries again */ }
    running = false;
    if (again) { again = false; redraw(); }
  };
  window.addEventListener(CLOUD_DATA_CHANGED_EVENT, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(redraw, 1500);
  });
}

// --- the backup line and the install tip ----------------------------------------------------
const backupOffered = () => isOffered({ path: 'pages/import-export.html' });

function backupRowHtml() {
  if (!backupOffered()) return '';
  const cloudOn = isCloudAvailable() && getCloudBackupState().enabled;
  return `<section class="card" id="home-backup"><div class="rows">${rowHtml({ icon: 'cloud', title: cloudOn ? 'Cloud backup is on' : 'Backup', sub: backupLine(getLastBackupDate()), href: 'import-export.html#backup-restore' })}</div></section>`;
}

const INSTALL_TIP_KEY = 'install-tip';
function installRowHtml() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone || isDismissed(INSTALL_TIP_KEY)) return '';
  return `<section class="card" id="home-install"><div class="rows">${rowHtml({ icon: 'house', title: 'Put KennelOS on your home screen', sub: 'Opens like any app, and works offline', attrs: ' data-install' })}</div></section>`;
}

function openInstallTip() {
  const host = document.createElement('div');
  host.className = 'sheet-back';
  host.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Put KennelOS on your home screen">
      <div class="sheet-h"><h2>Put KennelOS on your home screen</h2><button type="button" class="ghost" data-close>${icon('x')}Close</button></div>
      <div class="stub-note">${icon('info')}<span><b>Android (Chrome):</b> tap the ⋮ menu, then <b>Add to Home screen</b> (or <b>Install app</b>).</span></div>
      <div class="stub-note">${icon('info')}<span><b>iPhone or iPad (Safari):</b> tap <b>Share</b>, then <b>Add to Home Screen</b>.</span></div>
      <button type="button" class="primary-btn" data-done>${icon('check')}Got it</button>
    </div>`;
  host.addEventListener('click', (e) => {
    if (e.target === host || e.target.closest('[data-close]')) host.remove();
    else if (e.target.closest('[data-done]')) { dismiss(INSTALL_TIP_KEY); host.remove(); document.getElementById('home-install')?.remove(); }
  });
  document.getElementById('app').appendChild(host);
}

// --- loading and drawing -------------------------------------------------------------------
async function load() {
  const today = todayYMD();
  const [allDogs, litters, pairings, sales, contacts, upcoming, reminders, away, nudgeList] = await Promise.all([
    dogRepo.getAll({ includeArchived: true }),
    litterRepo.getAll(),
    pairingRepo.getAll(),
    saleRepo.getAll(),
    contactRepo.getAll(),
    eventRepo.getUpcoming(),
    eventRepo.getReminders(),
    getAwayBoardRows(),
    computeNudges(),
  ]);
  const contracts = editionFlags.contracts
    ? await (await import('../data/contractRepo.js')).contractRepo.getAll().catch(() => []) : [];
  const dogsById = new Map(allDogs.map((d) => [d.id, d]));
  // Labels resolve from every record; lists are scoped (Multi-Kennel Scope Spec §7).
  const maps = { dog: dogsById, litter: new Map(litters.map((l) => [l.id, l])), pairing: new Map(pairings.map((p) => [p.id, p])) };
  const inScope = (ev) => subjectInScope(ev.subject_type, ev.subject_id, maps);
  const dogs = dogsInScope(allDogs.filter((d) => !d.is_archived));
  const scoped = { litters: inScopeOnly(litters), pairings: inScopeOnly(pairings), sales: inScopeOnly(sales), contracts: inScopeOnly(contracts) };
  const pickups = upcoming.filter((e) => e.event_type === 'placement').filter(inScope);
  const stages = kennelStages({ litters: scoped.litters, pairings: scoped.pairings, dogs, pickups, today, waitlist: !!editionFlags.waitlist });

  // Weights for the newborn litters' pups (their own histories), for "Last weighed".
  const newborn = stages.filter((s) => s.k === 'newborns' && s.litter).map((s) => s.litter.id);
  const weighPups = dogs.filter((d) => newborn.includes(d.litter_id));
  const weights = (await Promise.all(weighPups.map((p) => eventRepo.getForSubject('dog', p.id)))).flat();
  // Balances owed matter only while pups are going home; the money code loads only then.
  const priceTable = stages.some((s) => s.k === 'gohome') ? (await import('../data/incomeView.js')).priceTable : null;
  nudges = nudgeList;
  return { priceTable, today, dogs, dogsById, contacts, stages, pickups, weights, upcoming: upcoming.filter(inScope), reminders: reminders.filter(inScope), away, ...scoped, maps };
}

function steadyTiles(d) {
  const year = d.today.slice(0, 4);
  const tiles = [];
  if (editionFlags.websiteLink && !isReadOnly() && d.website) {
    const waiting = getWebsiteStripCache()?.waiting?.length || 0;
    tiles.push({ key: 'website', icon: 'globe', title: 'Website', sub: waiting ? `${waiting} change${waiting > 1 ? 's' : ''} not on your site` : 'Up to date', href: 'kels.html?task=website-update' });
  }
  tiles.push({ key: 'sales', icon: 'tag', title: 'Sales', sub: `${d.sales.filter((s) => String(s.sale_date || '').startsWith(year)).length} this year`, href: 'sales.html' });
  tiles.push({ key: 'financials', icon: 'coins', title: 'Financials', sub: 'Income, expenses and net', href: 'financials.html' });
  if (isOffered({ path: 'pages/contacts.html', flag: 'contactsSection' })) tiles.push({ key: 'people', icon: 'users', title: 'People', sub: `${d.contacts.length} ${d.contacts.length === 1 ? 'person' : 'people'}`, href: 'contacts.html' });
  return tiles;
}

function draw(d) {
  const tabs = shellTabs().map((t) => t.key);
  const tiles = homeTiles({
    stages: d.stages, tabs, steady: steadyTiles(d),
    ctx: {
      today: d.today, dogs: d.dogs, sales: d.sales, events: [...d.weights, ...d.pickups], flags: editionFlags,
      contractsToSign: d.contracts.filter((c) => c.status === 'sent').length,
      balanceDue: (s) => { try { return d.priceTable ? d.priceTable(s).balanceDue : 0; } catch { return 0; } },
      money: (n) => fmtMoney(n).replace(/\.00$/, ''),
    },
  });
  const typeLabel = (t) => descriptor(EVENT_TYPES, t).label;
  const subject = (ev) => (ev.subject_type === 'dog' ? d.dogsById.get(ev.subject_id)?.call_name || '—'
    : pairName(d.maps[ev.subject_type]?.get(ev.subject_id), d.dogsById));
  const { week, later } = agendaRows({
    reminders: d.reminders, upcoming: d.upcoming, away: d.away, today: d.today,
    label: subject, typeLabel, dogName: (id) => d.dogsById.get(id)?.call_name || '—',
  });
  const weekRows = week.map((r) => rowHtml({ ...r, end: r.pill ? pill(r.pill) : '' })).join('');
  const laterRows = later.slice(0, 6).map((r) => rowHtml(r)).join('');
  const html = `
    <div class="pups-strip">${stagePills(d.stages).map(pill).join('')}</div>
    <div class="tiles">${tiles.map(tileHtml).join('')}</div>
    ${needsYouHtml()}
    <div class="home-cols">
      <section class="card"><div class="section-h"><h2>${icon('calendar-check')}This week</h2><button type="button" class="link" data-href="reminders.html">All reminders</button></div><div class="rows">${weekRows || emptyLine('Nothing due this week.')}</div></section>
      <div class="stack">
        <section class="card"><div class="section-h"><h2>${icon('calendar-days')}Coming up</h2><button type="button" class="link" data-href="calendar.html">Calendar</button></div><div class="rows">${laterRows || emptyLine('Nothing coming up yet.')}</div></section>
        <div id="today-cloud" hidden></div>
        ${backupRowHtml()}
        ${installRowHtml()}
      </div>
    </div>`;
  head.insertAdjacentHTML('afterend', html);
}

// Net on the Financials tile, as Financials' overview counts it, once Home is drawn.
async function fillNet() {
  const tile = screen.querySelector('[data-tile="financials"] span');
  if (!tile) return;
  const [{ getIncomeRows, summarize }, { expenseRepo }, { expenseInScope }, studs] = await Promise.all([
    import('../data/incomeView.js'), import('../data/expenseRepo.js'), import('../data/kennelScope.js'),
    editionFlags.studServices ? import('../data/studServiceRepo.js').then((m) => m.studServiceRepo.getAll()).catch(() => []) : [],
  ]);
  const [rows, expenses, dogs, litters, pairings] = await Promise.all([
    getIncomeRows(), expenseRepo.getAll(), dogRepo.getAll({ includeArchived: true }), litterRepo.getAll({ includeArchived: true }), pairingRepo.getAll({ includeArchived: true }),
  ]);
  const maps = { dog: new Map(dogs.map((x) => [x.id, x])), litter: new Map(litters.map((x) => [x.id, x])), pairing: new Map(pairings.map((x) => [x.id, x])), stud_service: new Map(studs.map((x) => [x.id, x])) };
  const net = summarize(rows).totals.earned - expenseRepo.total(expenses.filter((x) => expenseInScope(x, maps)));
  const text = fmtMoney(Math.abs(net)).replace(/\.\d\d$/, '');
  tile.textContent = `Net ${net > 0 ? '+' : net < 0 ? '−' : ''}${text}`;
}

// Her website tile shows while a site is linked; its line is corrected after a fresh compare.
async function websiteLinked() {
  if (!editionFlags.websiteLink || isReadOnly()) return false;
  try { return await (await import('../data/kennelportLinkStore.js')).anyWebsiteLink(); } catch { return false; }
}

screen.addEventListener('click', (e) => {
  const b = e.target.closest('[data-href], [data-nudge], [data-install], [data-needs-all]');
  if (!b || !screen.contains(b)) return;
  if (b.hasAttribute('data-needs-all')) { needsAll = true; redrawNeedsYou(); } else if (b.hasAttribute('data-nudge')) openNudge(b.dataset.nudge);
  else if (b.hasAttribute('data-install')) openInstallTip();
  else location.href = b.dataset.href;
});

async function main() {
  const [d, website] = await Promise.all([load(), websiteLinked()]);
  d.website = website;
  draw(d);
  // "Turn on free cloud backup", "backup is paused" and the like, only with a server; the
  // backup line steps aside while one shows.
  if (isCloudAvailable()) {
    renderTodayCloudCard(document.getElementById('today-cloud'), {
      onChange: (shown) => { const r = document.getElementById('home-backup'); if (r) r.hidden = shown; },
    });
  }
  watchForNudgeChanges();
  fillNet().catch((e) => console.warn('KennelOS: Home net', e));
}

main().catch((e) => showError(e.message || String(e)));
