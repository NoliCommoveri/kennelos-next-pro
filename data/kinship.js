// kinship.js — how every dog relates to every other, from the sire_id / dam_id
// links alone (docs/KennelOS_Line_Management_Plan.md §3.1, Phase 1). PURE: dogs
// in, figures out; no Dexie, no DOM. Nothing here is stored: relationships are
// derived queries (reference-registry principle), worked out again on each call.
//
// Pass EVERY dog (all kennels, all statuses, archived and pedigree-only ancestors
// included): an ancestor left out counts as unknown, and unknown ancestors count as
// unrelated, so every COI here is a floor and says how much pedigree it rests on.
//
// Units: every figure returned is a FRACTION (0.0625). A recorded COI
// (`Dog.recorded_coi`, `Pairing.recorded_coi`: { value, method, source, as_of_date })
// stores `value` as a PERCENT (6.25), as the Dog page and CSV import write it;
// `recordedFraction` converts.
//
// Kinship f(a, b), the standard recursive (tabular) method, memoised:
//   f(a, a) = ½(1 + F_a), F_a = f(sire(a), dam(a)), or the dog's recorded COI (D13);
//   f(a, b) = ½(f(sire(x), y) + f(dam(x), y)), expanding whichever of the two is
//             the later generation (it can't be the other's ancestor);
//   an unknown parent contributes 0.
// A litter's COI = f(sire, dam); a dog's COI = f(its sire, its dam). Every known
// generation counts (D12, no cap). A loop in imported data (a dog its own
// ancestor) is cut where it closes, so nothing can hang.

const PARENTS = ['sire', 'dam'];

