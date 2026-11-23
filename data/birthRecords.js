// birthRecords.js — the rules for a litter's birth records (Line Management plan §3.4, D5).
// Pure: rows in, answers out; birthRecordRepo.js reads and writes the `birth_records`
// table.
//
// One row per pup born, stillborn included: { id, litter_id, birth_order, birth_time (a
// display string, like a placement's time), sex (SEX), color_id, marking_ids[] (her color
// list), birth_weight (ounces), born_alive, dog_id (once it's a Dog), died_on (YYYY-MM-DD) +
// death_cause (PUP_DEATH_CAUSE), abnormalities[] (ABNORMALITY_TYPES), notes, is_archived }.
// A live pup becomes a Dog (its sex and color carried over) linked by dog_id; a stillborn
// pup never does. Once a litter has birth records, its puppies_born_* counts are written
// from them (litterCounts), so older builds and every report keep reading the counts.
import { SEX, PUP_DEATH_CAUSE, ABNORMALITY_TYPES } from './vocab.js';
import { baseFromLitter } from './puppyDefaults.js';

const SEXES = SEX.map((s) => s.value);
const CAUSES = PUP_DEATH_CAUSE.map((c) => c.value);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const blank = (v) => v == null || (typeof v === 'string' && v.trim() === '');

// A row ready to store: lists as lists, numbers as numbers, born alive unless it says not.
export function cleanBirthRecord(row = {}) {
  const out = { ...row };
  out.born_alive = row.born_alive !== false;
  out.sex = row.sex || 'unknown';
  out.marking_ids = Array.isArray(row.marking_ids) ? row.marking_ids.filter(Boolean) : [];
  out.abnormalities = Array.isArray(row.abnormalities) ? row.abnormalities.filter(Boolean) : [];
  for (const k of ['birth_order', 'birth_weight']) out[k] = blank(row[k]) ? null : Number(row[k]);
  for (const k of ['color_id', 'dog_id', 'died_on', 'death_cause', 'birth_time']) if (blank(row[k])) out[k] = null;
  return out;
}

// Why a row can't be saved, as a sentence, or '' when it can.
export function birthRecordProblem(r) {
  if (blank(r?.litter_id)) return 'A birth record belongs to a litter.';
  if (!SEXES.includes(r.sex)) return `A pup's sex must be one of ${SEXES.join(', ')}.`;
  if (r.birth_order != null && !(Number.isInteger(r.birth_order) && r.birth_order > 0)) return 'Birth order is a whole number from 1.';
  if (r.birth_weight != null && !(Number.isFinite(r.birth_weight) && r.birth_weight > 0)) return 'Birth weight is a number of ounces above 0.';
  if (r.died_on != null && !YMD.test(r.died_on)) return 'The date a pup died is a date (YYYY-MM-DD).';
  if (r.death_cause != null && !CAUSES.includes(r.death_cause)) return `The cause must be one of ${CAUSES.join(', ')}.`;
  if (r.death_cause != null && r.born_alive && r.died_on == null) return 'A cause of death goes with the date the pup died.';
  const unknown = (r.abnormalities || []).filter((a) => !ABNORMALITY_TYPES.includes(a));
  if (unknown.length) return `“${unknown[0]}” isn't one of the abnormalities the app knows.`;
  if (!r.born_alive && r.dog_id) return 'A pup born without life isn\'t a dog record.';
  return '';
}

// Of the litter's birth records (archived left out), the numbers its puppies_born_* fields
// hold: born in all, born alive, born deceased, and born with an abnormality.
export function litterCounts(records) {
  const live = (records || []).filter((r) => !r.is_archived);
  return {
    puppies_born_total: live.length,
    puppies_born_alive: live.filter((r) => r.born_alive !== false).length,
    puppies_born_deceased: live.filter((r) => r.born_alive === false).length,
    puppies_born_abnormalities: live.filter((r) => (r.abnormalities || []).length).length
  };
}

// The counts to write to a litter, or null when they're what it has already. A litter with
// no birth records keeps the counts typed on it (Lite, and every litter before Phase 2).
export function countChanges(litter, records) {
  const live = (records || []).filter((r) => !r.is_archived);
  if (!live.length) return null;
  const next = litterCounts(live);
  const changed = Object.keys(next).some((k) => Number(litter?.[k] ?? NaN) !== next[k]);
  return changed ? next : null;
}

// The next birth order for a litter: one past the highest, 1 for the first.
export function nextBirthOrder(records) {
  const n = (records || []).filter((r) => !r.is_archived).map((r) => Number(r.birth_order) || 0);
  return (n.length ? Math.max(...n) : 0) + 1;
}

// Records in birth order (unnumbered last, then by when they were added).
export function sortBirthRecords(records) {
  return [...(records || [])].sort((a, b) => (a.birth_order ?? Infinity) - (b.birth_order ?? Infinity)
    || String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

// The Dog a live pup becomes (D5): what every pup inherits from its litter (parents,
// kennel, birth date, the dam's breed: puppyDefaults.baseFromLitter, as Add Puppies does),
// the pup's sex and color carried over, undecided until she says. `fields` (her call
// name, …) are laid over it; the dog repo checks the rest.
export function dogFromBirthRecord(record, litter, dam, fields = {}) {
  if (record?.born_alive === false) throw new Error('A pup born without life isn\'t a dog record.');
  if (record?.dog_id) throw new Error('This pup is already a dog record.');
  const dog = { ...baseFromLitter(litter, dam), sex: record.sex || 'unknown', disposition: 'undecided' };
  if (record.color_id) dog.color_id = record.color_id;
  if ((record.marking_ids || []).length) dog.marking_ids = [...record.marking_ids];
  return { ...dog, ...fields };
}
