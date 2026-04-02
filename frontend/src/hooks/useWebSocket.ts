import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { Toast } from 'antd-mobile';

export function useWebSocket(roomCode: string | null, token: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const maxRetry = 15;
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const { handleWsMessage, setWsConnected } = useGameStore();

  const connect = useCallback(() => {
    if (!roomCode || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/${roomCode}?token=${token}`);

    ws.onopen = () => {
      retryCount.current = 0;
      setWsConnected(true);
      // Ping every 30s
      pingInterval.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch {
        // ignore non-JSON
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }
      if (retryCount.current < maxRetry) {
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current++;
        setTimeout(connect, delay);
      } else {
        Toast.show({ content: '连接已断开，请刷新页面', duration: 0 });
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [roomCode, token, handleWsMessage, setWsConnected]);

  useEffect(() => {
    connect();
    return () => {
      if (pingInterval.current) clearInterval(pingInterval.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return wsRef;
}
