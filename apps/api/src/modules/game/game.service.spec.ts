import { GameService } from './game.service';
import { GameSessionManager } from './game-session.manager';
import { MusicService } from './music.service';
import { GameState } from './game-state';
import { ServerEvents, GameMode, DEFAULT_TEAMS } from '@blindtest/shared';
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
      game.players = [{ id: 'client-1', name: 'Alice', isHost: false, score: 0 }];

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
      game.players = [{ id: 'client-1', name: 'Alice', isHost: false, score: 0 }];

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
      game.players = [{ id: 'client-1', name: 'Alice', isHost: false, score: 0 }];

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

  describe('Team Mode configuration and behavior', () => {
    it('should allow master to enable team mode and configure teams', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      expect(game.gameMode).toBe(GameMode.SOLO);

      const customTeams = [
        { id: 'team-red', name: 'Les Faucons', color: '#EF4444' },
        { id: 'team-blue', name: 'Les Aigles', color: '#3B82F6' },
        { id: 'team-green', name: 'Les Loups', color: '#10B981' },
      ];

      const updated = service.updateRoomSettings(
        code,
        {
          gameMode: GameMode.TEAM,
          teams: customTeams,
        },
        'master-1',
      );

      expect(updated).not.toBeNull();
      expect(game.gameMode).toBe(GameMode.TEAM);
      expect(game.teams.length).toBe(3);
      expect(game.teams[0].name).toBe('Les Faucons');
    });

    it('should allow players to select team in lobby', () => {
      const code = sessionManager.createGame('master-1');
      sessionManager.addPlayer(code, { id: 'p1', name: 'Alex', score: 0 });
      sessionManager.addPlayer(code, { id: 'p2', name: 'Bob', score: 0 });

      service.updateRoomSettings(code, { gameMode: GameMode.TEAM }, 'master-1');

      const updatedP1 = service.selectTeam(code, 'p1', 'team-red');
      expect(updatedP1).not.toBeNull();
      expect(updatedP1?.teamId).toBe('team-red');

      const updatedP2 = service.selectTeam(code, 'p2', 'team-blue');
      expect(updatedP2).not.toBeNull();
      expect(updatedP2?.teamId).toBe('team-blue');
    });

    it('should auto-assign unassigned players when game starts in team mode', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      game.gameMode = GameMode.TEAM;
      game.teams = DEFAULT_TEAMS.slice(0, 2);

      sessionManager.addPlayer(code, { id: 'p1', name: 'Alice', score: 0 });
      sessionManager.addPlayer(code, { id: 'p2', name: 'Bob', score: 0 });
      sessionManager.addPlayer(code, { id: 'p3', name: 'Charlie', score: 0, teamId: 'team-red' });

      game.autoAssignTeams();

      const p1 = game.players.find((p) => p.id === 'p1');
      const p2 = game.players.find((p) => p.id === 'p2');
      const p3 = game.players.find((p) => p.id === 'p3');

      expect(p3?.teamId).toBe('team-red');
      // P1 & P2 should be balanced
      expect(p1?.teamId).toBeDefined();
      expect(p2?.teamId).toBeDefined();
      expect(['team-red', 'team-blue']).toContain(p1?.teamId);
      expect(['team-red', 'team-blue']).toContain(p2?.teamId);
    });

    it('should aggregate team scores correctly when players score points', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      game.state = GameState.PLAYING;
      game.currentRound = 1;
      game.gameMode = GameMode.TEAM;
      game.tracks = [
        {
          id: '1',
          name: 'track.mp3',
          title: 'Star Wars',
          url: 'http://test/track.mp3',
        },
      ];
      game.players = [
        { id: 'p1', name: 'Alice', teamId: 'team-red', score: 50 },
        { id: 'p2', name: 'Bob', teamId: 'team-red', score: 30 },
        { id: 'p3', name: 'Charlie', teamId: 'team-blue', score: 40 },
      ];

      const teamScores = game.getTeamScores();
      const redTeam = teamScores.find((t) => t.id === 'team-red');
      const blueTeam = teamScores.find((t) => t.id === 'team-blue');

      expect(redTeam?.score).toBe(80);
      expect(blueTeam?.score).toBe(40);
    });

    it('should only allow ONE correct answer per team per round in team mode', () => {
      const code = sessionManager.createGame('master-1');
      const game = sessionManager.getGame(code)!;
      game.state = GameState.PLAYING;
      game.currentRound = 1;
      game.gameMode = GameMode.TEAM;
      game.teams = DEFAULT_TEAMS.slice(0, 2);
      game.tracks = [
        {
          id: '1',
          name: 'track.mp3',
          title: 'Star Wars',
          url: 'http://test/track.mp3',
        },
      ];
      game.players = [
        { id: 'p1', name: 'Alice', teamId: 'team-red', score: 0 },
        { id: 'p2', name: 'Bob', teamId: 'team-red', score: 0 },
        { id: 'p3', name: 'Charlie', teamId: 'team-blue', score: 0 },
      ];

      const client1 = { id: 'p1', emit: jest.fn() } as unknown as Socket;
      const client2 = { id: 'p2', emit: jest.fn() } as unknown as Socket;
      const client3 = { id: 'p3', emit: jest.fn() } as unknown as Socket;

      // 1. Premier joueur de l'équipe rouge répond correctement
      service.verifyAnswer(code, 'Star Wars', client1);
      expect(client1.emit).toHaveBeenCalledWith(
        ServerEvents.VALID_ANSWER,
        expect.objectContaining({
          newScore: expect.any(Number),
          teamId: 'team-red',
        }),
      );
      expect(game.hasPlayerAnsweredCorrectly('p1')).toBe(true);
      expect(game.hasTeamAnsweredCorrectly('team-red')).toBe(true);
      expect(game.canPlayerAnswer('p1')).toBe(false);
      expect(game.canPlayerAnswer('p2')).toBe(false); // Coéquipier bloqué

      // 2. Deuxième joueur de l'équipe rouge tente de répondre
      service.verifyAnswer(code, 'Star Wars', client2);
      expect(client2.emit).not.toHaveBeenCalled();
      const p2 = game.players.find((p) => p.id === 'p2');
      expect(p2?.score).toBe(0);
      expect(game.hasPlayerAnsweredCorrectly('p2')).toBe(false);

      // 3. Joueur de l'équipe bleue peut répondre
      expect(game.canPlayerAnswer('p3')).toBe(true);
      service.verifyAnswer(code, 'Star Wars', client3);
      expect(client3.emit).toHaveBeenCalledWith(
        ServerEvents.VALID_ANSWER,
        expect.objectContaining({
          newScore: expect.any(Number),
          teamId: 'team-blue',
        }),
      );
      expect(game.hasTeamAnsweredCorrectly('team-blue')).toBe(true);

      // 4. Toutes les équipes actives ont répondu -> haveAllPlayersAnswered est vrai
      expect(game.haveAllPlayersAnswered()).toBe(true);
    });
  });
});
