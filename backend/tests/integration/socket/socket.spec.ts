import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { createServer } from 'http';
import { io as ClientIO, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';

import { createApp } from '@/app';
import { initializeSocketServer } from '@/lib/socket';
import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../helpers/database';
import { ACCESS_COOKIE_NAME } from '@/utils/cookies';
import { createTestTenant, createSession, type TenantSession } from '../../helpers/tenant';

const app = createApp();

describe('Socket.IO Server', () => {
  let httpServer: ReturnType<typeof createServer>;
  let serverPort: number;
  let ioServer: ReturnType<typeof initializeSocketServer>;
  let tenant: Awaited<ReturnType<typeof createTestTenant>>;
  let ownerSession: TenantSession;

  beforeAll(async () => {
    await resetDatabase();
    tenant = await createTestTenant('SocketTest');

    // Create a session for the owner
    ownerSession = await createSession(tenant.users.owner, tenant.outlet.id);

    // Create HTTP server with Express app
    httpServer = createServer(app);

    // Initialize Socket.IO server
    ioServer = initializeSocketServer(httpServer);

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address() as AddressInfo;
        serverPort = address.port;
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    if (ioServer) {
      ioServer.close();
    }
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  const createSocket = (cookie: string): Socket => {
    return ClientIO(`http://localhost:${serverPort}`, {
      extraHeaders: { Cookie: cookie },
      transports: ['websocket', 'polling'],
      forceNew: true,
    });
  };

  it('rejects connection without authentication cookie', (done) => {
    const socket = createSocket('');
    socket.on('connect_error', (error) => {
      expect(error.message).toBe('Authentication required');
      socket.close();
      done();
    });
  });

  it('rejects connection with invalid token', (done) => {
    // Send a cookie with the correct name but invalid token value
    const socket = createSocket(`${ACCESS_COOKIE_NAME}=invalid-token`);
    socket.on('connect_error', (error) => {
      expect(error.message).toBe('Invalid or expired token');
      socket.close();
      done();
    });
  });

  it('accepts connection with valid owner token', (done) => {
    const socket = createSocket(`${ownerSession.cookie}`);
    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      socket.close();
      done();
    });
    socket.on('connect_error', (error) => {
      throw error;
    });
  });

  it('allows owner to join outlet room', (done) => {
    const socket = createSocket(`${ownerSession.cookie}`);
    socket.on('connect', () => {
      socket.emit(
        'join:outlet',
        tenant.outlet.id,
        (response: { success: boolean; error?: string }) => {
          expect(response.success).toBe(true);
          socket.close();
          done();
        },
      );
    });
    socket.on('connect_error', (error) => {
      throw error;
    });
  });

  it('rejects joining non-existent outlet', (done) => {
    const socket = createSocket(`${ownerSession.cookie}`);
    socket.on('connect', () => {
      socket.emit(
        'join:outlet',
        '00000000-0000-0000-0000-000000000000',
        (response: { success: boolean; error?: string }) => {
          expect(response.success).toBe(false);
          expect(response.error).toBeDefined();
          socket.close();
          done();
        },
      );
    });
    socket.on('connect_error', (error) => {
      throw error;
    });
  });

  it('rejects joining outlet from different organization', async () => {
    // Create another tenant
    const otherTenant = await createTestTenant('OtherOrg');
    const otherSession = await createSession(otherTenant.users.owner, otherTenant.outlet.id);

    const socket = createSocket(`${otherSession.cookie}`);
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit(
          'join:outlet',
          tenant.outlet.id,
          (response: { success: boolean; error?: string }) => {
            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
            socket.close();
            resolve();
          },
        );
      });
      socket.on('connect_error', (error) => {
        reject(error);
      });
    });
  }, 30000);
});
