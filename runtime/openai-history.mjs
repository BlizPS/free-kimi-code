/**
 * Repair OpenAI-compatible message history before it reaches strict providers.
 *
 * Kimi Code persists tool calls in session history. An interrupted turn can
 * leave an assistant tool-call record without every corresponding tool result.
 * Strict OpenAI-compatible APIs reject that transcript with HTTP 400. We keep
 * completed tool pairs intact and remove only the incomplete/orphaned parts.
 */
export function repairOpenAIHistory(messages) {
  if (!Array.isArray(messages) || !messages.length) return messages;
  const out = [];
  const pending = new Map();

  const cleanAssistant = (message) => {
    if (!Array.isArray(message?.tool_calls) || message.tool_calls.length === 0) return message;
    const calls = message.tool_calls.filter((call) => call && String(call.id || '').trim());
    if (!calls.length) {
      const copy = { ...message };
      delete copy.tool_calls;
      return copy.content == null || (typeof copy.content === 'string' && !copy.content.trim()) ? null : copy;
    }
    return { ...message, tool_calls: calls };
  };

  const trimPendingFromLastAssistant = () => {
    if (!pending.size) return;
    const assistantIndex = pending.values().next().value;
    const last = Number.isInteger(assistantIndex) ? out[assistantIndex] : null;
    if (last?.role !== 'assistant' || !Array.isArray(last.tool_calls)) return;
    const kept = last.tool_calls.filter((call) => {
      const id = String(call?.id || '').trim();
      return id && !pending.has(id);
    });
    if (kept.length) out[assistantIndex] = { ...last, tool_calls: kept };
    else if (last.content == null || (typeof last.content === 'string' && !last.content.trim())) out.splice(assistantIndex, 1);
    else {
      const cleaned = { ...last };
      delete cleaned.tool_calls;
      out[assistantIndex] = cleaned;
    }
  };

  for (const original of messages) {
    const message = original && typeof original === 'object' ? { ...original } : original;
    if (!message || typeof message !== 'object') continue;

    if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length) {
      trimPendingFromLastAssistant();
      pending.clear();
      const cleaned = cleanAssistant(message);
      if (!cleaned) continue;
      out.push(cleaned);
      for (const call of cleaned.tool_calls || []) {
        const id = String(call?.id || '').trim();
        if (id) pending.set(id, out.length - 1);
      }
      continue;
    }

    if (message.role === 'tool') {
      const id = String(message.tool_call_id || '').trim();
      if (!id || !pending.has(id)) continue;
      out.push(message);
      pending.delete(id);
      continue;
    }

    if (pending.size) {
      trimPendingFromLastAssistant();
      pending.clear();
    }
    out.push(message);
  }

  trimPendingFromLastAssistant();
  return out;
}