// A recorded COI's value as a fraction, or null when there isn't a usable one.
export function recordedFraction(rec) {
  if (!rec || typeof rec !== 'object') return null;
  if (rec.value === null || rec.value === undefined || rec.value === '') return null;
  const n = Number(rec.value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n / 100;
}

// The ancestor path "sire.dam" read as "sire's dam"; '' is the dog itself.
export function pathLabel(path) {
  if (!path) return 'itself';
  return path.split('.').join("'s ");
}

// → the kinship calculator over `dogs`. Options:
//   useRecorded (default true): a dog's recorded COI stands in for its own
//   inbreeding in every figure (D13). false gives the pedigree-only figures.
export function createKinship(dogs, { useRecorded = true } = {}) {
  const byId = new Map();
  for (const d of dogs || []) if (d && d.id) byId.set(d.id, d);

  // Parent links, with any link that would close a loop cut (depth-first; an edge
  // to a dog still on the current path is dropped). `gen` is each dog's generation
  // (founders 0, a dog one past its later parent): an ancestor always has a lower one.
  const parents = new Map();
  const gen = new Map();
  const state = new Map(); // 1 = on the path, 2 = done
  function visit(id) {
    if (state.get(id) === 2) return;
    const stack = [{ id, i: 0 }];
    state.set(id, 1);
    const d = byId.get(id);
    parents.set(id, { sire: null, dam: null, raw: d ? [d.sire_id || null, d.dam_id || null] : [null, null] });
    while (stack.length) {
      const top = stack[stack.length - 1];
      const p = parents.get(top.id);
      if (top.i < 2) {
        const role = PARENTS[top.i];
        const pid = p.raw[top.i];
        top.i++;
        if (!pid || !byId.has(pid) || pid === top.id || state.get(pid) === 1) continue; // unknown or a loop
        p[role] = pid;
        if (state.get(pid) === 2) continue;
        state.set(pid, 1);
        const pd = byId.get(pid);
        parents.set(pid, { sire: null, dam: null, raw: [pd.sire_id || null, pd.dam_id || null] });
        stack.push({ id: pid, i: 0 });
      } else {
        stack.pop();
        state.set(top.id, 2);
        const gs = p.sire ? gen.get(p.sire) + 1 : 0;
        const gd = p.dam ? gen.get(p.dam) + 1 : 0;
        gen.set(top.id, Math.max(gs, gd));
        delete p.raw;
      }
    }
  }
  for (const id of byId.keys()) visit(id);

  const sireOf = (id) => (id && parents.get(id)?.sire) || null;
  const damOf = (id) => (id && parents.get(id)?.dam) || null;
  const known = (id) => Boolean(id && byId.has(id));

  const memo = new Map();
  function f(a, b) {
    if (!known(a) || !known(b)) return 0;
    if (a === b) return 0.5 * (1 + inbreeding(a));
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (memo.has(key)) return memo.get(key);
    // Expand the later generation; a later dog can't be the other's ancestor.
    const [x, y] = gen.get(a) >= gen.get(b) ? [a, b] : [b, a];
    const v = 0.5 * (f(sireOf(x), y) + f(damOf(x), y));
    memo.set(key, v);
    return v;
  }

  const inbMemo = new Map();
  function calculatedInbreeding(id) {
    if (!known(id)) return 0;
    if (inbMemo.has(id)) return inbMemo.get(id);
    inbMemo.set(id, 0); // a guard; the graph is loop-free, so never read
    const v = f(sireOf(id), damOf(id));
    inbMemo.set(id, v);
    return v;
  }
  function inbreeding(id) {
    if (useRecorded) {
      const r = recordedFraction(byId.get(id)?.recorded_coi);
      if (r !== null) return r;
    }
    return calculatedInbreeding(id);
  }

  // How many ancestors are known per generation, counting positions (a dog
  // appearing twice fills two). known(x, 0) = 1; known(x, g) = sire's + dam's at g-1.
  const knownMemo = new Map();
  function knownAt(id, g) {
    if (!known(id)) return 0;
    if (g === 0) return 1;
    const key = `${id}|${g}`;
    if (knownMemo.has(key)) return knownMemo.get(key);
    const v = knownAt(sireOf(id), g - 1) + knownAt(damOf(id), g - 1);
    knownMemo.set(key, v);
    return v;
  }
  function depthFrom(sireId, damId) {
    const generations = [];
    let complete = 0;
    let stillComplete = true;
    for (let g = 1; ; g++) {
      const k = knownAt(sireId, g - 1) + knownAt(damId, g - 1);
      if (k === 0) break;
      const possible = 2 ** g;
      generations.push({ generation: g, known: k, possible, share: k / possible });
      if (stillComplete && k === possible) complete = g; else stillComplete = false;
    }
    return { generations, complete, deepest: generations.length };
  }

  // Ancestors of `id` by generation with their paths ('sire.dam'), the dog itself
  // at '' first. `stopAt` ids aren't expanded past. Paths per ancestor are capped
  // (nearest kept) so heavy inbreeding can't blow up the walk.
  const MAX_PATHS = 8;
  function ancestorPaths(id, stopAt = null) {
    const out = new Map(); // ancestor id → [paths]
    if (!known(id)) return out;
    let row = [{ id, path: '' }];
    out.set(id, ['']);
    while (row.length) {
      const next = [];
      for (const at of row) {
        if (stopAt && stopAt.has(at.id) && at.path !== '') continue;
        for (const role of PARENTS) {
          const pid = role === 'sire' ? sireOf(at.id) : damOf(at.id);
          if (!pid) continue;
          const path = at.path ? `${at.path}.${role}` : role;
          const list = out.get(pid) || [];
          if (list.length >= MAX_PATHS) continue;
          list.push(path);
          out.set(pid, list);
          next.push({ id: pid, path });
        }
      }
      row = next;
    }
    return out;
  }

  function sharedAncestors(a, b) {
    if (!known(a) || !known(b) || a === b) return [];
    const common = new Set();
    const ancA = ancestorPaths(a);
    const ancB = ancestorPaths(b);
    for (const id of ancA.keys()) if (ancB.has(id)) common.add(id);
    if (!common.size) return [];
    // Nearest only: walk again, not expanding past a common ancestor, so one whose
    // own ancestors are also common is listed instead of them.
    const nearA = ancestorPaths(a, common);
    const nearB = ancestorPaths(b, common);
    const list = [];
    for (const id of common) {
      const pa = nearA.get(id);
      const pb = nearB.get(id);
      if (!pa || !pb) continue;
      const len = (p) => (p ? p.split('.').length : 0);
      const nearest = Math.min(...pa.map(len)) + Math.min(...pb.map(len));
      list.push({ id, pathsFromA: pa, pathsFromB: pb, generations: nearest });
    }
    return list.sort((x, y) => x.generations - y.generations || String(x.id).localeCompare(String(y.id)));
  }

  // 'full' | 'half' | null: x and y share both known parents, or one. `certain` is
  // false for a half when the other parent is unknown on either side (could be full).
  function siblings(x, y) {
    if (!known(x) || !known(y) || x === y) return null;
    const sx = sireOf(x), dx = damOf(x), sy = sireOf(y), dy = damOf(y);
    const sameSire = Boolean(sx && sx === sy);
    const sameDam = Boolean(dx && dx === dy);
    if (sameSire && sameDam) return { kind: 'full', certain: true };
    if (sameSire) return { kind: 'half', certain: Boolean(dx && dy), shared: sx };
    if (sameDam) return { kind: 'half', certain: Boolean(sx && sy), shared: dx };
    return null;
  }
  const parentsOf = (id) => [sireOf(id), damOf(id)].filter(Boolean);
  const grandparentsOf = (id) => parentsOf(id).flatMap(parentsOf);

  // The closest named relationship between a and b, from a's side:
  //   { kind, role, inverse, through? , certain? }
  // `kind`: same | parent (b is a's parent) | child (b is a's offspring) |
  //   full_sibling | half_sibling | grandparent | grandchild | aunt_uncle (b is a
  //   parent's sibling) | half_aunt_uncle | niece_nephew | half_niece_nephew |
  //   first_cousin | half_first_cousin | related (through the nearest shared
  //   ancestor) | none.
  // `role` names A as B's relative, by A's sex ("Ivy is Ash's daughter"); `inverse`
  // names B as A's relative, by B's sex.
  function relationship(a, b) {
    if (!known(a) || !known(b)) return { kind: 'none', role: null, inverse: null };
    if (a === b) return { kind: 'same', role: null, inverse: null };
    const sexA = byId.get(a).sex, sexB = byId.get(b).sex;
    const name = (kind, sex) => roleName(kind, sex);
    const out = (kind, invKind, extra = {}) => ({ kind, role: name(invKind, sexA), inverse: name(kind, sexB), ...extra });

    if (parentsOf(a).includes(b)) return out('parent', 'child');
    if (parentsOf(b).includes(a)) return out('child', 'parent');
    const sib = siblings(a, b);
    if (sib) return sib.kind === 'full' ? out('full_sibling', 'full_sibling') : out('half_sibling', 'half_sibling', { certain: sib.certain });
    if (grandparentsOf(a).includes(b)) return out('grandparent', 'grandchild');
    if (grandparentsOf(b).includes(a)) return out('grandchild', 'grandparent');
    // b a sibling of one of a's parents, or the reverse.
    const auntOf = (x, y) => { // y is x's parent's sibling → 'full' | 'half' | null
      let best = null;
      for (const p of parentsOf(x)) {
        const s = siblings(p, y);
        if (s?.kind === 'full') return 'full';
        if (s) best = 'half';
      }
      return best;
    };
    const au = auntOf(a, b);
    if (au) return au === 'full' ? out('aunt_uncle', 'niece_nephew') : out('half_aunt_uncle', 'half_niece_nephew');
    const nn = auntOf(b, a);
    if (nn) return nn === 'full' ? out('niece_nephew', 'aunt_uncle') : out('half_niece_nephew', 'half_aunt_uncle');
    // A parent of each are siblings.
    let cousin = null;
    for (const pa of parentsOf(a)) {
      for (const pb of parentsOf(b)) {
        const s = siblings(pa, pb);
        if (s?.kind === 'full') cousin = 'full';
        else if (s && !cousin) cousin = 'half';
      }
    }
    if (cousin) return cousin === 'full' ? out('first_cousin', 'first_cousin') : out('half_first_cousin', 'half_first_cousin');
    const shared = sharedAncestors(a, b);
    if (shared.length) return { kind: 'related', role: null, inverse: null, through: shared[0].id };
    return { kind: 'none', role: null, inverse: null };
  }

  // A pairing's (or a would-be litter's) COI, with a recorded figure overriding
  // the calculated one (D13). → { value, source: 'recorded'|'calculated',
  //   calculated (with dogs' recorded COIs), pedigreeOnly (none of them),
  //   recorded (fraction or null), depth (a pup's pedigree from this pair), gap }.
  // `gap` is 'above' / 'below' when a recorded figure is well away from the
  // calculated one (2 points and a quarter of it, or anything over a calculated 0).
  function litterCoi(sireId, damId, { recordedCoi = null } = {}) {
    const calculated = f(sireId, damId);
    const pedigreeOnly = useRecorded ? createPlain().kinship(sireId, damId) : calculated;
    const recorded = recordedFraction(recordedCoi);
    let gap = null;
    if (recorded !== null) {
      const diff = recorded - calculated;
      const wide = Math.abs(diff) >= 0.02 && (calculated === 0 || Math.abs(diff) / calculated >= 0.25);
      if (wide) gap = diff > 0 ? 'above' : 'below';
    }
    return {
      value: recorded !== null ? recorded : calculated,
      source: recorded !== null ? 'recorded' : 'calculated',
      calculated,
      pedigreeOnly,
      recorded,
      depth: depthFrom(known(sireId) ? sireId : null, known(damId) ? damId : null),
      gap
    };
  }

  // A dog's own COI: its recorded one if there is one, the calculated one beside it.
  function dogCoi(id) {
    const d = byId.get(id);
    const c = litterCoi(sireOf(id), damOf(id), { recordedCoi: d?.recorded_coi });
    return c;
  }

  // r = 2f / √((1 + F_a)(1 + F_b)): "related 25%".
  function relatedness(a, b) {
    if (!known(a) || !known(b)) return 0;
    if (a === b) return 1;
    return (2 * f(a, b)) / Math.sqrt((1 + inbreeding(a)) * (1 + inbreeding(b)));
  }

  let plain = null;
  function createPlain() {
    if (!plain) plain = createKinship([...byId.values()], { useRecorded: false });
    return plain;
  }

  return {
    kinship: f,
    inbreeding,
    calculatedInbreeding,
    litterCoi,
    dogCoi,
    relatedness,
    relationship,
    sharedAncestors,
    pedigreeDepth: (id) => depthFrom(sireOf(id), damOf(id)),
    siblings,
    has: known
  };
}

// The word for a relationship kind, by sex (null sex → neutral).
const ROLE_NAMES = {
  parent: ['sire', 'dam', 'parent'],
  child: ['son', 'daughter', 'offspring'],
  full_sibling: ['full brother', 'full sister', 'full sibling'],
  half_sibling: ['half brother', 'half sister', 'half sibling'],
  grandparent: ['grandsire', 'granddam', 'grandparent'],
  grandchild: ['grandson', 'granddaughter', 'grandchild'],
  aunt_uncle: ['uncle', 'aunt', "parent's sibling"],
  half_aunt_uncle: ['half uncle', 'half aunt', "parent's half sibling"],
  niece_nephew: ['nephew', 'niece', "sibling's offspring"],
  half_niece_nephew: ['half nephew', 'half niece', "half sibling's offspring"],
  first_cousin: ['first cousin', 'first cousin', 'first cousin'],
  half_first_cousin: ['half first cousin', 'half first cousin', 'half first cousin']
};
export function roleName(kind, sex) {
  const names = ROLE_NAMES[kind];
  if (!names) return null;
  return sex === 'male' ? names[0] : sex === 'female' ? names[1] : names[2];
}
