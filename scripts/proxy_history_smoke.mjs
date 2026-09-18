#!/usr/bin/env node
import assert from 'node:assert/strict';
import { repairOpenAIHistory } from '../runtime/openai-history.mjs';

const repaired = repairOpenAIHistory([
  { role: 'user', content: 'inspect the project' },
  { role: 'assistant', content: '', tool_calls: [
    { id: 'Read:1', type: 'function', function: { name: 'Read', arguments: '{}' } },
    { id: 'Glob:2', type: 'function', function: { name: 'Glob', arguments: '{}' } },
  ] },
  { role: 'tool', tool_call_id: 'Read:1', content: 'done' },
  // Glob:2 intentionally has no tool result, reproducing a broken interrupted turn.
  { role: 'user', content: 'continue' },
  { role: 'tool', tool_call_id: 'orphan:3', content: 'orphan' },
]);

assert.deepEqual(repaired, [
  { role: 'user', content: 'inspect the project' },
  { role: 'assistant', content: '', tool_calls: [
    { id: 'Read:1', type: 'function', function: { name: 'Read', arguments: '{}' } },
  ] },
  { role: 'tool', tool_call_id: 'Read:1', content: 'done' },
  { role: 'user', content: 'continue' },
]);

const pureText = [{ role: 'assistant', content: 'hello', tool_calls: [{ id: 'bad' }] }];
assert.deepEqual(repairOpenAIHistory(pureText), [{ role: 'assistant', content: 'hello' }]);

console.log('PASS: strict OpenAI history repair removes orphan tool calls/results while preserving completed pairs');
