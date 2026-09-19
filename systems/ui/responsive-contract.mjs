export function responsiveContract(input = {}) {
  const formFactor = String(input.formFactor || 'web');
  const minWidth = Math.max(280, Number(input.minWidth || 320));
  const contract = {
    formFactor,
    minWidth,
    narrow: ['no horizontal overflow', 'content remains reachable', 'touch targets remain usable'],
    medium: ['layout remains balanced', 'primary controls stay discoverable'],
    wide: ['use available space without oversized empty chrome', 'preserve readable measure'],
    resilience: ['long text wraps', 'missing data has a real state', 'images keep aspect ratio'],
  };
  return Object.freeze(contract);
}

export function buildResponsiveFrame(input = {}) {
  const contract = responsiveContract(input);
  return `[RESPONSIVE] min=${contract.minWidth}; narrow=no-overflow/touchable; medium=balanced; wide=space-efficient`;
}
