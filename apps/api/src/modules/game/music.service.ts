import { Injectable, OnModuleInit } from '@nestjs/common';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  existsSync,
  readdirSync,
  statSync,
  openSync,
  readSync,
  closeSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';

export interface MusicTrack {
  id: string;
  filename: string;
  title: string;
  url: string;
  duration?: number;
}

@Injectable()
export class MusicService implements OnModuleInit {
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

    this.ensureMetadataFiles();
  }

  onModuleInit() {
    this.ensureMetadataFiles();
  }

  getMusicDirectory(): string {
    return this.musicDir;
  }

  getMetadataDirectory(): string {
    const primary = join(this.musicDir, 'metadata');
    const alt = join(this.musicDir, 'matadata');
    if (existsSync(alt) && !existsSync(primary)) {
      return alt;
    }
    return primary;
  }

  ensureMetadataFiles(): void {
    if (!existsSync(this.musicDir)) {
      return;
    }

    const metadataDir = this.getMetadataDirectory();
    if (!existsSync(metadataDir)) {
      try {
        mkdirSync(metadataDir, { recursive: true });
      } catch (err) {
        console.error('Error creating metadata directory:', err);
        return;
      }
    }

    const supportedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    try {
      const files = readdirSync(this.musicDir);
      for (const file of files) {
        const lower = file.toLowerCase();
        if (supportedExtensions.some((ext) => lower.endsWith(ext))) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const txtFileName = `${nameWithoutExt}.txt`;
          const txtFilePath = join(metadataDir, txtFileName);
          const altTxtFilePath = join(metadataDir, `${file}.txt`);

          if (!existsSync(txtFilePath) && !existsSync(altTxtFilePath)) {
            try {
              writeFileSync(txtFilePath, `${nameWithoutExt}\n`, 'utf-8');
            } catch (err) {
              console.error(`Error creating metadata file for ${file}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error ensuring metadata files:', err);
    }
  }

  getAudioDuration(filePath: string): number | undefined {
    let fd: number | null = null;
    try {
      const stat = statSync(filePath);
      const fileSize = stat.size;
      if (fileSize < 64) return undefined;

      fd = openSync(filePath, 'r');
      const buffer = Buffer.alloc(Math.min(fileSize, 65536));
      readSync(fd, buffer, 0, buffer.length, 0);

      // 1. WAV
      if (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WAVE'
      ) {
        let offset = 12;
        let byteRate = 0;
        let dataSize = 0;
        while (offset + 8 <= buffer.length) {
          const chunkId = buffer.toString('ascii', offset, offset + 4);
          const chunkSize = buffer.readUInt32LE(offset + 4);
          if (chunkId === 'fmt ' && offset + 20 <= buffer.length) {
            byteRate = buffer.readUInt32LE(offset + 16);
          } else if (chunkId === 'data') {
            dataSize = chunkSize;
            break;
          }
          offset += 8 + chunkSize;
        }
        if (byteRate > 0 && dataSize > 0) {
          return Math.round(dataSize / byteRate);
        }
        return undefined;
      }

      // 2. FLAC
      if (buffer.toString('ascii', 0, 4) === 'fLaC') {
        const blockType = buffer[4] & 0x7f;
        if (blockType === 0 && buffer.length >= 42) {
          const sampleRate =
            (buffer[18] << 12) | (buffer[19] << 4) | (buffer[20] >> 4);
          const totalSamplesHigh = buffer[21] & 0x0f;
          const totalSamplesLow = buffer.readUInt32BE(22);
          const totalSamples =
            totalSamplesHigh * 0x100000000 + totalSamplesLow;
          if (sampleRate > 0 && totalSamples > 0) {
            return Math.round(totalSamples / sampleRate);
          }
        }
      }

      // 3. MP3
      let mp3Offset = 0;
      if (buffer.toString('ascii', 0, 3) === 'ID3') {
        const id3Size =
          ((buffer[6] & 0x7f) << 21) |
          ((buffer[7] & 0x7f) << 14) |
          ((buffer[8] & 0x7f) << 7) |
          (buffer[9] & 0x7f);
        mp3Offset = id3Size + 10;
      }

      let frameBuffer = buffer;
      if (mp3Offset > 0 && mp3Offset < fileSize) {
        frameBuffer = Buffer.alloc(Math.min(fileSize - mp3Offset, 32768));
        readSync(fd, frameBuffer, 0, frameBuffer.length, mp3Offset);
      }

      for (let i = 0; i < frameBuffer.length - 4; i++) {
        if (frameBuffer[i] === 0xff && (frameBuffer[i + 1] & 0xe0) === 0xe0) {
          const b1 = frameBuffer[i + 1];
          const b2 = frameBuffer[i + 2];

          const versionBits = (b1 >> 3) & 0x03;
          const layerBits = (b1 >> 1) & 0x03;
          const bitrateIndex = (b2 >> 4) & 0x0f;
          const sampleRateIndex = (b2 >> 2) & 0x03;

          if (
            versionBits === 1 ||
            layerBits === 0 ||
            bitrateIndex === 0 ||
            bitrateIndex === 15 ||
            sampleRateIndex === 3
          ) {
            continue;
          }

          const sampleRates: Record<number, number[]> = {
            3: [44100, 48000, 32000],
            2: [22050, 24000, 16000],
            0: [11025, 12000, 8000],
          };
          const sampleRate = sampleRates[versionBits]?.[sampleRateIndex];

          let bitrate = 0;
          if (versionBits === 3 && layerBits === 1) {
            const bitrates = [
              0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
            ];
            bitrate = bitrates[bitrateIndex] * 1000;
          } else if (versionBits !== 3 && layerBits === 1) {
            const bitrates = [
              0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160,
            ];
            bitrate = bitrates[bitrateIndex] * 1000;
          } else {
            bitrate = 128000;
          }

          if (sampleRate && bitrate > 0) {
            const isMono = (frameBuffer[i + 3] >> 6) === 3;
            const xingOffset =
              i +
              4 +
              (versionBits === 3 ? (isMono ? 17 : 32) : isMono ? 9 : 17);
            if (xingOffset + 12 <= frameBuffer.length) {
              const tag = frameBuffer.toString(
                'ascii',
                xingOffset,
                xingOffset + 4
              );
              if (tag === 'Xing' || tag === 'Info') {
                const flags = frameBuffer.readUInt32BE(xingOffset + 4);
                if ((flags & 0x0001) !== 0) {
                  const totalFrames = frameBuffer.readUInt32BE(xingOffset + 8);
                  const samplesPerFrame = versionBits === 3 ? 1152 : 576;
                  return Math.round(
                    (totalFrames * samplesPerFrame) / sampleRate
                  );
                }
              }
            }

            const audioSize = Math.max(0, fileSize - mp3Offset);
            const estimatedDuration = Math.round((audioSize * 8) / bitrate);
            if (estimatedDuration > 0) {
              return estimatedDuration;
            }
          }
        }
      }
    } catch {
      // Return undefined if error occurs
    } finally {
      if (fd !== null) {
        try {
          closeSync(fd);
        } catch {
          // ignore
        }
      }
    }
    return undefined;
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
          const fullPath = join(this.musicDir, file);
          const duration = this.getAudioDuration(fullPath);
          return {
            id: String(index + 1),
            filename: file,
            title: nameWithoutExt,
            url: `/music/${encodeURIComponent(file)}`,
            duration,
          };
        });
    } catch (err) {
      console.error('Error reading music directory:', err);
      return [];
    }
  }
}
