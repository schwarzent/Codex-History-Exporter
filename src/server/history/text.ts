const TEXT_LIMIT = 80;

export function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function excerpt(value: string | null | undefined) {
  if (!value) {
    return '未命名会话';
  }

  const normalized = compactWhitespace(value);
  if (!normalized) {
    return '未命名会话';
  }

  if (normalized.length <= TEXT_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, TEXT_LIMIT - 1)}…`;
}

export function collectText(value: unknown): string[] {
  if (typeof value === 'string') {
    const normalized = compactWhitespace(value);
    return normalized ? [normalized] : [];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectText(entry));
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    if (key === 'encrypted_content') {
      return [];
    }

    return collectText(entry);
  });
}
