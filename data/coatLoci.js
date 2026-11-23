// coatLoci.js — the coat genes shipped as reference (Line Management plan §3.3). Its own
// module rather than vocab.js, which every page loads: only the color list and what a dog
// carries read it. Pure data.

// The coat loci shipped as reference (plan §3.3). A color on her list may link to them
// (`colors.genotype[]`, `{ locus, alleles: 'e/e' }`); only linked colors feed what a dog
// is inferred to carry (Phase 4). Alleles are listed most dominant first, with the codes
// stored (plain ASCII) and how they're written. `shows` says what the allele does; `flag`
// marks a genotype she should be warned about. Breed-specific loci can be added later.
export const COAT_LOCI = Object.freeze([
  { locus: 'E', name: 'Extension (MC1R)', alleles: [
    { code: 'Em', label: 'Eᴹ', shows: 'a black mask on the muzzle' },
    { code: 'E',  label: 'E',  shows: 'normal: black or brown pigment in the coat' },
    { code: 'e',  label: 'e',  shows: 'with two copies (e/e), no black or brown in the coat: yellow, red or cream' }
  ] },
  { locus: 'K', name: 'Dominant black (CBD103)', alleles: [
    { code: 'KB',  label: 'Kᴮ',  shows: 'solid color, hiding the A locus' },
    { code: 'kbr', label: 'kᵇʳ', shows: 'brindle over the A locus pattern' },
    { code: 'ky',  label: 'kʸ',  shows: 'with two copies (ky/ky), the A locus pattern shows' }
  ] },
  { locus: 'A', name: 'Agouti (ASIP)', alleles: [
    { code: 'ay', label: 'aʸ', shows: 'sable or fawn' },
    { code: 'aw', label: 'aʷ', shows: 'wild sable (agouti)' },
    { code: 'at', label: 'aᵗ', shows: 'tan points' },
    { code: 'a',  label: 'a',  shows: 'with two copies (a/a), recessive black' }
  ] },
  { locus: 'B', name: 'Brown (TYRP1)', alleles: [
    { code: 'B', label: 'B', shows: 'black pigment' },
    { code: 'b', label: 'b', shows: 'with two copies (b/b), brown: chocolate or liver, nose included' }
  ] },
  { locus: 'D', name: 'Dilute (MLPH)', alleles: [
    { code: 'D', label: 'D', shows: 'full color' },
    { code: 'd', label: 'd', shows: 'with two copies (d/d), dilute: black to blue, brown to lilac' }
  ] },
  { locus: 'S', name: 'White spotting (MITF)', alleles: [
    { code: 'S',  label: 'S',  shows: 'solid, little or no white' },
    { code: 'sp', label: 'sᵖ', shows: 'with two copies (sp/sp), piebald or parti' }
  ] },
  { locus: 'M', name: 'Merle (PMEL)', alleles: [
    { code: 'M', label: 'M', shows: 'merle' },
    { code: 'm', label: 'm', shows: 'not merle' }
  ], flag: { alleles: 'M/M', text: 'Double merle: a risk of deafness and eye defects.' } }
]);

// What a color she adds is usually, to offer as a link ("Yellow is usually e/e. Link
// it?", plan §3.3). Matched on the name, any case; a suggestion only, never applied
// by itself. Names that mean different genes in different breeds are left out.
export const COLOR_GENOTYPE_SUGGESTIONS = Object.freeze({
  yellow:    [{ locus: 'E', alleles: 'e/e' }],
  red:       [{ locus: 'E', alleles: 'e/e' }],
  chocolate: [{ locus: 'B', alleles: 'b/b' }],
  liver:     [{ locus: 'B', alleles: 'b/b' }],
  brown:     [{ locus: 'B', alleles: 'b/b' }],
  blue:      [{ locus: 'D', alleles: 'd/d' }],
  lilac:     [{ locus: 'B', alleles: 'b/b' }, { locus: 'D', alleles: 'd/d' }],
  isabella:  [{ locus: 'B', alleles: 'b/b' }, { locus: 'D', alleles: 'd/d' }],
  merle:     [{ locus: 'M', alleles: 'M/m' }],
  parti:     [{ locus: 'S', alleles: 'sp/sp' }],
  piebald:   [{ locus: 'S', alleles: 'sp/sp' }]
});
