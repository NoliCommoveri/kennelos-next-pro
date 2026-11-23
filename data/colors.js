// colors.js — the rules for her own color list (Line Management plan §3.3, D5, D11).
// Pure: rows in, answers out; colorRepo.js reads and writes the `colors` table.
//
// A row: { id, name, kind ('color' | 'marking', COLOR_KIND), genotype: [{ locus,
// alleles: 'e/e' }] (optional links to the shipped COAT_LOCI), sort_order, is_archived }.
// Program-wide, like contacts. A dog has one color (Dog.color_id) and any number of
// markings (Dog.marking_ids); its old free text, Dog.color_markings, stays as display text
// (a shipped field) until a tidy-up matches it to her list for her to confirm (D11).
import { COLOR_KIND } from './vocab.js';
import { COAT_LOCI, COLOR_GENOTYPE_SUGGESTIONS } from './coatLoci.js';

export const COLOR_KINDS = COLOR_KIND.map((k) => k.value);
const LOCI = new Map(COAT_LOCI.map((l) => [l.locus, l]));

// The name as compared: trimmed, spaces collapsed, any case.
export const normColorName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// One genotype link, cleaned: { locus, alleles: 'x/y' } with the allele codes as COAT_LOCI
// writes them, or null when it isn't one ("E", "e / e" and "e/E" all read).
export function cleanGenotypeLink(link) {
  const locus = LOCI.get(String(link?.locus ?? '').trim().toUpperCase());
  if (!locus) return null;
  const parts = String(link?.alleles ?? '').split('/').map((x) => x.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const codes = locus.alleles.map((a) => a.code);
  const exact = (p) => codes.find((c) => c === p) ?? codes.find((c) => c.toLowerCase() === p.toLowerCase() && codes.filter((x) => x.toLowerCase() === p.toLowerCase()).length === 1);
  const found = parts.map(exact);
  if (found.some((c) => !c)) return null;
  // Most dominant first, the way they're written (E/e, not e/E).
  found.sort((a, b) => codes.indexOf(a) - codes.indexOf(b));
  return { locus: locus.locus, alleles: found.join('/') };
}

// A row ready to store: the name trimmed, the kind defaulted, genotype links cleaned.
export function cleanColor(row = {}) {
  const out = { ...row, name: String(row.name ?? '').trim().replace(/\s+/g, ' '), kind: row.kind || 'color' };
  if (row.genotype != null) out.genotype = (Array.isArray(row.genotype) ? row.genotype : []).map((g) => cleanGenotypeLink(g) || g);
  if (row.sort_order != null && row.sort_order !== '') out.sort_order = Number(row.sort_order);
  return out;
}

// Why a row can't be saved, as a sentence, or '' when it can.
export function colorProblem(row) {
  if (!String(row?.name ?? '').trim()) return 'A color needs a name.';
  if (!COLOR_KINDS.includes(row.kind)) return `A color's kind must be one of ${COLOR_KINDS.join(', ')}.`;
  if (row.genotype != null && !Array.isArray(row.genotype)) return 'A color\'s gene links must be a list.';
  const seen = new Set();
  for (const g of row.genotype || []) {
    const c = cleanGenotypeLink(g);
    if (!c || c.alleles !== g.alleles || c.locus !== g.locus) return `“${g?.locus ?? ''} ${g?.alleles ?? ''}” isn't a gene link (a locus from ${[...LOCI.keys()].join(', ')} and two of its alleles, like e/e).`;
    if (seen.has(c.locus)) return `${row.name} links the ${c.locus} locus twice.`;
    seen.add(c.locus);
  }
  if (row.sort_order != null && !Number.isFinite(Number(row.sort_order))) return 'A color\'s place in the list must be a number.';
  return '';
}

// The entry on her list with this name and kind (not archived), or null: what + Add a
// color finds instead of making a second "Black".
export function findColor(colors, name, kind = 'color') {
  const key = normColorName(name);
  return (colors || []).find((c) => !c.is_archived && c.kind === kind && normColorName(c.name) === key) || null;
}

// Her list in the order she set, then A–Z. `kind` narrows it; archived rows are left out
// unless `includeArchived`.
export function sortColors(colors, { kind = null, includeArchived = false } = {}) {
  return (colors || [])
    .filter((c) => (includeArchived || !c.is_archived) && (!kind || c.kind === kind))
    .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity)
      || String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base', numeric: true }));
}

