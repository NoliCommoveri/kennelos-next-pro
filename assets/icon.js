// icon.js — draws a forest-look icon (Lucide 0.460.0, shared/vendor/lucide/iconNodes.js) as
// SVG markup, the same element the prototype's icons() puts in place of <i data-lucide="…">:
// a 24×24 viewBox, no fill, currentColor stroke at 1.8, round caps and joins, hidden from
// screen readers, class "lucide lucide-<name>". Its size comes from forest.css
// (svg.lucide: 18px; larger in tabs, header buttons and tiles), never from the markup.
//
//   import { icon } from './icon.js';
//   el.innerHTML = `${icon('dog')}<span>Dogs</span>`;
import { ICON_NODES } from '../vendor/lucide/iconNodes.js';

const ATTR_ESC = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
const attr = (v) => String(v).replace(/[&"<>]/g, (c) => ATTR_ESC[c]);

/** SVG markup for a Lucide icon, or '' for a name that isn't vendored. */
export function icon(name, className = '') {
  if (!Object.hasOwn(ICON_NODES, name)) return '';
  const node = ICON_NODES[name];
  const kids = node.map(([tag, a]) =>
    `<${tag}${Object.entries(a).map(([k, v]) => ` ${k}="${attr(v)}"`).join('')}></${tag}>`).join('');
  const cls = `lucide lucide-${name}${className ? ' ' + className : ''}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${attr(cls)}">${kids}</svg>`;
}

/** Whether an icon is vendored. */
export const hasIcon = (name) => Object.hasOwn(ICON_NODES, name);
