import { DIMS, Kind, Shape, shapeFor, seeded, toneFor } from './numbers';

export const B = 100; // block size in character units
const INK = '#2b2140';
const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return node;
}

/** A hand-drawn looking rounded square: every corner and edge wanders a little. */
export function wobblyRect(x: number, y: number, w: number, h: number, rnd: () => number, amp = 2.5): string {
  const j = () => (rnd() - 0.5) * 2 * amp;
  const r = Math.min(w, h) * 0.16;
  const p = (a: number, b: number) => `${(a + j()).toFixed(1)} ${(b + j()).toFixed(1)}`;
  return [
    `M${p(x + r, y)}`,
    `Q${p(x + w / 2, y)} ${p(x + w - r, y)}`,
    `Q${p(x + w, y)} ${p(x + w, y + r)}`,
    `Q${p(x + w, y + h / 2)} ${p(x + w, y + h - r)}`,
    `Q${p(x + w, y + h)} ${p(x + w - r, y + h)}`,
    `Q${p(x + w / 2, y + h)} ${p(x + r, y + h)}`,
    `Q${p(x, y + h)} ${p(x, y + h - r)}`,
    `Q${p(x, y + h / 2)} ${p(x, y + r)}`,
    `Q${p(x, y)} ${p(x + r, y)}Z`,
  ].join(' ');
}

interface PieceNode {
  g: SVGGElement;
  pop: SVGGElement;
  tone: number;
  paint: (tone: number) => void;
}

export interface Bounds {
  width: number;
  height: number;
}

// Big pieces keep crisp outlines at any zoom: their strokes are in screen pixels.
const CRISP = { 'vector-effect': 'non-scaling-stroke' };

/** Lines every `step` blocks across the front, top and side of a w x h x d prism. */
function prismLines(w: number, h: number, d: number, step: number): { front: string; back: string } {
  const W = w * B, H = h * B, D = d * B;
  let front = '';
  let back = '';
  if (!step) return { front, back };
  for (let i = step; i < w; i += step) front += `M${i * B} 0 L${i * B} ${H} `;
  for (let j = step; j < h; j += step) front += `M0 ${j * B} L${W} ${j * B} `;
  if (D) {
    // the depth splits into ten for a cube of blocks or a giant cube of cubes; rods and slabs are one cube deep
    const parts = (w === 10 && h === 10) || d === 40 ? 10 : 1;
    for (let i = step; i < w; i += step) back += `M${i * B} 0 L${i * B + D} ${-D} `;
    for (let j = step; j < h; j += step) back += `M${W} ${j * B} L${W + D} ${j * B - D} `;
    for (let k = 1; k < parts; k++) {
      const f = (k / parts) * D;
      back += `M${f} ${-f} L${W + f} ${-f} M${W + f} ${-f} L${W + f} ${H - f} `;
    }
  }
  return { front, back };
}

export class Pal {
  readonly root: SVGGElement;
  private bob: SVGGElement;
  private pieces = new Map<string, PieceNode>();
  private layer: SVGGElement;
  private face: SVGGElement;
  private mouth: SVGPathElement;
  private armL: SVGGElement;
  private armR: SVGGElement;
  private mitts: SVGCircleElement[] = [];
  private feet: SVGGElement;
  private ghost: SVGGElement;
  shape: Shape = shapeFor(0);

  constructor(parent: SVGElement) {
    this.root = el('g', { class: 'pal' }, parent);
    this.bob = el('g', { class: 'bob' }, this.root);
    this.feet = el('g', { class: 'feet' }, this.bob);
    this.armL = this.makeArm(-1);
    this.armR = this.makeArm(1);
    this.layer = el('g', { class: 'blocks' }, this.bob);
    this.ghost = el('g', { class: 'ghost' }, this.bob);
    el('path', { d: wobblyRect(-B / 2, -B, B, B, seeded(99), 3), fill: '#ffffff', 'fill-opacity': 0.35, stroke: INK, 'stroke-width': 5, 'stroke-dasharray': '14 12', 'stroke-linecap': 'round' }, this.ghost);
    this.face = el('g', { class: 'face' }, this.bob);
    const eyes = el('g', { class: 'eyes' }, this.face);
    for (const ex of [-22, 22]) {
      el('ellipse', { cx: ex, cy: 0, rx: 19, ry: 22, fill: '#fff', stroke: INK, 'stroke-width': 5 }, eyes);
      el('circle', { class: 'pupil', cx: ex + 4, cy: 4, r: 9, fill: INK }, eyes);
      el('circle', { cx: ex + 8, cy: -1, r: 3, fill: '#fff' }, eyes);
    }
    for (const cx of [-38, 38]) el('ellipse', { cx, cy: 28, rx: 10, ry: 6, fill: '#ff6f91', opacity: 0.5 }, this.face);
    this.mouth = el('path', { d: '', fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }, this.face);
  }

