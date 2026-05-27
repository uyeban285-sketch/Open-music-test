import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { RlsMiddleware } from './rls.middleware';

@Module({})
export class RlsMiddlewareModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RlsMiddleware).forRoutes('*');
  }
}