// The gene links to offer for a color she adds ("Yellow is usually e/e. Link it?"), from
// its whole name first, else from a word in it ("Dark chocolate"). [] when there's none.
export function suggestGenotype(name) {
  const key = normColorName(name);
  const hit = COLOR_GENOTYPE_SUGGESTIONS[key]
    ?? key.split(/[^a-z]+/).map((w) => COLOR_GENOTYPE_SUGGESTIONS[w]).find(Boolean);
  return hit ? hit.map((g) => ({ ...g })) : [];
}

// What a color's links warn about (a double merle): [{ locus, text }].
export function genotypeFlags(genotype) {
  const out = [];
  for (const g of genotype || []) {
    const flag = LOCI.get(g?.locus)?.flag;
    if (flag && g.alleles === flag.alleles) out.push({ locus: g.locus, text: flag.text });
  }
  return out;
}

// --- A dog's color ----------------------------------------------------------------------

// The words a dog's color is shown as: her chosen color and markings when it has them,
// else its old text (D7: shown only where color_markings is shown today).
export function dogColorText(dog, colorsById) {
  const get = (id) => (colorsById instanceof Map ? colorsById.get(id) : colorsById?.[id]);
  const color = dog?.color_id ? get(dog.color_id) : null;
  const marks = (dog?.marking_ids || []).map(get).filter(Boolean);
  if (color || marks.length) return [color?.name, ...marks.map((m) => m.name)].filter(Boolean).join(', ');
  return String(dog?.color_markings ?? '').trim();
}

// Connecting words left over after the names are found aren't something unmatched.
const FILLER = new Set(['and', 'with', 'w', 'on', 'n', 'a']);
const words = (s) => normColorName(s).split(/[^a-z0-9]+/).filter(Boolean);

// Her list matched against a dog's old free text (D11): the color whose name is in the
// text (the longest, when two are, "Dark chocolate" over "Chocolate"), every marking whose
// name is, and the words left over. → { color_id, marking_ids, leftover: [words], exact }.
// `exact`: nothing but connecting words left. Names match as whole words, any case.
export function matchColorText(text, colors) {
  const t = words(text);
  const used = new Array(t.length).fill(false);
  const findAt = (name) => {
    const n = words(name);
    if (!n.length) return -1;
    for (let i = 0; i + n.length <= t.length; i++) {
      if (n.every((w, k) => t[i + k] === w && !used[i + k])) return i;
    }
    return -1;
  };
  const take = (c) => {
    const i = findAt(c.name);
    if (i < 0) return false;
    for (let k = 0; k < words(c.name).length; k++) used[i + k] = true;
    return true;
  };
  const active = sortColors(colors);
  const byLength = (list) => [...list].sort((a, b) => words(b.name).length - words(a.name).length);
  // Markings first, longest name first, so "Black and tan" (a marking) isn't read as Black.
  const marking_ids = byLength(active.filter((c) => c.kind === 'marking')).filter(take).map((c) => c.id);
  const color = byLength(active.filter((c) => c.kind === 'color')).find(take) || null;
  const leftover = t.filter((w, i) => !used[i] && !FILLER.has(w));
  return { color_id: color?.id ?? null, marking_ids, leftover, exact: !!(color || marking_ids.length) && !leftover.length };
}

// The tidy-up's suggestions (D11): each dog with old color text and nothing chosen from
// her list yet, where her list matches some of it, for her to confirm.
// → [{ dog_id, text, color_id, marking_ids, leftover, exact }]
export function colorTidySuggestions(dogs, colors) {
  const out = [];
  for (const d of dogs || []) {
    if (d.is_archived || d.color_id || (d.marking_ids || []).length) continue;
    const text = String(d.color_markings ?? '').trim();
    if (!text) continue;
    const m = matchColorText(text, colors);
    if (m.color_id || m.marking_ids.length) out.push({ dog_id: d.id, text, ...m });
  }
  return out;
}
