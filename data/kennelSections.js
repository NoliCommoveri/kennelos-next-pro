// kennelSections.js — the cards the Kennel page (pages/kennel.html) can show, one at a time,
// alphabetical by label. `when` says whether a kennel has it (own-kennel cards, an edition
// flag, a received kennel card). The page's section picker lists them, and search
// (data/searchIndex.js) offers them as settings, opening kennel.html?id=…#<key>.
import { editionFlags } from './editionConfig.js';

export const KENNEL_SECTIONS = [
  { key: 'litters', label: 'Active litters', when: (k) => k.is_own_kennel },
  { key: 'feeding', label: 'Feeding schedules', when: (k) => k.is_own_kennel },
  { key: 'finances', label: 'Finances', when: (k) => k.is_own_kennel },
  { key: 'card', label: 'Kennel card', when: (k) => k.is_own_kennel || !!k.public_id },
  { key: 'expenses', label: 'Kennel expenses', when: () => true },
  { key: 'extra-charges', label: 'Extra charges price list', when: (k) => k.is_own_kennel && editionFlags.extraCharges },
  { key: 'nudges', label: 'Lifecycle nudges', when: (k) => k.is_own_kennel },
  { key: 'payment-schedules', label: 'Payment schedules', when: (k) => k.is_own_kennel },
  { key: 'logo', label: 'Logo', when: () => true },
  { key: 'tests', label: 'Preferred tests', when: (k) => k.is_own_kennel },
  { key: 'puppy-record', label: 'Puppy Record fields', when: (k) => k.is_own_kennel && editionFlags.puppyRecord },
  { key: 'placements', label: 'Recent placements', when: (k) => k.is_own_kennel },
  { key: 'pickup', label: 'Pickup & transport', when: (k) => k.is_own_kennel && editionFlags.waitlist },
  { key: 'roster', label: 'Roster', when: (k) => k.is_own_kennel },
  { key: 'waitlist-settings', label: 'Waitlist settings', when: (k) => k.is_own_kennel && editionFlags.waitlist }
].sort((a, b) => a.label.localeCompare(b.label));
