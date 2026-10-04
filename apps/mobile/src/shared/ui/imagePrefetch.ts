export function createImagePrefetcher(
  fetchImage: (url: string) => Promise<boolean>,
  canPrefetch: () => boolean,
) {
  const cached = new Set<string>();
  let activeBatch: Promise<boolean> | undefined;

  const fetchOne = (url: string): Promise<boolean> => {
    if (cached.has(url)) return Promise.resolve(true);
    return Promise.resolve().then(() => fetchImage(url)).catch(() => false).then(success => {
      if (success) {
        cached.add(url);
        if (cached.size > 64) cached.delete(cached.values().next().value!);
      }
      return success;
    });
  };

  return (urls: string[]): Promise<boolean> => {
    if (!canPrefetch()) return Promise.resolve(false);
    if (activeBatch) return Promise.resolve(false);
    const uncached = [...new Set(urls)].filter(url => !cached.has(url));
    const unique = uncached.slice(0, 4);
    if (unique.length === 0) return Promise.resolve(urls.length > 0);
    const batch = (async () => {
      let success = true;
      for (let index = 0; index < unique.length; index += 2) {
        if (!canPrefetch()) return false;
        const results = await Promise.all(unique.slice(index, index + 2).map(fetchOne));
        success = results.every(Boolean) && success;
      }
      return success && uncached.length <= 4;
    })();
    activeBatch = batch;
    void batch.finally(() => { if (activeBatch === batch) activeBatch = undefined; });
    return batch;
  };
}
