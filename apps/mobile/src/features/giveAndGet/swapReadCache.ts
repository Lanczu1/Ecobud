export class SwapReadCache {
  private scope = '';
  private generation = 0;
  private values = new Map<string, unknown>();
  private requests = new Map<string, Promise<unknown>>();

  setScope(scope: string) {
    if (scope === this.scope) return;
    this.scope = scope;
    this.generation++;
    this.values.clear();
    this.requests.clear();
  }

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  fetch<T>(key: string, load: () => Promise<T>): Promise<T> {
    const pending = this.requests.get(key);
    if (pending) return pending as Promise<T>;
    const generation = this.generation;
    const request = Promise.resolve().then(load).then(value => {
      if (generation === this.generation) {
        this.values.delete(key);
        this.values.set(key, value);
        if (this.values.size > 30) this.values.delete(this.values.keys().next().value!);
      }
      return value;
    }).finally(() => {
      if (generation === this.generation) this.requests.delete(key);
    });
    this.requests.set(key, request);
    return request;
  }
}
