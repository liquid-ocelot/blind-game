import { Injectable } from '@nestjs/common';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';

export interface MusicTrack {
  id: string;
  filename: string;
  title: string;
  url: string;
}

@Injectable()
export class MusicService {
  private musicDir: string;

  constructor() {
    const homedirMusica = join(homedir(), 'musica');
    const localMusic = join(process.cwd(), 'music');
    const apiMusic = join(process.cwd(), 'apps', 'api', 'music');

    if (existsSync(homedirMusica)) {
      this.musicDir = homedirMusica;
    } else if (existsSync(localMusic)) {
      this.musicDir = localMusic;
    } else if (existsSync(apiMusic)) {
      this.musicDir = apiMusic;
    } else {
      this.musicDir = homedirMusica;
    }
  }

  getMusicDirectory(): string {
    return this.musicDir;
  }

  getAvailableTracks(): MusicTrack[] {
    if (!existsSync(this.musicDir)) {
      return [];
    }

    const supportedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    try {
      const files = readdirSync(this.musicDir);
      return files
        .filter((file) => {
          const lower = file.toLowerCase();
          return supportedExtensions.some((ext) => lower.endsWith(ext));
        })
        .map((file, index) => {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          return {
            id: String(index + 1),
            filename: file,
            title: nameWithoutExt,
            url: `/music/${encodeURIComponent(file)}`,
          };
        });
    } catch (err) {
      console.error('Error reading music directory:', err);
      return [];
    }
  }
}
