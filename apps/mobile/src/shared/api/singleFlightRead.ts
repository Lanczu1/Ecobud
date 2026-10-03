export function singleFlightRead<T>(read: (token: string) => Promise<T>) {
  const requests = new Map<string, Promise<T>>();
  return (token: string): Promise<T> => {
    const existing = requests.get(token);
    if (existing) return existing;
    const pending = read(token).finally(() => {
      if (requests.get(token) === pending) requests.delete(token);
    });
    requests.set(token, pending);
    return pending;
  };
}
