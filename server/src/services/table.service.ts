import QRCode from 'qrcode';
import type { TableStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';

/**
 * The URL printed on a table's QR code. It opens the menu with the table
 * already attached, so a guest can order without talking to anyone.
 */
export function tableUrl(qrToken: string): string {
  return `${env.CLIENT_URL}/menu?table=${qrToken}`;
}

export async function listTables(cafeId?: string) {
  const tables = await prisma.cafeTable.findMany({
    where: { ...(cafeId ? { cafeId } : {}) },
    orderBy: [{ cafe: { sortOrder: 'asc' } }, { label: 'asc' }],
    include: {
      cafe: { select: { id: true, name: true, slug: true } },
      _count: {
        select: {
          orders: { where: { orderStatus: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] } } },
        },
      },
    },
  });

  return tables.map(({ _count, ...table }) => ({
    ...table,
    activeOrderCount: _count.orders,
    url: tableUrl(table.qrToken),
  }));
}

export async function createTable(input: { cafeId: string; label: string; floor?: string; capacity?: number }) {
  const cafe = await prisma.cafe.findUnique({ where: { id: input.cafeId }, select: { id: true } });
  if (!cafe) throw AppError.notFound('We couldn’t find that location.', 'CAFE_NOT_FOUND');

  const clash = await prisma.cafeTable.findFirst({
    where: { cafeId: input.cafeId, label: input.label.trim() },
  });
  if (clash) throw AppError.conflict('That table already exists at this location.', 'TABLE_EXISTS');

  return prisma.cafeTable.create({
    data: {
      cafeId: input.cafeId,
      label: input.label.trim(),
      floor: input.floor?.trim() || 'Ground',
      capacity: input.capacity ?? 2,
    },
  });
}

export async function updateTable(
  id: string,
  input: { label?: string; floor?: string; capacity?: number; status?: TableStatus; isActive?: boolean },
) {
  const existing = await prisma.cafeTable.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('We couldn’t find that table.', 'TABLE_NOT_FOUND');

  if (input.label && input.label.trim() !== existing.label) {
    const clash = await prisma.cafeTable.findFirst({
      where: { cafeId: existing.cafeId, label: input.label.trim(), id: { not: id } },
    });
    if (clash) throw AppError.conflict('Another table already uses that label.', 'TABLE_EXISTS');
  }

  return prisma.cafeTable.update({
    where: { id },
    data: { ...input, label: input.label?.trim() },
  });
}

export async function deleteTable(id: string) {
  const existing = await prisma.cafeTable.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!existing) throw AppError.notFound('We couldn’t find that table.', 'TABLE_NOT_FOUND');

  // Deactivate rather than delete when orders reference it, so history survives.
  if (existing._count.orders > 0) {
    await prisma.cafeTable.update({ where: { id }, data: { isActive: false } });
    return { ok: true, deactivated: true };
  }

  await prisma.cafeTable.delete({ where: { id } });
  return { ok: true, deactivated: false };
}

/**
 * Renders the QR as an SVG string and a PNG data URL. SVG is what you want for
 * printing table cards; the PNG is for the download button.
 */
export async function getTableQr(id: string) {
  const table = await prisma.cafeTable.findUnique({
    where: { id },
    include: { cafe: { select: { name: true, city: true } } },
  });
  if (!table) throw AppError.notFound('We couldn’t find that table.', 'TABLE_NOT_FOUND');

  const url = tableUrl(table.qrToken);

  const [svg, pngDataUrl] = await Promise.all([
    QRCode.toString(url, { type: 'svg', margin: 1, width: 512, errorCorrectionLevel: 'M' }),
    QRCode.toDataURL(url, { margin: 1, width: 1024, errorCorrectionLevel: 'M' }),
  ]);

  return {
    table: { id: table.id, label: table.label, floor: table.floor, capacity: table.capacity },
    cafe: table.cafe,
    url,
    svg,
    pngDataUrl,
  };
}

/** Bulk-create a numbered run of tables, e.g. T01 → T20. */
export async function generateTables(cafeId: string, count: number, floor = 'Ground') {
  const cafe = await prisma.cafe.findUnique({ where: { id: cafeId }, select: { id: true } });
  if (!cafe) throw AppError.notFound('We couldn’t find that location.', 'CAFE_NOT_FOUND');

  const existing = await prisma.cafeTable.findMany({ where: { cafeId }, select: { label: true } });
  const taken = new Set(existing.map((table) => table.label));

  const created = [];
  let index = 1;

  while (created.length < count && index < 200) {
    const label = `T${String(index).padStart(2, '0')}`;
    index += 1;
    if (taken.has(label)) continue;

    created.push(
      await prisma.cafeTable.create({
        data: { cafeId, label, floor, capacity: 2 },
      }),
    );
  }

  return created;
}
