"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { detectionThresholds } from "@/lib/config/detection";
import type { FlagEvent } from "@/lib/types/flags";

const mergeEvents = (current: FlagEvent[], incoming: FlagEvent[]): FlagEvent[] => {
  const map = new Map(current.map((event) => [event.id, event] as const));

  incoming.forEach((event) => {
    map.set(event.id, event);
  });

  return Array.from(map.values()).sort((a, b) => a.relativeMs - b.relativeMs);
};

export const useFlagFeed = (sessionId: string) => {
  const [events, setEvents] = useState<FlagEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const appendEvent = useCallback((event: FlagEvent) => {
    setEvents((prev) => {
      if (prev.some((existing) => existing.id === event.id)) {
        return prev;
      }

      return [...prev, event].sort((a, b) => a.relativeMs - b.relativeMs);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/flags`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok || !isMounted) {
          return;
        }

        const json = await response.json();
        const incoming: FlagEvent[] = json.session?.events ?? [];
        if (!isMounted) {
          return;
        }

        setEvents((prev) => mergeEvents(prev, incoming));
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        console.error("Failed to fetch flag events", error);
      }
    };

    fetchEvents();
    const interval = window.setInterval(fetchEvents, detectionThresholds.flagPollIntervalMs);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [sessionId]);

  return { events, appendEvent };
};
