import { prisma } from '../config/prisma';

const SEQUENCE = 'alaap_order_number_seq';

/**
 * Order numbers come from a Postgres sequence rather than `count() + 1`, so
 * two customers checking out in the same millisecond can never collide.
 */
export async function ensureOrderNumberSequence(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS ${SEQUENCE} START WITH 1048 INCREMENT BY 1`);
}

export async function nextOrderNumber(): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<{ nextval: bigint }[]>(`SELECT nextval('${SEQUENCE}') AS nextval`);
  const value = rows[0]?.nextval ?? BigInt(1048);
  return `CA-${value.toString()}`;
}
