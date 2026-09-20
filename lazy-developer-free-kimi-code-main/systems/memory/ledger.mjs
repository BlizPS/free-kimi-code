import { compactEvidence } from '../context/prune.mjs';

export class TaskLedger {
  constructor() {
    this.constraints = new Set();
    this.decisions = new Set();
    this.evidence = new Map();
    this.changes = new Map();
    this.risks = new Map();
  }

  addConstraint(value) { if (String(value || '').trim()) this.constraints.add(String(value).trim()); }
  addDecision(value) { if (String(value || '').trim()) this.decisions.add(String(value).trim()); }
  addEvidence(key, value, status = 'observed') { if (value) this.evidence.set(String(key), { value: compactEvidence(value), status }); }
  addChange(file, summary = '') { if (file) this.changes.set(String(file), String(summary)); }
  addRisk(key, value, severity = 'medium') { if (value) this.risks.set(String(key), { value: String(value), severity }); }

  snapshot() {
    return {
      constraints: [...this.constraints],
      decisions: [...this.decisions],
      evidence: Object.fromEntries(this.evidence),
      changes: Object.fromEntries(this.changes),
      risks: Object.fromEntries(this.risks),
    };
  }

  compact() {
    const view = this.snapshot();
    return [
      view.constraints.length ? `constraints=${view.constraints.join(' | ')}` : '',
      view.decisions.length ? `decisions=${view.decisions.join(' | ')}` : '',
      Object.keys(view.evidence).length ? `evidence=${Object.entries(view.evidence).map(([k, v]) => `${k}:${v.status}:${v.value}`).join(' | ')}` : '',
      Object.keys(view.changes).length ? `changes=${Object.keys(view.changes).join(',')}` : '',
      Object.keys(view.risks).length ? `risks=${Object.entries(view.risks).map(([k, v]) => `${k}:${v.severity}`).join(',')}` : '',
    ].filter(Boolean).join('; ');
  }
}
