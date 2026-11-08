export type BlinkCallOutcome =
  'missed' | 'declined' | 'cancelled' | 'completed' | 'dropped';
export type BlinkCallKind = 'audio' | 'video';

export interface BlinkCallRecord {
  version: 1;
  callId: string;
  kind: BlinkCallKind;
  outcome: BlinkCallOutcome;
  durationSeconds: number;
}

export function readBlinkCallRecord(message: {
  mediaType?: string | null;
  body?: string | null;
}): BlinkCallRecord | null {
  if (message.mediaType !== 'call' || !message.body) return null;
  try {
    const value: unknown = JSON.parse(message.body);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (item.version !== 1 || typeof item.callId !== 'string' ||
        !['audio', 'video'].includes(String(item.kind)) ||
        !['missed', 'declined', 'cancelled', 'completed', 'dropped'].includes(String(item.outcome)) ||
        typeof item.durationSeconds !== 'number' ||
        !Number.isFinite(item.durationSeconds) || item.durationSeconds < 0) return null;
    return item as unknown as BlinkCallRecord;
  } catch {
    return null;
  }
}

export function blinkCallLabel(record: BlinkCallRecord, isCaller: boolean): string {
  const name = record.kind === 'video' ? 'Video' : 'Voice';
  switch (record.outcome) {
    case 'missed':
      return isCaller ? `No answer · ${name} call` : `Missed ${name.toLowerCase()} call`;
    case 'declined':
      return isCaller ? `${name} call declined` : `Declined ${name.toLowerCase()} call`;
    case 'cancelled':
      return isCaller ? `Cancelled ${name.toLowerCase()} call` : `Missed ${name.toLowerCase()} call`;
    case 'dropped':
      return `${name} call disconnected`;
    case 'completed': {
      const seconds = Math.floor(record.durationSeconds);
      const elapsed = seconds < 60 ? `${seconds}s`
        : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
      return `${name} call · ${elapsed}`;
    }
  }
}
