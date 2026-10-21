import { useEffect, useRef } from "react";

type WebSocketHandler = (event: { type: string; data?: any }) => void;

const listeners = new Set<WebSocketHandler>();

export function registerWsListener(handler: WebSocketHandler) {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

export function useWebSocketUpdates(onEvent?: WebSocketHandler) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (onEvent) {
      listeners.add(onEvent);
    }

    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
    let isSubscribed = true;

    function connect() {
      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          // Connected
        };

        socket.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            listeners.forEach((fn) => fn(parsed));
          } catch {
            // Ignore non-json ping/pong
          }
        };

        socket.onclose = () => {
          if (isSubscribed) {
            // Reconnect after 3s
            setTimeout(connect, 3000);
          }
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        // Fallback retry
        if (isSubscribed) {
          setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isSubscribed = false;
      if (onEvent) {
        listeners.delete(onEvent);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [onEvent]);
}
