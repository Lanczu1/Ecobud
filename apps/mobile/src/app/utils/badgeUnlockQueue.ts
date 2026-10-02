export function takeUnseenBadges<T extends { id: string }>(badges: readonly T[], seenIds: Set<string>): T[] {
  const unseen: T[] = [];
  for (const badge of badges) {
    if (seenIds.has(badge.id)) continue;
    seenIds.add(badge.id);
    unseen.push(badge);
  }
  return unseen;
}
