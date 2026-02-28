/**
 * useCollectProRealtime
 *
 * Responsibilities:
 *  • Subscribe to coll_items + coll_partners realtime changes
 *  • Fix DELETE payload bug: payload.new is {} (truthy) for DELETEs — must use payload.old
 *  • Auto-reconnect with exponential backoff (1 s, 2 s, 4 s … 30 s cap)
 *  • Re-fetch all data after a reconnect to catch any changes missed during downtime
 *  • Track browser online/offline events for immediate response
 *  • Expose connection state for UI indicator
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionItem, Partner } from "./types";

export type ConnState = "connecting" | "live" | "reconnecting" | "offline";

interface RealtimeCallbacks {
  onItem:    (event: string, item: CollectionItem) => void;
  onPartner: (event: string, partner: Partner)     => void;
  onRefetch: () => void;
}

export function useCollectProRealtime(cbs: RealtimeCallbacks): ConnState {
  const [connState, setConnState] = useState<ConnState>("connecting");

  const cbRef       = useRef(cbs);
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryCount  = useRef(0);
  const isDestroyed = useRef(false);
  const retryTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLive     = useRef(false); // true once we've had at least one SUBSCRIBED

  // Keep callbacks fresh without triggering the main effect
  useEffect(() => { cbRef.current = cbs; });

  useEffect(() => {
    isDestroyed.current = false;

    function cleanup() {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (isDestroyed.current) return;
      cleanup();
      retryCount.current++;
      const delay = Math.min(1_000 * Math.pow(2, retryCount.current - 1), 30_000);
      setConnState("reconnecting");
      retryTimer.current = setTimeout(connect, delay);
    }

    function connect() {
      if (isDestroyed.current) return;
      // Only show "connecting" on the very first attempt; subsequent attempts show "reconnecting"
      if (retryCount.current === 0) setConnState("connecting");

      const channel = supabase
        .channel("collectpro-live-v2")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "coll_items" },
          (payload) => {
            // BUG FIX: for DELETE events payload.new === {} (truthy), not null.
            // Using ?? would always pick payload.new and lose the deleted row's id.
            const item = payload.eventType === "DELETE" ? payload.old : payload.new;
            cbRef.current.onItem(payload.eventType, item as CollectionItem);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "coll_partners" },
          (payload) => {
            const partner = payload.eventType === "DELETE" ? payload.old : payload.new;
            cbRef.current.onPartner(payload.eventType, partner as Partner);
          }
        )
        .subscribe((status) => {
          if (isDestroyed.current) return;

          if (status === "SUBSCRIBED") {
            const needsRefetch = wasLive.current; // was previously live → may have missed changes
            wasLive.current = true;
            retryCount.current = 0;
            setConnState("live");
            if (needsRefetch) cbRef.current.onRefetch();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            scheduleReconnect();
          }
        });

      channelRef.current = channel;
    }

    // Reconnect immediately when browser comes back online
    function handleOnline() {
      if (isDestroyed.current) return;
      cleanup();
      retryCount.current = 0;
      connect();
    }

    // Mark as offline and tear down channel when browser loses connection
    function handleOffline() {
      if (isDestroyed.current) return;
      cleanup();
      setConnState("offline");
    }

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);

    connect();

    return () => {
      isDestroyed.current = true;
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return connState;
}
