import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { GameModule } from './modules/game/game.module';
import { homedir } from 'node:os';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(homedir(), 'musica'),
      serveRoot: '/music',
    }),
    GameModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
