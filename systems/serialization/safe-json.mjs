export function safeJson(value, options = {}) {
  const maxChars = Math.max(256, Number(options.maxChars) || 12000);
  try {
    const text = JSON.stringify(value, (_key, item) => {
      if (typeof item === 'bigint') return `${item}n`;
      if (typeof item === 'function') return undefined;
      return item;
    });
    if (!text || text.length <= maxChars) return text || 'null';
    return `${text.slice(0, maxChars - 20)}...<truncated>`;
  } catch {
    return 'null';
  }
}
