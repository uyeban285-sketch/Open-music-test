import { Module } from '@nestjs/common';

import { SmartPlaylistsService } from './smart-playlists.service';

@Module({
  providers: [SmartPlaylistsService],
  exports: [SmartPlaylistsService],
})
export class SmartPlaylistsModule {}
