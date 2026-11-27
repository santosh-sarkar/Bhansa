import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { jwtVerify } from 'jose';

import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface SocketUser {
  id: string;
  email: string;
  full_name: string;
  organization_id: string | null;
  is_super_admin: boolean;
}

export interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
  outletId?: string;
}

// Module-level variable to store the Socket.IO server instance
let _io: Server | null = null;

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

/**
 * Get the Socket.IO server instance.
 * Must be called after `initializeSocketServer` has been called.
 */
export function getIO(): Server | null {
  return _io;
}

/**
 * Extract access token from socket handshake.
 * Checks handshake.auth.token first, then Authorization header.
 */
function extractAccessToken(socket: AuthenticatedSocket): string | undefined {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }

  return undefined;
}

export async function verifySocketToken(token: string): Promise<SocketUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        full_name: true,
        organization_id: true,
        is_super_admin: true,
        is_active: true,
        email_verified_at: true,
      },
    });

    if (!user || !user.is_active || !user.email_verified_at) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      organization_id: user.organization_id,
      is_super_admin: user.is_super_admin,
    };
  } catch {
    return null;
  }
}

async function loadUserAssignments(userId: string, _organizationId: string) {
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      user_id: userId,
      role: {
        rolePermissions: {
          some: { permission: { code: { not: '' } } },
        },
      },
    },
    select: {
      outlet_id: true,
      role: {
        select: { code: true },
      },
    },
  });

  return assignments;
}

