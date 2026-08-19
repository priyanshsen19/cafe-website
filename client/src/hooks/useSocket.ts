import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken, BASE_URL } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * One shared Socket.IO connection per session. Reconnects with the current
 * access token so the server can scope the socket to this customer's orders.
 */
let socket: Socket | null = null;

function getSocket(): Socket {
  socket ??= io(BASE_URL, {
    path: '/socket.io',
    withCredentials: true,
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: (callback) => callback({ token: getAccessToken() }),
  });
  return socket;
}

export function useSocketConnection(): { socket: Socket | null; isConnected: boolean } {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const instance = getSocket();
    if (!instance.connected) instance.connect();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);
    setIsConnected(instance.connected);

    return () => {
      instance.off('connect', onConnect);
      instance.off('disconnect', onDisconnect);
    };
  }, [isAuthenticated]);

  return { socket: isAuthenticated ? getSocket() : null, isConnected };
}

const ORDER_EVENTS = [
  'order:created',
  'order:accepted',
  'order:preparing',
  'order:ready',
  'order:out_for_delivery',
  'order:delivered',
  'order:completed',
  'order:cancelled',
  'order:updated',
] as const;

/**
 * Subscribes to live updates for one order. The server verifies ownership before
 * joining the room, so a guessed order id gets nothing.
 */
export function useOrderSocket(orderId: string | undefined, onUpdate: () => void) {
  const { socket: instance } = useSocketConnection();
  const handler = useRef(onUpdate);
  handler.current = onUpdate;

  useEffect(() => {
    if (!instance || !orderId) return;

    const subscribe = () => instance.emit('order:subscribe', orderId);
    if (instance.connected) subscribe();
    instance.on('connect', subscribe);

    const notify = () => handler.current();
    for (const event of ORDER_EVENTS) instance.on(event, notify);

    return () => {
      instance.emit('order:unsubscribe', orderId);
      instance.off('connect', subscribe);
      for (const event of ORDER_EVENTS) instance.off(event, notify);
    };
  }, [instance, orderId]);
}

/** Staff screens listen to the whole kitchen room rather than a single order. */
export function useKitchenSocket(onUpdate: () => void) {
  const { socket: instance, isConnected } = useSocketConnection();
  const handler = useRef(onUpdate);
  handler.current = onUpdate;

  useEffect(() => {
    if (!instance) return;

    const notify = () => handler.current();
    for (const event of ORDER_EVENTS) instance.on(event, notify);

    return () => {
      for (const event of ORDER_EVENTS) instance.off(event, notify);
    };
  }, [instance]);

  return isConnected;
}
