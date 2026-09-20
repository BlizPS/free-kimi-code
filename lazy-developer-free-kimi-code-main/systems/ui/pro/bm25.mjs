const STOPWORDS = new Set(['a','an','and','are','as','at','be','by','for','from','how','in','is','it','of','on','or','that','the','this','to','was','what','when','where','which','who','why','with','use','using']);
const SYNONYMS = Object.freeze({
  'e-commerce':'ecommerce','dark-mode':'dark','darkmode':'dark','light-mode':'light','lightmode':'light',
  'ux/ui':'ux ui','ui/ux':'ui ux','devtool':'developer tool','ide':'developer tool','chatbot':'ai chat','assistant':'ai chat',
  'dashboard':'analytics dashboard','backoffice':'admin','back-office':'admin','checkout':'commerce','streaming':'media'
});
const SYNS=[...Object.entries(SYNONYMS)].sort((a,b)=>b[0].length-a[0].length);
function normalize(text){
  let out=String(text||'').toLowerCase();
  for(const [a,b] of SYNS) out=out.replace(new RegExp(`(^|[^\\w])${a.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?=$|[^\\w])`,'g'),'$1'+b);
  return out;
}
export function tokenize(text){return normalize(text).replace(/[^a-z0-9_\-]+/g,' ').split(/\s+/).filter(t=>t.length>1&&!STOPWORDS.has(t));}
export class BM25{
  constructor(k1=1.5,b=.75){this.k1=k1;this.b=b;this.docs=[];this.lengths=[];this.avg=1;this.df=new Map();this.tf=[];this.idf=new Map();}
  fit(records){this.docs=records.map(r=>tokenize(r.searchText));this.lengths=this.docs.map(d=>d.length);this.avg=(this.lengths.reduce((a,b)=>a+b,0)/(this.lengths.length||1))||1;this.tf=[];this.df.clear();
    for(const doc of this.docs){const tf=new Map();for(const t of doc)tf.set(t,(tf.get(t)||0)+1);this.tf.push(tf);for(const t of tf)this.df.set(t,(this.df.get(t)||0)+1);}
    const n=this.docs.length;for(const [t,f] of this.df)this.idf.set(t,Math.log((n-f+.5)/(f+.5)+1));return this;}
  score(query){const q=[...new Set(tokenize(query))];return this.docs.map((doc,i)=>{let score=0;const tf=this.tf[i],len=this.lengths[i];for(const t of q){const f=tf.get(t)||0;if(!f)continue;const idf=this.idf.get(t)||0;score+=idf*((f*(this.k1+1))/(f+this.k1*(1-this.b+this.b*len/this.avg)));}return {index:i,score};}).sort((a,b)=>b.score-a.score);}
}
export function rank(records,query,options={}){
  const engine=new BM25().fit(records.map(r=>({searchText:[r.id,r.name,r.category,r.aliases,r.keywords,r.description,r.bestFor,r.rules].filter(Boolean).join(' ')})));
  const ranked=engine.score(query); const q=tokenize(query);
  return ranked.map(item=>{const row=records[item.index];const text=tokenize([row.id,row.name,row.aliases,row.keywords,row.bestFor,row.description].filter(Boolean).join(' '));const set=new Set(text);const exact=q.filter(t=>set.has(t)).length;const phrase=String(row.name||row.id||'').toLowerCase().includes(String(query||'').toLowerCase().trim());const boost=exact*0.8+(phrase?2.5:0)+(row.priority||0);return {...row,_score:item.score+boost,_coverage:q.length?q.filter(t=>set.has(t)).length/q.length:0};}).sort((a,b)=>b._score-a._score).slice(0,Number(options.limit)||5);
}
