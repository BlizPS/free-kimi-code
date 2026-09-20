import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rank } from './bm25.mjs';
import { detectProduct, applyReasoning, antiPatterns, buildDecisionTrace } from './reasoning.mjs';
import { detectStack } from './stack-detect.mjs';
import { persistDesignSystem } from './persist.mjs';
import { evaluateUiSource } from './quality.mjs';
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
function read(name){return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name),'utf8'));}
function compactMatches(rows){return rows.slice(0,3).map(r=>({id:r.id,name:r.name||r.id,score:Number(r._score.toFixed(3))}));}
const DATA={
  styles:read('styles.json'),products:read('products.json'),patterns:read('patterns.json'),palettes:read('palettes.json'),types:read('typography.json'),motions:read('motion.json'),ux:read('ux.json'),components:read('components.json'),stacks:read('stacks.json')
};
function searchAll(query){
  return {product:rank(DATA.products,query,{limit:4}),style:rank(DATA.styles,query,{limit:4}),pattern:rank(DATA.patterns,query,{limit:3}),palette:rank(DATA.palettes,query,{limit:3}),typography:rank(DATA.types,query,{limit:3}),motion:rank(DATA.motions,query,{limit:2}),ux:rank(DATA.ux,query,{limit:6}),components:rank(DATA.components,query,{limit:5}),stacks:rank(DATA.stacks,query,{limit:4})};
}
function renderMarkdown(ds){const r=ds.resolution;return [
  `# ${ds.project || 'UI Design System'}`,'',
  `**Product:** ${r.product.id}  
**Pattern:** ${r.pattern.id}  
**Style:** ${r.style.id}  
**Stack:** ${ds.stack.id}  
**Density:** ${r.density}/10  
**Motion:** ${r.motion.id} — ${r.motion.timing}`,'',
  '## Visual System',
  `- Background: \`${r.palette.roles.background}\``,
  `- Surface: \`${r.palette.roles.surface}\``,
  `- Surface 2: \`${r.palette.roles.surface2}\``,
  `- Text: \`${r.palette.roles.text}\``,
  `- Muted: \`${r.palette.roles.muted}\``,
  `- Border: \`${r.palette.roles.border}\``,
  `- Primary: \`${r.palette.roles.primary}\``,
  `- Accent: \`${r.palette.roles.accent}\``,
  `- Danger: \`${r.palette.roles.danger}\``,
  `- Focus: \`${r.palette.roles.focus}\``,
  `- Heading: ${r.type.heading}`,
  `- Body: ${r.type.body}`,'',
  '## Layout',...(r.pattern.layout||[]).map(x=>`- ${x}`),'',
  '## Components',
  ...ds.components.map(c=>`- **${c.id}:** ${(c.rules||[]).join('; ')}`),
  '',
  '## Stack Guidance',
  ...(ds.stackRules.length ? ds.stackRules.map(c=>`- **${c.id}:** ${(c.rules||[]).join('; ')}`) : ['- Use the detected stack conventions and keep the implementation semantic.']),
  '',
  '## Interaction',
  '- Provide idle, hover, focus, pressed, disabled, loading, success, and error states where relevant.',
  '- Make the primary action visually dominant without adding decorative chrome.',
  '- Keep keyboard and touch paths usable.',
  '', '## Responsive',
  '- Narrow: no horizontal overflow; preserve task access and readable controls.',
  '- Medium: rebalance columns before shrinking typography.',
  '- Wide: expand information surfaces without turning whitespace into empty chrome.',
  '', '## Avoid',...(r.antiPatterns||[]).map(x=>`- ${x}`),'',
  '## Implementation Notes',
  `- Typography: ${r.type.mood}`,
  `- Motion: ${r.motion.use}; avoid ${r.motion.avoid}.`,
  `- Style: ${r.style.keywords.join(', ')}.`,
  `- Product constraints: ${(r.product.rules||[]).join('; ')}`,
  '', '## Decision Trace',`\`${ds.trace}\``,
].join('\n');}
export function generateDesignSystem(query,options={}){
  const q=String(query||'').trim();if(!q)throw new Error('A UI/product query is required.');
  const stack=options.stack?{id:String(options.stack),confidence:1,source:'argument'}:detectStack(options.cwd||process.cwd());
  const matches=searchAll(q);const product=detectProduct(q,DATA.products);
  const resolution=applyReasoning(product,q,DATA);resolution.antiPatterns=antiPatterns(product,resolution.style);
  if(options.variance!=null){const n=Math.max(1,Math.min(10,Number(options.variance)||5));if(n>=8&&resolution.product.id==='portfolio')resolution.style=DATA.styles.find(s=>s.id==='neo-brutalist')||resolution.style;}
  if(options.motion!=null){const n=Math.max(1,Math.min(10,Number(options.motion)||3));resolution.motion=DATA.motions.slice().sort((a,b)=>Math.abs(a.intensity-n)-Math.abs(b.intensity-n))[0];resolution.requestedMotion=n;}
  if(options.density!=null)resolution.density=Math.max(1,Math.min(10,Number(options.density)||6));
  const trace=buildDecisionTrace(resolution);
  const components=matches.components.slice(0,5);
  const stackRules=matches.stacks.filter(x=>x.id===stack.id || x.keywords?.some(k=>String(q).toLowerCase().includes(String(k).toLowerCase()))).slice(0,4);
  const ds={query:q,project:options.projectName||null,stack,resolution,matches:Object.fromEntries(Object.entries(matches).map(([k,v])=>[k,compactMatches(v)])),components,stackRules,uxRules:matches.ux.slice(0,6).map(x=>x.id+': '+x.rule),trace};
  ds.markdown=renderMarkdown(ds);
  ds.persistence=options.persist?persistDesignSystem(ds,options):null;
  ds.quality={score:100,sourceChecks:[]};
  return ds;
}
export function evaluateGeneratedSource(source){return evaluateUiSource(source);}
