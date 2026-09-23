const seen = new Set<string>();

export function shouldAskAi(name: string, localConfidence: number | null): boolean {
  const key = name.trim().toLowerCase();
  if (key.length < 3 || /^\d+$/.test(key)) return false;
  if (localConfidence != null && localConfidence >= 0.7) return false;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

export function resetAiAskCache() {
  seen.clear();
}
