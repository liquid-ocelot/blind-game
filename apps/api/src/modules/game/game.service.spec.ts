import { GameService } from './game.service';
import { GameSessionManager } from './game-session.manager';
import { MusicService } from './music.service';
import { GameState } from './game-state';
import { ServerEvents } from '@blindtest/shared';
import { Socket } from 'socket.io';

describe('GameService', () => {
  let service: GameService;
  let sessionManager: GameSessionManager;
  let musicService: MusicService;

  beforeEach(() => {
    sessionManager = new GameSessionManager();
    musicService = new MusicService();
    service = new GameService(sessionManager, musicService);
  });

  describe('verifyAnswer with accents removal', () => {
    it('should validate answer when title has accents and player writes without accents', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      game.state = GameState.PLAYING;
      game.currentRound = 1;
      game.tracks = [
        {
          id: '1',
          name: 'hélène.mp3',
          title: 'Hélène',
          url: 'http://test/helene.mp3',
        },
      ];
      game.players = [{ id: 'client-1', name: 'Alice', isMaster: false, score: 0 }];

      const mockClient = {
        id: 'client-1',
        emit: jest.fn(),
      } as unknown as Socket;

      service.verifyAnswer(code, 'helene', mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith(
        ServerEvents.VALID_ANSWER,
        expect.objectContaining({
          newScore: expect.any(Number),
        }),
      );
      expect(game.hasPlayerAnsweredCorrectly('client-1')).toBe(true);
    });

    it('should validate answer when title has no accents and player writes with accents', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      game.state = GameState.PLAYING;
      game.currentRound = 1;
      game.tracks = [
        {
          id: '1',
          name: 'deja-vu.mp3',
          title: 'Deja vu',
          url: 'http://test/deja-vu.mp3',
        },
      ];
      game.players = [{ id: 'client-1', name: 'Alice', isMaster: false, score: 0 }];

      const mockClient = {
        id: 'client-1',
        emit: jest.fn(),
      } as unknown as Socket;

      service.verifyAnswer(code, 'Déjà vu', mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith(
        ServerEvents.VALID_ANSWER,
        expect.objectContaining({
          newScore: expect.any(Number),
        }),
      );
      expect(game.hasPlayerAnsweredCorrectly('client-1')).toBe(true);
    });

    it('should reject incorrect answers', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      game.state = GameState.PLAYING;
      game.currentRound = 1;
      game.tracks = [
        {
          id: '1',
          name: 'hélène.mp3',
          title: 'Hélène',
          url: 'http://test/helene.mp3',
        },
      ];
      game.players = [{ id: 'client-1', name: 'Alice', isMaster: false, score: 0 }];

      const mockClient = {
        id: 'client-1',
        emit: jest.fn(),
      } as unknown as Socket;

      service.verifyAnswer(code, 'bonjour', mockClient);

      expect(mockClient.emit).not.toHaveBeenCalled();
      expect(game.hasPlayerAnsweredCorrectly('client-1')).toBe(false);
    });
  });

  describe('updateRoomSettings and totalRounds configuration', () => {
    it('should allow master to change rounds between 5 and 20', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      expect(game.totalRounds).toBe(5);

      const updated = service.updateRoomSettings(code, { totalRounds: 12 }, 'master-1');
      expect(updated).not.toBeNull();
      expect(game.totalRounds).toBe(12);
    });

    it('should clamp rounds to minimum 5 and maximum 20', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;

      service.updateRoomSettings(code, { totalRounds: 2 }, 'master-1');
      expect(game.totalRounds).toBe(5);

      service.updateRoomSettings(code, { totalRounds: 25 }, 'master-1');
      expect(game.totalRounds).toBe(20);
    });

    it('should reject updates from non-master clients', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;

      const result = service.updateRoomSettings(code, { totalRounds: 10 }, 'other-client');
      expect(result).toBeNull();
      expect(game.totalRounds).toBe(5);
    });

    it('should reject updates if game is not in LOBBY state', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      game.state = GameState.PLAYING;

      const result = service.updateRoomSettings(code, { totalRounds: 10 }, 'master-1');
      expect(result).toBeNull();
      expect(game.totalRounds).toBe(5);
    });
  });
});
