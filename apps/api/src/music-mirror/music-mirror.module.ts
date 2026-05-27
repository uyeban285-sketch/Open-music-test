import { Module } from '@nestjs/common';

import { MusicMirrorService } from './music-mirror.service';

@Module({
  providers: [MusicMirrorService],
  exports: [MusicMirrorService],
})
export class MusicMirrorModule {}
