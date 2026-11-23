// colorRepo.js — all Dexie access for `colors`, her own color list (Line Management plan
// §3.3; rules in data/colors.js). Program-wide, like contacts. A color or marking in use
// (by a dog, a birth record or a waitlist family's preference) can't be hard-deleted, only
// archived: it then leaves the dropdowns and still names the dogs that have it.
import { db } from './db.js';
import { makeRepo } from './repoBase.js';
import { COLOR_REFERENCES } from './referenceRegistry.js';
import { cleanColor, colorProblem, findColor, sortColors } from './colors.js';

const base = makeRepo('colors', COLOR_REFERENCES);

async function check(row, exceptId = null) {
  const problem = colorProblem(row);
  if (problem) throw new Error(problem);
  const dup = findColor((await base.getAll()).filter((c) => c.id !== exceptId), row.name, row.kind);
  if (dup && !row.is_archived) throw new Error(`“${dup.name}” is already on your ${row.kind === 'marking' ? 'markings' : 'colors'}.`);
}

export const colorRepo = {
  ...base,

  // A new entry goes at the end of its kind's list unless it says where.
  async create(data) {
    const row = cleanColor(data);
    if (row.sort_order == null) {
      const mine = (await base.getAll({ includeArchived: true })).filter((c) => c.kind === row.kind);
      row.sort_order = mine.reduce((m, c) => Math.max(m, Number(c.sort_order) || 0), 0) + 1;
    }
    if (row.genotype == null) row.genotype = [];
    await check(row);
    return base.create(row);
  },

  async update(id, changes) {
    const existing = await db.colors.get(id);
    if (!existing) throw new Error(`colors: no record with id ${id}`);
    const next = cleanColor({ ...existing, ...changes });
    await check(next, id);
    return base.update(id, next);
  },

  // Bringing one back can't make a second of the same name.
  async unarchive(id) {
    const existing = await db.colors.get(id);
    if (!existing) throw new Error(`colors: no record with id ${id}`);
    await check({ ...existing, is_archived: false }, id);
    return base.unarchive(id);
  },

  // + Add a color (plan §3.3): the entry with this name, made if her list doesn't have it,
  // so a dropdown never adds a second "Black" while she's mid-whelp.
  async findOrAdd(name, kind = 'color') {
    const found = findColor(await base.getAll(), name, kind);
    return found || this.create({ name, kind });
  },

  // One kind, in her order (a dropdown's options).
  async list(kind = null, { includeArchived = false } = {}) {
    return sortColors(await base.getAll({ includeArchived }), { kind, includeArchived });
  }
};