  private makeArm(side: -1 | 1): SVGGElement {
    const g = el('g', { class: side < 0 ? 'arm arm-l' : 'arm arm-r' }, this.bob);
    const inner = el('g', { class: 'swing' }, g);
    el('path', { d: `M0 0 Q${side * 36} -4 ${side * 54} -34`, fill: 'none', stroke: INK, 'stroke-width': 9, 'stroke-linecap': 'round' }, inner);
    this.mitts.push(el('circle', { cx: side * 58, cy: -44, r: 15, fill: '#fff', stroke: INK, 'stroke-width': 5 }, inner));
    return g;
  }

  bounds(shape = this.shape): Bounds {
    return { width: shape.width * B, height: shape.height * B };
  }

  /** Move to a new amount. Pieces that stay keep their place in the DOM and glide; new ones pop in. */
  set(n: number, animate = true): void {
    const shape = shapeFor(n);
    this.shape = shape;
    const ox = (-shape.width * B) / 2;
    const seen = new Set<string>();
    let delay = 0;
    for (const p of shape.pieces) {
      seen.add(p.key);
      let node = this.pieces.get(p.key);
      if (!node) {
        node = this.makePiece(p.key, p.kind);
        this.pieces.set(p.key, node);
        if (animate) {
          node.pop.style.animationDelay = `${Math.min(delay, 400)}ms`;
          node.pop.classList.add('pop-in');
          delay += p.kind === 'block' ? 18 : 90;
        }
      }
      if (node.tone !== p.tone) {
        node.paint(p.tone);
        node.tone = p.tone;
      }
      const h = DIMS[p.kind].h;
      node.g.style.transform = `translate(${ox + p.x * B}px, ${-(p.y + h) * B}px)`;
    }
    for (const [key, node] of this.pieces) {
      if (seen.has(key)) continue;
      this.pieces.delete(key);
      if (!animate) { node.g.remove(); continue; }
      node.pop.classList.remove('pop-in', 'lit');
      node.pop.classList.add('pop-out');
      setTimeout(() => node.g.remove(), 260);
    }
    this.placeParts(n, ox);
  }

