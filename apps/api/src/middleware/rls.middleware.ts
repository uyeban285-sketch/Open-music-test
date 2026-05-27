import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Global middleware that sets `app.user_id` in the current Postgres transaction
 * for Row Level Security. The userId comes from the validated JWT (set by AuthGuard).
 * Compatible with PgBouncer transaction-mode.
 */
@Injectable()
export class RlsMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const userId = (req as any).userId;
    if (userId) {
      // In transaction-mode PgBouncer, SET LOCAL is safe (scoped to transaction)
      await this.prisma.setRlsUserId(userId);
    }
    next();
  }
}
