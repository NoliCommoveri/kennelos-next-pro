// birthRecordRepo.js — all Dexie access for `birth_records`, one per pup born (Line
// Management plan §3.4, D5; rules in data/birthRecords.js). Every write keeps the litter's
// puppies_born_* counts equal to its records (birthRecords.countChanges), through
// litterRepo, so older builds, reports and the tidy-up keep reading the counts. A live pup
// becomes a Dog with makeDog; a stillborn pup never does.
import { db } from './db.js';
import { makeRepo } from './repoBase.js';
import { BIRTH_RECORD_REFERENCES } from './referenceRegistry.js';
import { cleanBirthRecord, birthRecordProblem, countChanges, nextBirthOrder, sortBirthRecords, dogFromBirthRecord } from './birthRecords.js';
import { litterRepo } from './litterRepo.js';
import { dogRepo } from './dogRepo.js';

const base = makeRepo('birth_records', BIRTH_RECORD_REFERENCES);

const forLitter = (litterId, { includeArchived = true } = {}) => db.birth_records.where('litter_id').equals(litterId).toArray()
  .then((rows) => (includeArchived ? rows : rows.filter((r) => !r.is_archived)));

async function check(row, exceptId = null) {
  const problem = birthRecordProblem(row);
  if (problem) throw new Error(problem);
  if (!(await db.litters.get(row.litter_id))) throw new Error('That litter isn\'t on this device.');
  if (row.dog_id) {
    const other = (await db.birth_records.where('dog_id').equals(row.dog_id).toArray()).find((r) => r.id !== exceptId && !r.is_archived);
    if (other) throw new Error('That dog already has a birth record.');
  }
}

// The litter's counts, rewritten from its records when they differ.
async function syncCounts(litterId) {
  const litter = await db.litters.get(litterId);
  if (!litter) return;
  const changes = countChanges(litter, await forLitter(litterId));
  if (changes) await litterRepo.update(litterId, changes);
}

export const birthRecordRepo = {
  ...base,

  // A new pup is numbered after the last unless it says its place.
  async create(data) {
    const row = cleanBirthRecord(data);
    if (row.birth_order == null) row.birth_order = nextBirthOrder(await forLitter(row.litter_id));
    await check(row);
    const made = await base.create(row);
    await syncCounts(made.litter_id);
    return made;
  },

  async update(id, changes) {
    const existing = await db.birth_records.get(id);
    if (!existing) throw new Error(`birth_records: no record with id ${id}`);
    const next = cleanBirthRecord({ ...existing, ...changes });
    await check(next, id);
    const saved = await base.update(id, next);
    await syncCounts(saved.litter_id);
    if (existing.litter_id !== saved.litter_id) await syncCounts(existing.litter_id);
    return saved;
  },

  // archive / unarchive go through update, so the counts follow.
  archive(id) { return this.update(id, { is_archived: true }); },
  unarchive(id) { return this.update(id, { is_archived: false }); },

  async hardDelete(id) {
    const existing = await db.birth_records.get(id);
    await base.hardDelete(id);
    if (existing) await syncCounts(existing.litter_id);
  },

  // A litter's records in birth order (archived left out unless asked).
  async forLitter(litterId, { includeArchived = false } = {}) {
    return sortBirthRecords(await forLitter(litterId, { includeArchived }));
  },

  // The record a dog was born as, or undefined.
  async forDog(dogId) {
    return (await db.birth_records.where('dog_id').equals(dogId).toArray()).find((r) => !r.is_archived);
  },

  // A live pup becomes a Dog (D5): made from the litter with the pup's sex and color, then
  // linked. `fields` are hers (call name, …). → { record, dog }
  async makeDog(id, fields = {}) {
    const record = await db.birth_records.get(id);
    if (!record) throw new Error(`birth_records: no record with id ${id}`);
    const litter = await db.litters.get(record.litter_id);
    const dam = litter?.dam_id ? await db.dogs.get(litter.dam_id) : null;
    const dog = await dogRepo.create(dogFromBirthRecord(record, litter, dam, fields));
    return { record: await this.update(id, { dog_id: dog.id }), dog };
  }
};
