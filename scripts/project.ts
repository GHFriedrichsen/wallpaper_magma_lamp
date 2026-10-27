// Gera public/project.json (o manifesto do Wallpaper Engine) a partir de
// src/wallpaper/schema.ts. Roda com: npm run project
import { writeFileSync } from 'node:fs';
import { SCHEMA } from '../src/wallpaper/schema.ts';

const properties: Record<string, Record<string, unknown>> = {
  schemecolor: { order: 0, text: 'ui_browse_properties_scheme_color', type: 'color', value: '1 0.35 0.05' },
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
  title: 'Lâmpada de Magma',
  description:
    'Lâmpada de lava com cimática em fluidos: as bolhas de cera sobem e descem com o calor, ' +
    'vibram como gotas estrela a cada nota e o líquido forma ondas de Faraday. Cores, formato, ' +
    'bolhas, cimática, áudio e mouse personalizáveis.',
  type: 'web',
  file: 'index.html',
  preview: 'preview.jpg',
  contentrating: 'Everyone',
  tags: ['Abstract'],
  general: { supportsaudioprocessing: true, properties },
};

writeFileSync(new URL('../public/project.json', import.meta.url), JSON.stringify(project, null, 2) + '\n');
console.log(`project.json: ${Object.keys(properties).length} opções`);
