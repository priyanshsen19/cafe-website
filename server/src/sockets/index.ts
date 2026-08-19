import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { verifyAccessToken } from '../utils/tokens';

export type OrderEvent =
  | 'order:created'
  | 'order:accepted'
  | 'order:preparing'
  | 'order:ready'
  | 'order:out_for_delivery'
  | 'order:delivered'
  | 'order:completed'
  | 'order:cancelled'
  | 'order:updated';

interface SocketUser {
  id: string;
  role: Role;
}

let io: Server | null = null;

const ROOM = {
  order: (orderId: string) => `order:${orderId}`,
  user: (userId: string) => `user:${userId}`,
  kitchen: 'kitchen',
  admin: 'admin',
};

export function initSockets(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    path: '/socket.io',
  });

  // Handshake auth: a token is optional (public order tracking by id is not
  // allowed, so an anonymous socket simply gets no rooms).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next();
    try {
      const payload = verifyAccessToken(token);
      (socket.data as { user?: SocketUser }).user = { id: payload.sub, role: payload.role };
    } catch {
      // Ignore an invalid token; the socket stays anonymous.
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as { user?: SocketUser }).user;

    if (user) {
      void socket.join(ROOM.user(user.id));
      if (user.role === 'STAFF' || user.role === 'ADMIN') {
        void socket.join(ROOM.kitchen);
      }
      if (user.role === 'ADMIN') {
        void socket.join(ROOM.admin);
      }
    }

    /**
     * Customers can only subscribe to their own orders — ownership is verified
     * against the database rather than trusted from the client.
     */
    socket.on('order:subscribe', async (orderId: unknown, ack?: (result: { ok: boolean }) => void) => {
      if (typeof orderId !== 'string' || !user) return ack?.({ ok: false });

      if (user.role === 'STAFF' || user.role === 'ADMIN') {
        await socket.join(ROOM.order(orderId));
        return ack?.({ ok: true });
      }

      const order = await prisma.order.findFirst({
        where: { id: orderId, userId: user.id },
        select: { id: true },
      });

      if (!order) return ack?.({ ok: false });
      await socket.join(ROOM.order(orderId));
      ack?.({ ok: true });
    });

    socket.on('order:unsubscribe', (orderId: unknown) => {
      if (typeof orderId === 'string') void socket.leave(ROOM.order(orderId));
    });
  });

  return io;
}

/**
 * Fans an order change out to the three audiences that care: the customer
 * watching the tracking page, the kitchen floor, and the admin dashboard.
 */
export function emitOrderEvent(event: OrderEvent, order: { id: string; userId: string }, payload: unknown): void {
  if (!io) return;
  io.to(ROOM.order(order.id)).emit(event, payload);
  io.to(ROOM.user(order.userId)).emit(event, payload);
  io.to(ROOM.kitchen).emit(event, payload);
  io.to(ROOM.admin).emit(event, payload);
}

export function getIO(): Server | null {
  return io;
}
