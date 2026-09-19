export class TokenLedger {
  constructor() {
    this.entries = [];
  }
  record(stage, data = {}) {
    this.entries.push({
      stage: String(stage || 'unknown'),
      input: Math.max(0, Number(data.input) || 0),
      output: Math.max(0, Number(data.output) || 0),
      saved: Math.max(0, Number(data.saved) || 0),
      at: Date.now(),
    });
    return this.entries.at(-1);
  }
  totals() {
    return this.entries.reduce((out, item) => {
      out.input += item.input;
      out.output += item.output;
      out.saved += item.saved;
      return out;
    }, { input: 0, output: 0, saved: 0 });
  }
  snapshot() {
    return Object.freeze({ entries: this.entries.slice(-128), totals: this.totals() });
  }
}
