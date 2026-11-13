import { Shape, shapeFor, seeded, toneFor } from './numbers';

export const B = 100; // block size in character units
export const GAP = 12; // space between columns so each ten reads as its own stick
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

function span(cols: number): number {
  return cols * B + (cols - 1) * GAP;
}

interface BlockNode {
  g: SVGGElement;
  pop: SVGGElement;
  fill: SVGPathElement;
  shade: SVGPathElement;
  tone: number;
  order: number;
  col: number;
}

export interface Bounds {
  width: number;
  height: number;
}

export class Pal {
  readonly root: SVGGElement;
  private bob: SVGGElement;
  private blocks = new Map<string, BlockNode>();
  private blockLayer: SVGGElement;
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
    this.blockLayer = el('g', { class: 'blocks' }, this.bob);
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
    return { width: span(Math.max(1, shape.cols)), height: Math.max(1, shape.rows) * B };
  }

  /** Move to a new amount. Blocks that stay keep their place in the DOM and glide; new ones pop in. */
  set(n: number, animate = true): { added: number; removed: number } {
    const shape = shapeFor(n);
    this.shape = shape;
    const x0 = -span(Math.max(1, shape.cols)) / 2;
    const seen = new Set<string>();
    let added = 0;
    let delay = 0;
    for (const cell of shape.cells) {
      const key = `${cell.col}-${cell.row}`;
      seen.add(key);
      let node = this.blocks.get(key);
      if (!node) {
        node = this.makeBlock(cell.col, cell.row);
        this.blocks.set(key, node);
        added++;
        if (animate) {
          node.pop.style.animationDelay = `${Math.min(delay, 400)}ms`;
          node.pop.classList.add('pop-in');
          delay += 18;
        }
      }
      node.order = cell.order;
      node.col = cell.col;
      if (node.tone !== cell.tone) {
        const t = toneFor(cell.tone);
        node.fill.setAttribute('fill', t.fill);
        node.shade.setAttribute('fill', t.shade);
        node.tone = cell.tone;
      }
      node.g.style.transform = `translate(${x0 + cell.col * (B + GAP)}px, ${-(cell.row + 1) * B}px)`;
    }
    let removed = 0;
    for (const [key, node] of this.blocks) {
      if (seen.has(key)) continue;
      this.blocks.delete(key);
      removed++;
      if (!animate) { node.g.remove(); continue; }
      node.pop.classList.remove('pop-in', 'lit');
      node.pop.classList.add('pop-out');
      setTimeout(() => node.g.remove(), 260);
    }
    this.placeParts(n, x0);
    return { added, removed };
  }

  private makeBlock(col: number, row: number): BlockNode {
    const g = el('g', { class: 'blk' }, this.blockLayer);
    const pop = el('g', { class: 'pop' }, g);
    const rnd = seeded(col * 131 + row * 17 + 7);
    const outline = wobblyRect(0, 0, B, B, rnd);
    const fill = el('path', { d: outline, fill: '#ccc' }, pop);
    const shade = el('path', { d: wobblyRect(9, B - 27, B - 18, 17, rnd, 1.5), fill: '#aaa' }, pop);
    el('path', { d: `M16 ${20 + rnd() * 3} Q24 13 ${38 + rnd() * 6} ${14 + rnd() * 2}`, fill: 'none', stroke: '#fff', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.55 }, pop);
    el('path', { d: outline, fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, pop);
    // Place before the first frame so a new block does not fly in from the origin.
    g.style.transition = 'none';
    requestAnimationFrame(() => { g.style.transition = ''; });
    return { g, pop, fill, shade, tone: 0, order: 0, col };
  }

  private placeParts(n: number, x0: number): void {
    const s = this.shape;
    const zero = n === 0;
    this.ghost.style.display = zero ? '' : 'none';
    this.feet.style.display = zero ? 'none' : '';
    this.armL.style.display = zero ? 'none' : '';
    this.armR.style.display = zero ? 'none' : '';

    // Face sits on the top block, centred over the full tens when there are any.
    const faceCols = s.tens > 0 ? s.tens : 1;
    const topRow = zero ? 0 : (s.tens > 0 ? 9 : s.rows - 1);
    const fx = x0 + span(faceCols) / 2;
    const k = Math.min(1.9, 1 + 0.22 * (faceCols - 1));
    const fy = -(topRow + 1) * B + 44 * k;
    this.face.style.transform = `translate(${fx}px, ${fy}px) scale(${k})`;
    this.face.classList.toggle('sleepy', zero);
    this.mouth.setAttribute('d', zero ? 'M-12 30 Q0 26 12 30' : 'M-16 24 Q0 40 16 24');

    if (zero) return;
    const leftH = s.tens > 0 ? 10 : s.rows;
    const rightH = s.cells.filter((c) => c.col === s.cols - 1).length;
    this.armL.style.transform = `translate(${x0 + 2}px, ${-Math.min(leftH, 6) * B * 0.55}px)`;
    this.armR.style.transform = `translate(${-x0 - 2}px, ${-Math.min(rightH, 6) * B * 0.55}px)`;

    const leftTone = toneFor(s.tens > 0 ? 10 : n);
    const rightTone = toneFor(s.cells.find((c) => c.col === s.cols - 1)!.tone);
    this.mitts[0].setAttribute('fill', leftTone.fill);
    this.mitts[1].setAttribute('fill', rightTone.fill);
    this.feet.replaceChildren();
    const footXs = s.cols === 1 ? [x0 + 28, x0 + 72] : [x0 + 50, -x0 - 50];
    for (const x of footXs) el('ellipse', { cx: x, cy: 8, rx: 30, ry: 14, fill: INK }, this.feet);
  }

  /** Light one block (by count order) or a whole column of ten. */
  light(order: number, wholeColumn = false): void {
    for (const node of this.blocks.values()) {
      const hit = wholeColumn ? node.col === order - 1 : node.order === order;
      if (!hit) continue;
      node.pop.classList.remove('pop-in', 'lit');
      void node.pop.getBoundingClientRect();
      node.pop.classList.add('lit');
    }
  }

  clearLights(): void {
    for (const node of this.blocks.values()) node.pop.classList.remove('lit');
  }

  jump(): void {
    this.root.classList.remove('jump');
    void this.root.getBoundingClientRect();
    this.root.classList.add('jump');
  }
}
