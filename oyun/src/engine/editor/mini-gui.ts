/**
 * PRF-11: lil-gui yerine küçük denetçi (admin sahne düzenleyicisinin kullandığı alt küme). lil-gui oyuncu derlemesinde ~42 KB
 * tutuyordu (kod + gömülü CSS); tek dosya kuralı yüzünden ayrı parçaya da ayrılamıyordu. Aynı API: new MiniGui({ title,
 * container }), addFolder, add(obj, key[, min, max, step]) (sayı: kaydırıcı + kutu, boolean: onay, metin: kutu, işlev: düğme),
 * addColor, name, onChange, onFinishChange, close, controllersRecursive().updateDisplay, destroy. Kök öğe .lil-gui sınıfını taşır
 * (düzenleyicinin konum CSS'i aynen geçerli).
 */
type Obj = Record<string, unknown>;
const CSS = `.lil-gui{--width:245px;width:var(--width);background:#1f1f1f;color:#ebebeb;font:11px/1.3 system-ui,sans-serif;border-radius:6px;padding:0 0 4px}
.lil-gui .mg-t{display:block;width:100%;text-align:left;background:#111;color:#ebebeb;border:0;padding:6px 8px;font-weight:700;cursor:pointer}
.lil-gui .mg-k{padding:0 4px 0 8px}.lil-gui .mg-kapali>.mg-k{display:none}
.lil-gui .mg-s{display:flex;align-items:center;gap:6px;min-height:24px}
.lil-gui .mg-s>span{flex:0 0 38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lil-gui .mg-s input[type=range]{flex:1;min-width:0}.lil-gui .mg-s input[type=number]{width:52px}
.lil-gui .mg-s input[type=text]{flex:1;min-width:0}.lil-gui .mg-s button{flex:1;padding:3px;cursor:pointer}
.lil-gui input{background:#424242;color:#ebebeb;border:0;border-radius:3px;font:inherit;padding:2px 4px}`;
let cssOn = false;
function css() { if (cssOn || typeof document === 'undefined') return; cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

export class Kontrol {
  readonly domElement: HTMLElement;
  private label: HTMLSpanElement;
  private ch: ((v: unknown) => void) | null = null;
  private fin: ((v: unknown) => void) | null = null;
  private set: (() => void) = () => {};
  constructor(private obj: Obj, private key: string, opt: { min?: number; max?: number; step?: number; renk?: boolean }) {
    const row = this.domElement = document.createElement('div'); row.className = 'mg-s';
    this.label = document.createElement('span'); this.label.textContent = key; row.appendChild(this.label);
    const v = obj[key];
    const fire = (fin: boolean) => { const x = this.obj[this.key]; this.ch?.call(this, x); if (fin) this.fin?.call(this, x); };
    if (typeof v === 'function') {
      this.label.remove(); const b = document.createElement('button'); b.textContent = key; row.appendChild(b);
      b.onclick = () => { (this.obj[this.key] as () => void).call(this.obj); fire(true); }; this.label = b as unknown as HTMLSpanElement;
    } else if (typeof v === 'boolean') {
      const c = document.createElement('input'); c.type = 'checkbox'; row.appendChild(c);
      c.onchange = () => { this.obj[this.key] = c.checked; fire(true); }; this.set = () => { c.checked = !!this.obj[this.key]; };
    } else if (typeof v === 'number') {
      const n = document.createElement('input'); n.type = 'number'; if (opt.step) n.step = String(opt.step);
      if (opt.min != null && opt.max != null) {
        const r = document.createElement('input'); r.type = 'range'; r.min = String(opt.min); r.max = String(opt.max); r.step = String(opt.step ?? (opt.max - opt.min) / 100);
        r.oninput = () => { this.obj[this.key] = +r.value; n.value = r.value; fire(false); }; r.onchange = () => fire(true); row.appendChild(r);
        this.set = () => { r.value = String(this.obj[this.key]); n.value = String(this.obj[this.key]); };
      } else this.set = () => { n.value = String(this.obj[this.key]); };
      n.onchange = () => { const x = +n.value; if (Number.isFinite(x)) { this.obj[this.key] = x; this.set(); fire(true); } };
      row.appendChild(n);
    } else {
      const t = document.createElement('input'); t.type = opt.renk ? 'color' : 'text'; row.appendChild(t);
      t.oninput = () => { this.obj[this.key] = t.value; fire(false); }; t.onchange = () => fire(true);
      this.set = () => { t.value = String(this.obj[this.key] ?? ''); };
    }
    this.set();
  }
  name(s: string): this { this.label.textContent = s; return this; }
  onChange(f: (v: unknown) => void): this { this.ch = f; return this; }
  onFinishChange(f: (v: unknown) => void): this { this.fin = f; return this; }
  updateDisplay(): this { this.set(); return this; }
}

export class MiniGui {
  readonly domElement: HTMLElement;
  private kap: HTMLElement;
  private kontroller: Kontrol[] = [];
  private klasorler: MiniGui[] = [];
  constructor(o: { title?: string; container?: HTMLElement; parent?: MiniGui } = {}) {
    css();
    const d = this.domElement = document.createElement('div'); d.className = o.parent ? 'mg-f' : 'lil-gui';
    const t = document.createElement('button'); t.className = 'mg-t'; t.textContent = o.title ?? ''; t.onclick = () => d.classList.toggle('mg-kapali'); d.appendChild(t);
    this.kap = document.createElement('div'); this.kap.className = 'mg-k'; d.appendChild(this.kap);
    (o.parent ? o.parent.kap : (o.container ?? document.body)).appendChild(d);
  }
  add(obj: object, key: string, min?: number, max?: number, step?: number): Kontrol {
    const k = new Kontrol(obj as Obj, key, { min, max, step }); this.kap.appendChild(k.domElement); this.kontroller.push(k); return k;
  }
  addColor(obj: object, key: string): Kontrol { const k = new Kontrol(obj as Obj, key, { renk: true }); this.kap.appendChild(k.domElement); this.kontroller.push(k); return k; }
  addFolder(title: string): MiniGui { const f = new MiniGui({ title, parent: this }); this.klasorler.push(f); return f; }
  close(): this { this.domElement.classList.add('mg-kapali'); return this; }
  open(): this { this.domElement.classList.remove('mg-kapali'); return this; }
  controllersRecursive(): Kontrol[] { return [...this.kontroller, ...this.klasorler.flatMap(f => f.controllersRecursive())]; }
  destroy(): void { this.domElement.remove(); this.kontroller = []; this.klasorler = []; }
}
export default MiniGui;
