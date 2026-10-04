import type { SwapChatMessage } from './types';

export function mergeMessages(current: SwapChatMessage[], incoming: SwapChatMessage[]): SwapChatMessage[] {
  const byId = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, message));
  const result = [...byId.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id));
  return result.length === current.length && result.every((message, index) => JSON.stringify(message) === JSON.stringify(current[index])) ? current : result;
}
