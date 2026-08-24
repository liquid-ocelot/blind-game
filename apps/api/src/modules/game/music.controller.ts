import { Controller, Get } from '@nestjs/common';
import { MusicService, MusicTrack } from './music.service';

@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Get('list')
  getMusicList(): MusicTrack[] {
    return this.musicService.getAvailableTracks();
  }

  @Get('tracks')
  getTracks(): MusicTrack[] {
    return this.musicService.getAvailableTracks();
  }
}
