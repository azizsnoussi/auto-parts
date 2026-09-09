import { useEffect, useRef, useState } from 'react';
import { apiUrl, type NotificationItem } from '../lib/api';
import { getAccessToken } from '../lib/cookies';

/**
 * Live notification stream for the admin bell.
 *
 * ## Why `fetch` and not `EventSource`
 *
 * The backend authenticates every request from the `Authorization` header, and
 * `EventSource` cannot set headers — its only escape hatch is a token in the
 * query string, which would end up in access logs, proxy logs and browser
 * history. So the stream is read as a plain `fetch` response and the
 * `text/event-stream` framing is parsed here. It is a dozen lines of parsing in
 * exchange for not inventing a second authentication path.
 *
 * ## Why SSE and not a WebSocket
 *
 * Traffic is one-way (server → staff) and low-volume. SSE needs no extra
 * dependency, no handshake interceptor, no STOMP broker, and no `ws: true` on
 * the Vite dev proxy; it is an ordinary HTTP response, so every intermediary
 * already knows what to do with it.
 *
 * ## Failure behaviour
 *
 * The stream is a **latency shortcut, not the source of truth**: notifications
 * are rows in the database and the bell also polls. If the connection drops,
 * reconnection is attempted with exponential backoff (1s → 30s, jittered) and
 * the UI keeps working off the polled feed in the meantime. A 401/403 stops the
 * loop entirely — retrying a permission error just burns requests.
 */

/** Frames the backend sends. `ready` is the handshake, `ping` the keep-alive. */
type StreamEvent = 'ready' | 'ping' | 'notification';

interface UseNotificationStreamOptions {
  /** Set false to leave the socket closed (e.g. the user is not staff). */
  enabled?: boolean;
  /** Called once per new notification pushed by the server. */
  onNotification: (item: NotificationItem) => void;
  /** Authenticated SSE endpoint. Defaults to the staff channel. */
  streamPath?: string;
}

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'retrying' | 'denied';

export function useNotificationStream({
  enabled = true,
  onNotification,
  streamPath = '/notifications/stream',
}: UseNotificationStreamOptions) {
  const [status, setStatus] = useState<StreamStatus>('idle');

  // Kept in a ref so reconnecting never re-subscribes with a stale callback and
  // never re-runs the effect just because the parent re-rendered.
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    /** 1s, 2s, 4s … capped at 30s, with jitter so tabs don't reconnect in lockstep. */
    const backoffMs = () => Math.min(1000 * 2 ** attempt, 30_000) * (0.75 + Math.random() * 0.5);

    const dispatch = (event: StreamEvent | string, data: string) => {
      if (event === 'ping' || event === 'ready') return;
      if (event !== 'notification' || !data) return;
      try {
        onNotificationRef.current(JSON.parse(data) as NotificationItem);
      } catch {
        // A malformed frame must not kill the stream; the polled feed covers it.
      }
    };

    /**
     * Parses `text/event-stream`: records are separated by a blank line, and
     * within a record `event:` names it while `data:` carries the payload
     * (possibly over several lines, which are joined with `\n`).
     */
    const consume = (chunk: string, carry: string): string => {
      const buffer = carry + chunk;
      const records = buffer.split(/\r?\n\r?\n/);
      // The last element is either empty (buffer ended on a separator) or a
      // partial record; either way it goes back into the carry.
      const tail = records.pop() ?? '';
      for (const record of records) {
        let event = 'message';
        const dataLines: string[] = [];
        for (const rawLine of record.split(/\r?\n/)) {
          if (!rawLine || rawLine.startsWith(':')) continue; // comment / keep-alive
          const colon = rawLine.indexOf(':');
          const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
          const value = colon === -1 ? '' : rawLine.slice(colon + 1).replace(/^ /, '');
          if (field === 'event') event = value;
          else if (field === 'data') dataLines.push(value);
        }
        dispatch(event, dataLines.join('\n'));
      }
      return tail;
    };

    const connect = async () => {
      if (stopped) return;
      const token = getAccessToken();
      if (!token) {
        // Nothing to authenticate with yet (first paint after a reload). Retry
        // rather than give up: the cookie is usually there a moment later.
        setStatus('retrying');
        retryTimer = setTimeout(connect, 2000);
        return;
      }

      setStatus(attempt === 0 ? 'connecting' : 'retrying');
      try {
        const res = await fetch(apiUrl(streamPath), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (res.status === 401 || res.status === 403) {
          setStatus('denied');
          return; // Not a transient failure — stop.
        }
        if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`);

        setStatus('open');
        attempt = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let carry = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          carry = consume(decoder.decode(value, { stream: true }), carry);
        }
        // The server closed (30-minute emitter timeout, restart, proxy): a clean
        // end of stream is expected, so reconnect promptly rather than backing off.
        if (!stopped) {
          attempt = 0;
          retryTimer = setTimeout(connect, 1000);
        }
      } catch (err) {
        if (stopped || controller.signal.aborted) return;
        attempt += 1;
        setStatus('retrying');
        retryTimer = setTimeout(connect, backoffMs());
      }
    };

    void connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller.abort();
    };
  }, [enabled, streamPath]);

  return { status, live: status === 'open' };
}
