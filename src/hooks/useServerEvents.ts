import { useLayoutEffect, useRef } from "react";
import { API_BASE_URL } from "@/config/apiConfig";

type SSEHandler = (data: Record<string, unknown>) => void;

const KNOWN_EVENTS = [
  "join_request_changed",
  "join_request_pending",
  "publication_pending",
  "publication_approved",
  "publication_rejected",
  "activity_changed",
  "achievement_changed",
  "session_changed",
  "leaderboard_changed",
  "student_changed",
] as const;

export type ServerEventType = (typeof KNOWN_EVENTS)[number];

const listeners = new Map<string, Set<SSEHandler>>();
let eventSource: EventSource | null = null;

export function getEventsUrl(): string {
  const base = API_BASE_URL.replace(/\/+$/, "");
  return base ? `${base}/api/events` : "/api/events";
}

function dispatch(eventType: string, data: Record<string, unknown>) {
  const handlers = listeners.get(eventType);
  if (!handlers?.size) return;
  handlers.forEach((handler) => {
    try {
      handler(data);
    } catch (err) {
    }
  });
}

function attachSourceListeners() {
  if (!eventSource) return;
  KNOWN_EVENTS.forEach((eventType) => {
    eventSource!.addEventListener(eventType, (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
        dispatch(eventType, data);
      } catch {
        dispatch(eventType, {});
      }
    });
  });
}

function ensureConnection() {
  if (eventSource) return;

  const url = getEventsUrl();
  eventSource = new EventSource(url);
  attachSourceListeners();

  eventSource.onopen = () => {};

  eventSource.onerror = () => {};
}

function maybeCloseConnection() {
  let total = 0;
  for (const set of listeners.values()) total += set.size;
  if (total === 0 && eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

/** Subscribe to SSE; opens the shared connection when the first subscriber mounts. */
export function useServerEvent(
  eventType: ServerEventType,
  handler: SSEHandler,
  enabled = true,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useLayoutEffect(() => {
    if (!enabled) return;

    const wrapped: SSEHandler = (data) => handlerRef.current(data);

    if (!listeners.has(eventType)) {
      listeners.set(eventType, new Set());
    }
    listeners.get(eventType)!.add(wrapped);
    ensureConnection();

    return () => {
      listeners.get(eventType)?.delete(wrapped);
      maybeCloseConnection();
    };
  }, [eventType, enabled]);
}

/** @deprecated Prefer useServerEvent on each page — kept for AdminLayout compatibility */
export function useServerEventsConnection() {
  useLayoutEffect(() => {
    ensureConnection();
    return () => maybeCloseConnection();
  }, []);
}
