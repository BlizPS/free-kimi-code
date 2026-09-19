import { analyzeUiSource, uiCorrections } from './heuristics.mjs';
import { responsiveContract } from './responsive-contract.mjs';
import { stateMatrix } from './state-matrix.mjs';

export function buildUiDesignContract(input = {}) {
  const source = String(input.source || '');
  const analysis = analyzeUiSource(source);
  return Object.freeze({
    preserveIdentity: input.preserveIdentity !== false,
    domain: String(input.domain || 'product'),
    reference: String(input.reference || ''),
    hierarchy: ['primary action', 'supporting context', 'secondary actions', 'feedback states'],
    states: stateMatrix({ interactive: true, async: true }),
    responsive: responsiveContract(input),
    analysis,
    corrections: uiCorrections(analysis),
  });
}
