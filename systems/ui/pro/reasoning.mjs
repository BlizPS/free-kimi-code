const PRODUCT_MAP = Object.freeze({
  'ai chat': 'ai-chat','developer tool':'developer-tool','saas':'saas','analytics':'analytics','finance':'finance','health':'health','education':'education','ecommerce':'ecommerce','media':'media','portfolio':'portfolio','admin':'admin','booking':'booking'
});
const STACK_MAP = Object.freeze({nextjs:'web-app',react:'web-app',vue:'web-app',svelte:'web-app',astro:'web-app','html-tailwind':'web-app','react-native':'mobile','flutter':'mobile',swiftui:'mobile','jetpack-compose':'mobile'});
const SIGNALS=Object.freeze({dark:/\b(dark|oled|night|midnight)\b/i,light:/\b(light|bright|day)\b/i,dense:/\b(dense|compact|data-heavy|many controls|table-heavy)\b/i,airy:/\b(airy|editorial|luxury|spacious)\b/i,fast:/\b(real-time|realtime|instant|streaming|live)\b/i,mobile:/\b(mobile|android|ios|phone|tablet)\b/i,accessible:/\b(accessible|accessibility|wcag|screen reader|large text)\b/i,keyboard:/\b(keyboard|shortcut|hotkey)\b/i,marketing:/\b(landing|marketing|homepage|campaign|conversion)\b/i});
export function detectProduct(query, products){
  const q=String(query||'').toLowerCase();
  const exact=products.find(p=>q.includes(p.id)||p.aliases?.some(a=>q.includes(a.toLowerCase())));
  if(exact)return {...exact,_reason:'direct-match'};
  let best=null;let score=0;
  for(const p of products){let s=0;for(const a of p.aliases||[]){const words=a.toLowerCase().split(/\s+/);s+=words.filter(w=>q.includes(w)).length;}if(s>score){score=s;best=p;}}
  return best?{...best,_reason:'keyword-match'}:{id:'saas',pattern:'product',style:'minimal-product',palette:'trust-blue',type:'ui-sans',density:6,motion:3,rules:[],avoid:[],_reason:'default'};
}
export function applyReasoning(base,query,{styles,palettes,types,motions,patterns}={}){
  const q=String(query||'');const flags=Object.entries(SIGNALS).filter(([,r])=>r.test(q)).map(([k])=>k);const product=base;
  let styleId=product.style,paletteId=product.palette,typeId=product.type,patternId=product.pattern,density=product.density||6,motion=product.motion||3;
  if(flags.includes('dense')) density=Math.max(density,8);
  if(flags.includes('airy')) density=Math.min(density,4);
  if(flags.includes('dark')) {const dark=palettes.find(p=>p.id===paletteId&&p.mode==='dark')||palettes.find(p=>p.mode==='dark'&&p.id.includes('dark'));if(dark)paletteId=dark.id;}
  if(flags.includes('light')) {const light=palettes.find(p=>p.id===paletteId&&p.mode==='light')||palettes.find(p=>p.mode==='light');if(light)paletteId=light.id;}
  if(flags.includes('accessible') && !['developer-tool','ai-chat'].includes(product.id)) styleId='accessible-public';
  if(flags.includes('mobile')) density=Math.min(density,7);
  if(flags.includes('fast')) motion=Math.min(Math.max(motion,3),5);
  if(product.pattern==='workspace' && flags.includes('marketing')) patternId='product';
  const style=styles.find(s=>s.id===styleId)||styles[0];
  const palette=palettes.find(p=>p.id===paletteId)||palettes[0];
  const type=types.find(t=>t.id===typeId)||types[0];
  const pattern=patterns.find(p=>p.id===patternId)||patterns[0];
  const motionPreset=motions.sort((a,b)=>Math.abs(a.intensity-motion)-Math.abs(b.intensity-motion))[0];
  return {product,flags,style,palette,type,pattern,motion:motionPreset,density,requestedMotion:motion};
}

export function antiPatterns(base,style){
  return [...new Set([...(base.avoid||[]),
    'repeated card treatment without hierarchy','decorative gradients as the main visual language','multiple competing primary actions','icon-only controls without accessible names',
    'invented metrics or fake interaction','large empty hero areas when the task is an app surface',
    ...(style?.caution?[style.caution]:[])
  ])];
}

export function buildDecisionTrace(resolution){
  return [
    `product=${resolution.product.id}`,
    `pattern=${resolution.pattern.id}`,
    `style=${resolution.style.id}`,
    `palette=${resolution.palette.id}`,
    `type=${resolution.type.id}`,
    `density=${resolution.density}/10`,
    `motion=${resolution.motion.id}`,
    `flags=${resolution.flags.join(',')||'none'}`,
  ].join('; ');
}

export { STACK_MAP, PRODUCT_MAP };
