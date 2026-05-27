import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Set the app.user_id for Row Level Security within a transaction.
   */
  async setRlsUserId(userId: string) {
    await this.$executeRawUnsafe(`SET LOCAL app.user_id = '${userId}'`);
  }
}
