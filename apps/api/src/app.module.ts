import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { GameModule } from './modules/game/game.module';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';

const getMusicRootPath = () => {
  const homedirMusica = join(homedir(), 'musica');
  const localMusic = join(process.cwd(), 'music');
  const apiMusic = join(process.cwd(), 'apps', 'api', 'music');

  if (existsSync(homedirMusica)) return homedirMusica;
  if (existsSync(localMusic)) return localMusic;
  if (existsSync(apiMusic)) return apiMusic;
  return homedirMusica;
};

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: getMusicRootPath(),
      serveRoot: '/music',
    }),
    GameModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
