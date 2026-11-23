// pairingWarnings.js — the line warnings for a sire and dam
// (docs/KennelOS_Line_Management_Plan.md D1, D2, D13). PURE: a kinship calculator
// (kinship.js) and the pair in, a list of warnings out; no Dexie, no DOM.
//
// D1 (owner, 2026-11-23): close relatives (parent and child, full siblings, half
// siblings), a litter COI over her line (12.5% unless she sets another), and
// carrier × carrier on the same health marker. Each can be switched off; a thin
// pedigree is not a warning (every COI shows its depth instead).
// D2: warnings never block. Parent and child and full siblings ask her to confirm
// once before the pairing saves (`confirm: true`).
// D13: a COI she recorded for the pairing is the figure the COI warning reads.
//
// The sex checks and "same dog" stay with the pairing form; this is only the line.

export const DEFAULT_WARNING_SETTINGS = Object.freeze({
  closeRelatives: true,
  coiOver: true,
  coiLine: 12.5, // a percent, as she types it
  carriers: true
});

// Settings with anything missing or unusable taken from the defaults.
export function warningSettings(raw) {
  const s = { ...DEFAULT_WARNING_SETTINGS };
  if (raw && typeof raw === 'object') {
    for (const k of ['closeRelatives', 'coiOver', 'carriers']) if (typeof raw[k] === 'boolean') s[k] = raw[k];
    const line = Number(raw.coiLine);
    if (raw.coiLine !== null && raw.coiLine !== '' && Number.isFinite(line) && line >= 0 && line <= 100) s.coiLine = line;
  }
  return s;
}

const CLOSE = new Set(['parent', 'child', 'full_sibling', 'half_sibling']);
const CONFIRM = new Set(['parent', 'child', 'full_sibling']);

// A percent for copy: 6.25 → "6.3%", 25 → "25%".
export function percentText(fraction) {
  const p = Math.round(fraction * 1000) / 10;
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
}

// The share of pups expected affected when both parents have a result on one
// marker: carrier × carrier 25%, carrier × affected 50%, affected × affected 100%.
const AT_RISK = new Set(['carrier', 'affected']);
function affectedShare(r1, r2) {
  const copies = (r) => (r === 'affected' ? 2 : 1);
  return (copies(r1) / 2) * (copies(r2) / 2);
}

// → [{ code, confirm, text, ...detail }], closest first.
//   kin:          createKinship(allDogs)
//   sireId/damId: the pair
//   opts.recordedCoi:  the pairing's recorded_coi, if any (D13)
//   opts.settings:     her warning settings (warningSettings fills the gaps)
//   opts.markers:      Map or object of dog id → [{ marker, result }] (results
//                      'clear' | 'carrier' | 'affected'); none until DNA markers
//                      are recorded per marker (Phase 4)
//   opts.nameOf:       id → display name, for the text
export function pairingWarnings(kin, sireId, damId, opts = {}) {
  const settings = warningSettings(opts.settings);
  const nameOf = opts.nameOf || ((id) => String(id));
  const out = [];
  if (!kin || !sireId || !damId || sireId === damId || !kin.has(sireId) || !kin.has(damId)) return out;

  if (settings.closeRelatives) {
    // From the dam's side: "Ivy is Ash's daughter".
    const rel = kin.relationship(damId, sireId);
    if (CLOSE.has(rel.kind)) {
      const dam = nameOf(damId), sire = nameOf(sireId);
      let text;
      if (rel.kind === 'half_sibling' && rel.certain === false) {
        const sib = kin.siblings(damId, sireId);
        text = `${dam} and ${sire} share a parent, ${nameOf(sib.shared)}: at least half siblings.`;
      } else if (rel.kind === 'full_sibling' || rel.kind === 'half_sibling') {
        text = `${dam} and ${sire} are ${rel.kind === 'full_sibling' ? 'full' : 'half'} siblings.`;
      } else {
        text = `${dam} is ${sire}'s ${rel.role}.`;
      }
      out.push({ code: 'close_relatives', kind: rel.kind, confirm: CONFIRM.has(rel.kind), text });
    }
  }

  if (settings.coiOver) {
    const coi = kin.litterCoi(sireId, damId, { recordedCoi: opts.recordedCoi });
    const line = settings.coiLine / 100;
    if (coi.value > line + 1e-9) {
      out.push({
        code: 'coi_over',
        confirm: false,
        coi: coi.value,
        source: coi.source,
        line,
        text: `Litter COI ${percentText(coi.value)}${coi.source === 'recorded' ? ' (recorded)' : ''}, over your ${percentText(line)}.`
      });
    }
  }

  if (settings.carriers && opts.markers) {
    const get = (id) => (opts.markers instanceof Map ? opts.markers.get(id) : opts.markers[id]) || [];
    const sireRes = new Map();
    for (const m of get(sireId)) {
      const key = String(m?.marker || '').trim().toLowerCase();
      if (key && AT_RISK.has(m.result)) sireRes.set(key, m);
    }
    for (const m of get(damId)) {
      const key = String(m?.marker || '').trim().toLowerCase();
      const s = sireRes.get(key);
      if (!key || !s || !AT_RISK.has(m.result)) continue;
      const share = affectedShare(s.result, m.result);
      out.push({
        code: 'carriers',
        confirm: false,
        marker: s.marker,
        share,
        text: `${nameOf(sireId)} and ${nameOf(damId)} both carry ${s.marker} (${s.result} × ${m.result}): about ${percentText(share)} of pups affected on average.`
      });
      sireRes.delete(key);
    }
  }

  return out;
}

// True when any warning asks her to confirm before the pairing saves (D2).
export function needsConfirm(warnings) {
  return (warnings || []).some((w) => w.confirm);
}
