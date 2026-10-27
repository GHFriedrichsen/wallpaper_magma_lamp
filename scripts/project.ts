// Gera public/project.json (o manifesto do Wallpaper Engine) a partir de
// src/wallpaper/schema.ts. Roda com: npm run project
import { writeFileSync } from 'node:fs';
import { SCHEMA } from '../src/wallpaper/schema.ts';

const properties: Record<string, Record<string, unknown>> = {
  schemecolor: { order: 0, text: 'ui_browse_properties_scheme_color', type: 'color', value: '0.1 0.8 1' },
};

SCHEMA.forEach((def, i) => {
  const order = (i + 1) * 10;
  const base: Record<string, unknown> = { order, text: def.text };
  if (def.condition) base.condition = def.condition;
  switch (def.type) {
    case 'header':
      properties[def.key] = { ...base, type: 'text' };
      break;
    case 'slider':
      properties[def.key] = { ...base, type: 'slider', value: def.value, min: def.min, max: def.max, fraction: false, editable: true };
      break;
    case 'bool':
      properties[def.key] = { ...base, type: 'bool', value: def.value };
      break;
    case 'color':
      properties[def.key] = { ...base, type: 'color', value: def.value };
      break;
    case 'combo':
      properties[def.key] = { ...base, type: 'combo', value: def.value, options: def.options };
      break;
  }
});

const project = {
  title: 'Ferrofluido',
  description:
    'Ferrofluido com cimática: o som vira campo magnético. Os graves levantam os espinhos, cada nota ' +
    'desenha uma figura (favo ou mandala), as batidas fazem os espinhos pularem e o nome da música ' +
    'aparece em volta da tela. Poça ou esfera; luzes, cores, câmera, áudio e mouse personalizáveis.',
  type: 'web',
  file: 'index.html',
  preview: 'preview.jpg',
  contentrating: 'Everyone',
  tags: ['Abstract'],
  general: { supportsaudioprocessing: true, properties },
};

writeFileSync(new URL('../public/project.json', import.meta.url), JSON.stringify(project, null, 2) + '\n');
console.log(`project.json: ${Object.keys(properties).length} opções`);
