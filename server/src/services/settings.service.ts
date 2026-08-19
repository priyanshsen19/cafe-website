import type { Setting } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * Business settings live in a single row so tax rate and delivery pricing are
 * operator-tunable configuration rather than constants buried in code.
 */
export async function getSettings(): Promise<Setting> {
  const existing = await prisma.setting.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;
  return prisma.setting.create({ data: { id: 'singleton' } });
}

export async function updateSettings(data: Partial<Omit<Setting, 'id' | 'updatedAt'>>): Promise<Setting> {
  await getSettings();
  return prisma.setting.update({ where: { id: 'singleton' }, data });
}
