import { analyzeUiSource } from '../heuristics.mjs';
export function evaluateUiSource(source=''){
  const analysis=analyzeUiSource(source);
  const checks=[];
  const signals=analysis.signals||{};
  checks.push({id:'hierarchy',pass:!((signals.card_soup||0)>8),reason:(signals.card_soup||0)>8?'too many card-like containers':''});
  checks.push({id:'surfaces',pass:!((signals.glass||0)>2),reason:(signals.glass||0)>2?'excessive glass treatment':''});
  checks.push({id:'color',pass:!((signals.gradient||0)>3),reason:(signals.gradient||0)>3?'too many gradients':''});
  checks.push({id:'states',pass:Boolean(analysis.strengths?.states),reason:'interaction states should be explicit'});
  checks.push({id:'responsive',pass:Boolean(analysis.strengths?.responsive),reason:'responsive behavior should be explicit'});
  checks.push({id:'semantic',pass:Boolean(analysis.strengths?.semantic),reason:'use semantic controls and accessible labels'});
  return Object.freeze({score:Math.max(0,Math.round(100-analysis.slopScore*.65+(analysis.qualityScore*.35))),slopScore:analysis.slopScore,qualityScore:analysis.qualityScore,checks});
}
