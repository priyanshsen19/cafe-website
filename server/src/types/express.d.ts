import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth / optionalAuth. Never read from the body. */
      user?: { id: string; role: Role; email: string };
      /** Anonymous cart session id, from the alaap_sid cookie. */
      cartSessionId?: string;
    }
  }
}

export {};
