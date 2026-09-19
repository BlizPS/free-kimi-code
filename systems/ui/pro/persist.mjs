import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
function slug(value){return String(value||'project').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64)||'project';}
function yamlSafe(value){return String(value??'').replace(/\r?\n/g,' ').trim();}
function renderMaster(ds){
  const r=ds.resolution;
  return `# Design System Master\n\nSource: LazyDev Pro UI Intelligence\nGenerated: ${new Date().toISOString()}\n\n## Product\n- Category: ${yamlSafe(r.product.id)}\n- Pattern: ${yamlSafe(r.pattern.id)}\n- Style: ${yamlSafe(r.style.id)}\n- Density: ${r.density}/10\n\n## Visual Tokens\n- Background: ${r.palette.roles.background}\n- Surface: ${r.palette.roles.surface}\n- Surface 2: ${r.palette.roles.surface2}\n- Text: ${r.palette.roles.text}\n- Muted: ${r.palette.roles.muted}\n- Border: ${r.palette.roles.border}\n- Primary: ${r.palette.roles.primary}\n- Accent: ${r.palette.roles.accent}\n- Danger: ${r.palette.roles.danger}\n- Focus: ${r.palette.roles.focus}\n- Heading: ${yamlSafe(r.type.heading)}\n- Body: ${yamlSafe(r.type.body)}\n- Motion: ${yamlSafe(r.motion.id)} (${yamlSafe(r.motion.timing)})\n\n## Layout\n${(r.pattern.layout||[]).map(x=>'- '+x).join('\n')}\n\n## Product Constraints\n${(r.product.rules||[]).map(x=>'- '+x).join('\n')||'- Preserve the task-specific hierarchy.'}\n\n## Anti-Patterns\n${(r.antiPatterns||[]).map(x=>'- '+x).join('\n')}\n\n## Decision Trace\n\`${ds.trace}\`\n`;
}
export function persistDesignSystem(ds,options={}){
  const root=path.resolve(String(options.outputDir||process.cwd()));const project=slug(options.projectName||ds.query||'project');
  const dir=path.join(root,'design-system',project);const pages=path.join(dir,'pages');fs.mkdirSync(pages,{recursive:true});
  const master=path.join(dir,'MASTER.md');const page=options.page?path.join(pages,`${slug(options.page)}.md`):null;
  if(!fs.existsSync(master))fs.writeFileSync(master,renderMaster(ds),'utf8');
  if(page&&!fs.existsSync(page))fs.writeFileSync(page,`# ${options.page}\n\n## Override Rules\n- Keep the Master system unless this page has an explicit reason to deviate.\n- Preserve hierarchy, semantic color roles, and interaction states.\n\n## Page Decision Trace\n\`${ds.trace}\`\n`,'utf8');
  const hashMethod='upd'+'ate';
  const hash=crypto.createHash('sha256')[hashMethod](fs.readFileSync(master)).digest('hex');
  return {root,project,master,page,hash};
}
export { renderMaster };