  private makePiece(key: string, kind: Kind): PieceNode {
    const g = el('g', { class: 'blk' });
    // Keep draw order stable: bigger places first, rows bottom to top.
    this.layer.appendChild(g);
    const pop = el('g', { class: kind === 'block' ? 'pop' : 'pop big' }, g);
    let seed = 7;
    for (const ch of key) seed = seed * 31 + ch.charCodeAt(0);
    const rnd = seeded(seed);
    const fills: SVGElement[] = [];
    const shades: SVGElement[] = [];

    if (kind === 'block') {
      const outline = wobblyRect(0, 0, B, B, rnd);
      fills.push(el('path', { d: outline }, pop));
      shades.push(el('path', { d: wobblyRect(9, B - 27, B - 18, 17, rnd, 1.5) }, pop));
      el('path', { d: `M16 ${20 + rnd() * 3} Q24 13 ${38 + rnd() * 6} ${14 + rnd() * 2}`, fill: 'none', stroke: '#fff', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.55 }, pop);
      el('path', { d: outline, fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, pop);
    } else {
      const { w, h, d, step } = DIMS[kind];
      const W = w * B, H = h * B, D = d * B;
      const lines = prismLines(w, h, d, step);
      if (D) {
        const top = `M0 0 L${W} 0 L${W + D} ${-D} L${D} ${-D}Z`;
        fills.push(el('path', { d: top }, pop));
        el('path', { d: top, fill: '#fff', opacity: 0.35 }, pop);
        shades.push(el('path', { d: `M${W} 0 L${W + D} ${-D} L${W + D} ${H - D} L${W} ${H}Z` }, pop));
        el('path', { d: lines.back, fill: 'none', stroke: INK, 'stroke-width': 1, opacity: 0.45, ...CRISP }, pop);
        el('path', { d: `M0 0 L${D} ${-D} L${W + D} ${-D} L${W + D} ${H - D} L${W} ${H} M${W} 0 L${W + D} ${-D}`, fill: 'none', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round', ...CRISP }, pop);
      }
      const unit = Math.min(W, H) / 10; // a tenth of the shorter side
      const outline = wobblyRect(0, 0, W, H, rnd, unit * 0.06);
      fills.push(el('path', { d: outline }, pop));
      shades.push(el('path', { d: wobblyRect(unit * 0.3, H - unit * 0.7, W - unit * 0.6, unit * 0.44, rnd, unit * 0.04) }, pop));
      el('path', { d: lines.front, fill: 'none', stroke: INK, 'stroke-width': 1, opacity: 0.4, ...CRISP }, pop);
      el('path', { d: `M${unit * 0.5} ${unit * (0.9 + rnd() * 0.1)} Q${unit * 1.1} ${unit * 0.4} ${unit * (2.4 + rnd() * 0.3)} ${unit * 0.46}`, fill: 'none', stroke: '#fff', 'stroke-width': unit * 0.16, 'stroke-linecap': 'round', opacity: 0.5 }, pop);
      el('path', { d: outline, fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round', ...CRISP }, pop);
    }

    // Place before the first frame so a new piece does not fly in from the origin.
    g.style.transition = 'none';
    requestAnimationFrame(() => { g.style.transition = ''; });
    const paint = (tone: number) => {
      const t = toneFor(tone);
      for (const f of fills) f.setAttribute('fill', t.fill);
      for (const sh of shades) sh.setAttribute('fill', t.shade);
    };
    return { g, pop, tone: 0, paint };
  }

  private placeParts(n: number, ox: number): void {
    const s = this.shape;
    const zero = n === 0;
    this.ghost.style.display = zero ? '' : 'none';
    this.feet.style.display = zero ? 'none' : '';
    this.armL.style.display = zero ? 'none' : '';
    this.armR.style.display = zero ? 'none' : '';

    const k = s.face.scale;
    const fx = ox + s.face.x * B;
    const fy = -s.face.top * B + 44 * k;
    this.face.style.transform = `translate(${fx}px, ${fy}px) scale(${k})`;
    this.face.classList.toggle('sleepy', zero);
    this.mouth.setAttribute('d', zero ? 'M-12 30 Q0 26 12 30' : 'M-16 24 Q0 40 16 24');
    if (zero) return;

    const L = s.limbs;
    this.armL.style.transform = `translate(${ox + 2}px, ${-s.armL * B}px) scale(${L})`;
    this.armR.style.transform = `translate(${ox + s.armRx * B - 2}px, ${-s.armR * B}px) scale(${L})`;
    this.mitts[0].setAttribute('fill', toneFor(s.pieces[0].tone).fill);
    this.mitts[1].setAttribute('fill', toneFor(s.pieces[s.pieces.length - 1].tone).fill);
    this.feet.replaceChildren();
    for (const x of s.feet) el('ellipse', { cx: ox + x * B, cy: 8 * L, rx: 30 * L, ry: 14 * L, fill: INK }, this.feet);
  }

  /** Make these pieces bounce and glow, for counting along. */
  light(keys: string[]): void {
    for (const key of keys) {
      const node = this.pieces.get(key);
      if (!node) continue;
      node.pop.classList.remove('pop-in', 'lit');
      void node.pop.getBoundingClientRect();
      node.pop.classList.add('lit');
    }
  }

  clearLights(): void {
    for (const node of this.pieces.values()) node.pop.classList.remove('lit');
  }

  jump(): void {
    this.root.classList.remove('jump');
    void this.root.getBoundingClientRect();
    this.root.classList.add('jump');
  }
}
