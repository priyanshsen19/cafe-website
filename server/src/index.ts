import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { initSockets } from './sockets';
import { ensureOrderNumberSequence } from './utils/orderNumber';

async function bootstrap() {
  await prisma.$connect();
  await ensureOrderNumberSequence();

  const app = createApp();
  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `\n  ALAAP API ready\n` +
        `  ├ http://localhost:${env.PORT}\n` +
        `  ├ client   ${env.CLIENT_URL}\n` +
        `  ├ payments ${env.PAYMENT_MODE}${env.PAYMENT_MODE === 'mock' ? '  (development simulation)' : ''}\n` +
        `  └ env      ${env.NODE_ENV}\n`,
    );
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received — shutting down.`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});