export function initializeSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Store the IO instance for later use
  _io = io;

  // Authentication middleware - optional auth (guest allowed)
  io.use((socket: AuthenticatedSocket, next) => {
    void (async () => {
      try {
        const token = extractAccessToken(socket);

        if (!token) {
          // Guest connection - allowed
          logger.debug({ socketId: socket.id }, 'Anonymous socket connected');
          return next();
        }

        const user = await verifySocketToken(token);
        if (!user) {
          return next(new Error('Invalid or expired token'));
        }

        socket.user = user;
        next();
      } catch (error) {
        logger.error({ err: error }, 'Socket authentication error');
        next(new Error('Authentication failed'));
      }
    })();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    // Guest connections are allowed - no forced disconnect for unauthenticated users

    if (socket.user) {
      logger.info({ userId: socket.user.id, socketId: socket.id }, 'Socket connected');
    } else {
      logger.info({ socketId: socket.id }, 'Anonymous socket connected');
    }

    // Handle joining outlet rooms (requires authentication)
    socket.on(
      'join:outlet',
      async (
        outletId: string,
        callback?: (response: { success: boolean; error?: string }) => void,
      ) => {
        try {
          // Require authentication for outlet rooms
          if (!socket.user || !socket.user.organization_id) {
            callback?.({ success: false, error: 'User must belong to an organization' });
            return;
          }

          // Verify outlet exists and user has access
          const outlet = await prisma.outlet.findFirst({
            where: {
              id: outletId,
              organization_id: socket.user.organization_id,
              deleted_at: null,
            },
            select: { id: true },
          });

          if (!outlet) {
            callback?.({ success: false, error: 'Outlet not found or access denied' });
            return;
          }

          // Check user has assignment for this outlet (or org-wide as Owner)
          const assignments = await loadUserAssignments(
            socket.user.id,
            socket.user.organization_id,
          );
          const hasAccess = assignments.some(
            (a) => a.outlet_id === null || a.outlet_id === outletId,
          );

          if (!hasAccess) {
            callback?.({ success: false, error: 'Not assigned to this outlet' });
            return;
          }

          // Join outlet-specific rooms based on role
          const roles = assignments
            .filter((a) => a.outlet_id === null || a.outlet_id === outletId)
            .map((a) => a.role.code);

          const uniqueRoles = [...new Set(roles)];

          // Join waiters room if user is Waiter or Manager or Owner
          if (uniqueRoles.some((r) => ['waiter', 'manager', 'owner'].includes(r))) {
            await socket.join(`outlet:${outletId}:waiters`);
          }

          // Join kitchen room if user is Kitchen or Manager or Owner
          if (uniqueRoles.some((r) => ['kitchen', 'manager', 'owner'].includes(r))) {
            await socket.join(`outlet:${outletId}:kitchen`);
          }

          // Join managers room if user is Manager or Owner
          if (uniqueRoles.some((r) => ['manager', 'owner'].includes(r))) {
            await socket.join(`outlet:${outletId}:managers`);
          }

          socket.outletId = outletId;

          logger.info(
            { userId: socket.user.id, outletId, roles: uniqueRoles, socketId: socket.id },
            'Socket joined outlet rooms',
          );

          callback?.({ success: true });
        } catch (error) {
          logger.error({ err: error, outletId }, 'Failed to join outlet');
          callback?.({ success: false, error: 'Internal server error' });
        }
      },
    );

    // Handle joining session room (for guests - public)
    socket.on(
      'join:session',
      async (
        sessionId: string,
        callback?: (response: { success: boolean; error?: string }) => void,
      ) => {
        try {
          // For guests, we don't require authentication, just validate session exists
          const session = await prisma.tableSession.findFirst({
            where: { id: sessionId, status: { not: 'closed' } },
            select: { id: true },
          });

          if (!session) {
            callback?.({ success: false, error: 'Session not found or closed' });
            return;
          }

          await socket.join(`session:${sessionId}`);

          logger.info({ sessionId, socketId: socket.id }, 'Socket joined session');

          callback?.({ success: true });
        } catch (error) {
          logger.error({ err: error, sessionId }, 'Failed to join session');
          callback?.({ success: false, error: 'Internal server error' });
        }
      },
    );

    // Handle leaving outlet
    socket.on(
      'leave:outlet',
      async (outletId: string, callback?: (response: { success: boolean }) => void) => {
        await socket.leave(`outlet:${outletId}:waiters`);
        await socket.leave(`outlet:${outletId}:kitchen`);
        await socket.leave(`outlet:${outletId}:managers`);
        delete (socket as { outletId?: string }).outletId;
        callback?.({ success: true });
      },
    );

    // Handle leaving session
    socket.on(
      'leave:session',
      async (sessionId: string, callback?: (response: { success: boolean }) => void) => {
        await socket.leave(`session:${sessionId}`);
        callback?.({ success: true });
      },
    );

    socket.on('disconnect', (reason) => {
      const userId = socket.user?.id;
      logger.info({ userId, socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

// Helper functions to emit events to rooms
export function emitToOutletWaiters(
  io: Server,
  outletId: string,
  event: string,
  data: unknown,
): void {
  io.to(`outlet:${outletId}:waiters`).emit(event, data);
}

export function emitToOutletKitchen(
  io: Server,
  outletId: string,
  event: string,
  data: unknown,
): void {
  io.to(`outlet:${outletId}:kitchen`).emit(event, data);
}

export function emitToOutletManagers(
  io: Server,
  outletId: string,
  event: string,
  data: unknown,
): void {
  io.to(`outlet:${outletId}:managers`).emit(event, data);
}

export function emitToSession(io: Server, sessionId: string, event: string, data: unknown): void {
  io.to(`session:${sessionId}`).emit(event, data);
}

// Event types for type safety
export interface OrderPendingEvent {
  orderId: string;
  tableLabel: string;
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    price: string;
  }>;
  createdAt: string;
}

export interface OrderConfirmedEvent {
  orderId: string;
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
  }>;
}

export interface OrderRejectedEvent {
  orderId: string;
  reason: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  status: string;
  previousStatus: string;
}

export interface ItemAvailabilityChangedEvent {
  menuItemId: string;
  outletId: string;
  isAvailable: boolean;
}

export interface StockLowEvent {
  ingredientId: string;
  name: string;
  currentStock: number;
  threshold: number;
  outletId: string;
}

export interface SessionBillRequestedEvent {
  sessionId: string;
  tableLabel: string;
}

export interface SessionClosedEvent {
  sessionId: string;
  tableLabel: string;
}