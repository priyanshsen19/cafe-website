import type { Prisma, Role, User } from '@prisma/client';
import { prisma } from '../config/prisma';

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findById(id: string): Promise<PublicUser | null> {
  return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
}

export function findByIdWithPassword(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

/**
 * Creating a user also provisions their cart and wishlist, so every downstream
 * feature can assume those exist.
 */
export function createUser(data: {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role?: Role;
}): Promise<PublicUser> {
  return prisma.user.create({
    data: {
      ...data,
      cart: { create: {} },
      wishlist: { create: {} },
    },
    select: publicUserSelect,
  });
}

export function updateUser(id: string, data: Prisma.UserUpdateInput): Promise<PublicUser> {
  return prisma.user.update({ where: { id }, data, select: publicUserSelect });
}
