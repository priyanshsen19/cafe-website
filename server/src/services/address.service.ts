import type { AddressType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';

export interface AddressInput {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  addressType?: AddressType;
  isDefault?: boolean;
  instructions?: string;
}

export function listAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

/** Only one address can be the default, so setting one clears the rest. */
async function clearOtherDefaults(userId: string, keepId?: string) {
  await prisma.address.updateMany({
    where: { userId, isDefault: true, ...(keepId ? { id: { not: keepId } } : {}) },
    data: { isDefault: false },
  });
}

export async function createAddress(userId: string, input: AddressInput) {
  const count = await prisma.address.count({ where: { userId } });
  const shouldBeDefault = input.isDefault || count === 0;

  if (shouldBeDefault) await clearOtherDefaults(userId);

  return prisma.address.create({
    data: { ...input, userId, isDefault: shouldBeDefault },
  });
}

async function assertOwned(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw AppError.notFound('We couldn’t find that address.', 'ADDRESS_NOT_FOUND');
  return address;
}

export async function updateAddress(userId: string, addressId: string, input: Partial<AddressInput>) {
  await assertOwned(userId, addressId);
  if (input.isDefault) await clearOtherDefaults(userId, addressId);

  return prisma.address.update({ where: { id: addressId }, data: input });
}

export async function deleteAddress(userId: string, addressId: string) {
  const address = await assertOwned(userId, addressId);
  await prisma.address.delete({ where: { id: addressId } });

  // Promote another address so the customer always has a default.
  if (address.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  return { ok: true };
}

export async function setDefault(userId: string, addressId: string) {
  await assertOwned(userId, addressId);
  await clearOtherDefaults(userId, addressId);
  return prisma.address.update({ where: { id: addressId }, data: { isDefault: true } });
}
