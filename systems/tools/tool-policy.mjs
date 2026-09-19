const RISK = Object.freeze({
  Read: 'low', Grep: 'low', Glob: 'low', ReadMediaFile: 'low', WebSearch: 'low', FetchURL: 'low',
  Write: 'medium', Edit: 'medium', EnterPlanMode: 'low', ExitPlanMode: 'low', TodoList: 'low', Agent: 'low',
  Bash: 'high', AgentSwarm: 'medium', TaskList: 'low', TaskOutput: 'low', TaskStop: 'low', WaitFor: 'low',
});

export function toolRisk(name) {
  return RISK[String(name || '')] || 'unknown';
}

export function preferredTools(task = {}) {
  if (task.primary === 'ui') return ['Glob', 'Grep', 'Read', 'ReadMediaFile', 'WebSearch', 'FetchURL', 'Edit', 'Write', 'Bash'];
  if (task.primary === 'debug') return ['Grep', 'Read', 'Bash', 'Edit', 'Write'];
  if (task.primary === 'research') return ['WebSearch', 'FetchURL', 'Read'];
  return ['Glob', 'Grep', 'Read', 'Edit', 'Write', 'Bash'];
}

export function shouldUseTool(name, task = {}, evidence = {}) {
  const risk = toolRisk(name);
  if (risk === 'unknown') return false;
  if (risk === 'high' && evidence.commandRequired !== true) return false;
  return preferredTools(task).includes(name) || risk === 'low';
}
