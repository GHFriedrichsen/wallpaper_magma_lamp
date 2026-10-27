// Painel de testes no navegador (?painel): os mesmos controles do painel do
// Wallpaper Engine, montados a partir do schema, mais um medidor de fps.

import { SCHEMA, type PropertyDef } from '../wallpaper/schema';

function toHex(color: string): string {
  return (
    '#' +
    color
      .split(/\s+/)
      .map((v) => Math.round(Math.max(0, Math.min(1, Number(v))) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

function fromHex(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
}

/** Entende condições simples do Wallpaper Engine: "chave.value == 'x'", "!=" e "== true". */
function visible(def: PropertyDef, values: Record<string, unknown>): boolean {
  if (!def.condition) return true;
  const m = /^(\w+)\.value\s*(==|!=)\s*(?:'([^']*)'|(true|false))$/.exec(def.condition.trim());
  if (!m) return true;
  const equal = String(values[m[1]]) === (m[3] ?? m[4]);
  return m[2] === '==' ? equal : !equal;
}

export function mountPanel(): void {
  const values: Record<string, unknown> = {};
  const url = new URLSearchParams(location.search);
  for (const def of SCHEMA) {
    if (def.type === 'header') continue;
    const fromUrl = url.get(def.key);
    values[def.key] =
      fromUrl === null ? def.value
      : def.type === 'slider' ? Number(fromUrl)
      : def.type === 'bool' ? fromUrl === 'true'
      : def.type === 'color' ? fromUrl.replace(/,/g, ' ')
      : fromUrl;
  }

  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;top:8px;right:8px;width:270px;max-height:calc(100vh - 16px);overflow:auto;' +
    'background:rgba(15,10,20,.85);color:#eee;font:12px system-ui,sans-serif;padding:10px;' +
    'border-radius:8px;z-index:10;backdrop-filter:blur(6px)';
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  panel.addEventListener('pointermove', (e) => e.stopPropagation());
  document.body.appendChild(panel);

  const fps = document.createElement('div');
  fps.style.cssText = 'font-weight:bold;margin-bottom:6px';
  panel.appendChild(fps);
  let frames = 0;
  let since = performance.now();
  const count = (now: number) => {
    frames++;
    if (now - since > 1000) {
      fps.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${(((now - since) / frames)).toFixed(1)} ms/quadro`;
      frames = 0;
      since = now;
    }
    requestAnimationFrame(count);
  };
  requestAnimationFrame(count);

  const rows: { def: PropertyDef; el: HTMLElement }[] = [];
  const send = (key: string, value: unknown) => {
    values[key] = value;
    window.wallpaperPropertyListener?.applyUserProperties?.({ [key]: { value } });
    for (const r of rows) r.el.style.display = visible(r.def, values) ? '' : 'none';
  };

  for (const def of SCHEMA) {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:6px 0';
    if (def.type === 'header') {
      row.innerHTML = def.text;
      row.style.cssText = 'display:block;margin:12px 0 4px;color:#fb4;font-size:13px';
    } else {
      const title = document.createElement('div');
      title.textContent = def.text;
      row.appendChild(title);
      let input: HTMLInputElement | HTMLSelectElement;
      if (def.type === 'slider') {
        const range = document.createElement('input');
        range.type = 'range';
        range.min = String(def.min);
        range.max = String(def.max);
        range.step = String(def.step ?? 1);
        range.value = String(values[def.key]);
        const out = document.createElement('span');
        out.textContent = ` ${values[def.key]}`;
        range.oninput = () => {
          out.textContent = ` ${range.value}`;
          send(def.key, Number(range.value));
        };
        title.appendChild(out);
        input = range;
      } else if (def.type === 'bool') {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = values[def.key] === true;
        box.onchange = () => send(def.key, box.checked);
        input = box;
      } else if (def.type === 'color') {
        const pick = document.createElement('input');
        pick.type = 'color';
        pick.value = toHex(String(values[def.key]));
        pick.oninput = () => send(def.key, fromHex(pick.value));
        input = pick;
      } else {
        const select = document.createElement('select');
        for (const o of def.options) select.add(new Option(o.label, o.value, false, o.value === values[def.key]));
        select.onchange = () => send(def.key, select.value);
        input = select;
      }
      input.style.width = def.type === 'bool' ? '' : '100%';
      row.appendChild(input);
    }
    rows.push({ def, el: row });
    panel.appendChild(row);
  }
  for (const r of rows) r.el.style.display = visible(r.def, values) ? '' : 'none';
}
