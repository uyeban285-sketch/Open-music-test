import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module';

import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [PlaybackController],
  providers: [PlaybackService],
  exports: [PlaybackService],
})
export class PlaybackModule {}
