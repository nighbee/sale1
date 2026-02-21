import { useEffect, useRef, useCallback } from 'react';

interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
  user_id?: string;
  company_id?: string;
}

export const useWebSocket = (onMessage: (msg: WSMessage) => void) => {
  const socketRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Use absolute URL for WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        if (isMounted.current) {
          onMessage(msg);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      if (!isMounted.current) return;
      console.log('WebSocket disconnected, retrying in 5s...');
      setTimeout(() => {
        if (isMounted.current) {
          connectRef.current();
        }
      }, 5000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      ws.close();
    };

    socketRef.current = ws;
  }, [onMessage]);

  useEffect(() => {
    connectRef.current = connect;
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);
};
