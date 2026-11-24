'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSocketStore } from '@/app/store/socketStore';
import { useEffect, useState } from 'react';
import { GameState, Player, useGameStore } from '@/app/store/gameStore';
import { ClientEvents, ServerEvents, GameMode, Team, DEFAULT_TEAMS, GameSyncPayload } from '@blindtest/shared';
import { clearSocketSession, loadSocketSession, saveSocketSession } from '@/lib/socket-session';
import Link from 'next/link';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const rawCodeGame = params.codeGame as string;
  const codeGame = rawCodeGame?.toUpperCase() || '';

  const { socket, isConnected, clientId, clearError } = useSocketStore();
  const {
    playerName,
    setPlayerName,
    state,
    setState,
    players,
    setPlayers,
    addPlayer,
    updatePlayer,
    setPlayerTeam,
    currentRound,
    setCurrentRound,
    totalRounds,
    setTotalRounds,
    gameMode,
    setGameMode,
    teams,
    setTeams,
    artistBonusEnabled,
    setArtistBonusEnabled,
    correctPlayers,
    correctTeams,
    bonusPlayers,
    bonusTeams,
    setCorrectPlayers,
    setCorrectTeams,
    setBonusPlayers,
    setBonusTeams,
    clearCorrectAnswers,
    code,
    setCode,
    updateScore,
  } = useGameStore();

  const [inputName, setInputName] = useState(playerName || '');
  const [hasJoined, setHasJoined] = useState(Boolean(playerName));
  const [joinError, setJoinError] = useState('');
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [artistAnswer, setArtistAnswer] = useState('');
  const [submittedBonusAnswer, setSubmittedBonusAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasAnsweredCorrectly, setHasAnsweredCorrectly] = useState(false);
  const [hasBonusAnswered, setHasBonusAnswered] = useState(false);
  // Copie figee des resultats : le podium reste identique meme si l'hote change
  // la configuration de la room avant de relancer une partie.
  const [finalResults, setFinalResults] = useState<{
    players: Player[];
    gameMode: GameMode;
    teams: Team[];
  } | null>(null);

  // Gérer la connexion directe si le pseudo n'est pas encore défini
  function handleJoinDirectly() {
    if (socket && isConnected && inputName.trim() && codeGame) {
      const formattedName = inputName.trim();
      setJoinError('');
      clearError();
      setCode(codeGame);
      saveSocketSession({
        gameCode: codeGame,
        role: 'player',
        playerName: formattedName,
      });
      socket.emit(
        ClientEvents.JOIN_GAME,
        {
          gameCode: codeGame,
          playerName: formattedName,
        },
        (response) => {
          if (!response?.ok) {
            clearSocketSession();
            setJoinError(response?.error?.message || 'Impossible de rejoindre ce salon');
            return;
          }
          setPlayerName(formattedName);
          setHasJoined(true);
        },
      );
    }
  }

  useEffect(() => {
    const session = loadSocketSession();
    if (session?.role === 'player' && session.playerName && session.gameCode === codeGame) {
      setPlayerName(session.playerName);
      setInputName(session.playerName);
      setHasJoined(true);
      return;
    }
    if (playerName) {
      setHasJoined(true);
      setInputName(playerName);
    }
  }, [playerName, codeGame, setPlayerName]);

  // Choisir une équipe
  function handleSelectTeam(teamId: string | null) {
    if (socket && isConnected) {
      socket.emit(ClientEvents.SELECT_TEAM, {
        gameCode: codeGame || code || '',
        teamId,
      });
      if (clientId) {
        setPlayerTeam(clientId, teamId);
      }
    }
  }

  // Soumission de réponse lors du jeu
  function handleSendAnswer(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!socket || !isConnected || !answer.trim()) return;

    socket.emit(ClientEvents.ANSWER, {
      gameCode: code || codeGame,
      answer: answer.trim(),
    });

    setSubmittedAnswer(answer.trim());
    setAnswer('');
  }

  // Soumission de réponse bonus artiste
  function handleSendBonusAnswer(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!socket || !isConnected || !artistAnswer.trim()) return;

    socket.emit(ClientEvents.ANSWER, {
      gameCode: code || codeGame,
      answer: artistAnswer.trim(),
    });

    setSubmittedBonusAnswer(artistAnswer.trim());
    setArtistAnswer('');
  }

  // Timer pendant la manche
  useEffect(() => {
    if (state !== GameState.PLAYING || timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [state, timeLeft]);

  // Écouteurs Socket.IO
  useEffect(() => {
    if (!socket || !isConnected) return;

    function onPlayerJoined(player: Player) {
      addPlayer(player);
    }

    function onPlayerUpdated(player: Player) {
      updatePlayer(player.id, player);
    }

    function onPlayersUpdated(data: { players: Player[] }) {
      if (data?.players) {
        setPlayers(data.players);
      }
    }

    function onGameStarted(data: {
      code: string;
      totalRounds: number;
      players?: Player[];
      gameMode?: GameMode;
      teams?: Team[];
      artistBonusEnabled?: boolean;
    }) {
      setState(GameState.COUNTDOWN);
      setFinalResults(null);
      setHasAnsweredCorrectly(false);
      setHasBonusAnswered(false);
      clearCorrectAnswers();
      setSubmittedAnswer(null);
      setSubmittedBonusAnswer(null);
      setAnswer('');
      setArtistAnswer('');
      if (data?.code) {
        setCode(data.code);
      }
      if (data?.totalRounds) {
        setTotalRounds(data.totalRounds);
      }
      if (data?.gameMode) {
        setGameMode(data.gameMode);
      }
      if (data?.teams) {
        setTeams(data.teams);
      }
      if (typeof data?.artistBonusEnabled === 'boolean') {
        setArtistBonusEnabled(data.artistBonusEnabled);
      }
      if (data?.players) {
        setPlayers(data.players);
      } else {
        setPlayers(useGameStore.getState().players.map((p) => ({ ...p, score: 0 })));
      }
    }

    function onRoundStarted(data: {
      currentRound: number;
      totalRounds: number;
      duration: number;
      gameMode?: GameMode;
      teams?: Team[];
      artistBonusEnabled?: boolean;
      correctPlayers?: string[];
      correctTeams?: string[];
      bonusPlayers?: string[];
      bonusTeams?: string[];
    }) {
      setState(GameState.PLAYING);
      setCurrentRound(data.currentRound);
      setTotalRounds(data.totalRounds);
      if (data?.gameMode) setGameMode(data.gameMode);
      if (data?.teams) setTeams(data.teams);
      if (typeof data?.artistBonusEnabled === 'boolean') {
        setArtistBonusEnabled(data.artistBonusEnabled);
      }
      setTimeLeft(data.duration || 30);
      setSubmittedAnswer(null);
      setSubmittedBonusAnswer(null);
      setAnswer('');
      setArtistAnswer('');
      setHasAnsweredCorrectly(false);
      setHasBonusAnswered(false);
      setCorrectPlayers(data?.correctPlayers || []);
      setCorrectTeams(data?.correctTeams || []);
      setBonusPlayers(data?.bonusPlayers || []);
      setBonusTeams(data?.bonusTeams || []);
    }

    function onRoundEnded(data: {
      currentRound: number;
      players: Player[];
      gameMode?: GameMode;
      teams?: Team[];
      artistBonusEnabled?: boolean;
    }) {
      setState(GameState.RESULTS);
      setHasAnsweredCorrectly(false);
      setHasBonusAnswered(false);
      clearCorrectAnswers();
      if (data?.players) {
        setPlayers(data.players);
      }
      if (data?.gameMode) {
        setGameMode(data.gameMode);
      }
      if (data?.teams) {
        setTeams(data.teams);
      }
      if (typeof data?.artistBonusEnabled === 'boolean') {
        setArtistBonusEnabled(data.artistBonusEnabled);
      }
    }

    function onRoundCountdown() {
      setState(GameState.COUNTDOWN);
      setHasAnsweredCorrectly(false);
      setHasBonusAnswered(false);
      clearCorrectAnswers();
      setSubmittedAnswer(null);
      setSubmittedBonusAnswer(null);
      setAnswer('');
      setArtistAnswer('');
    }

    function onScoreUpdated(data: {
      playerId?: string;
      newScore?: number;
      players?: Player[];
      teamScores?: Team[];
      correctPlayers?: string[];
      correctTeams?: string[];
      bonusPlayers?: string[];
      bonusTeams?: string[];
    }) {
      if (data?.players) {
        setPlayers(data.players);
      }
      if (data?.teamScores) {
        setTeams(data.teamScores);
      }
      if (data?.correctPlayers) {
        setCorrectPlayers(data.correctPlayers);
      }
      if (data?.correctTeams) {
        setCorrectTeams(data.correctTeams);
      }
      if (data?.bonusPlayers) {
        setBonusPlayers(data.bonusPlayers);
      }
      if (data?.bonusTeams) {
        setBonusTeams(data.bonusTeams);
      }
    }

    function onGameFinished(data: {
      players: Player[];
      gameMode?: GameMode;
      teams?: Team[];
    }) {
      const current = useGameStore.getState();
      setFinalResults({
        players: data?.players ?? current.players,
        gameMode: data?.gameMode ?? current.gameMode,
        teams: data?.teams ?? current.teams,
      });
      setState(GameState.FINISHED);
      setHasAnsweredCorrectly(false);
      setHasBonusAnswered(false);
      clearCorrectAnswers();
      if (data?.players) {
        setPlayers(data.players);
      }
      if (data?.gameMode) {
        setGameMode(data.gameMode);
      }
      if (data?.teams) {
        setTeams(data.teams);
      }
    }

    function onGoodAnswer(data: {
      newScore: number;
      teamScores?: Team[];
      correctPlayers?: string[];
      correctTeams?: string[];
      bonusPlayers?: string[];
      bonusTeams?: string[];
      artistBonusEnabled?: boolean;
    }) {
      console.log(data.newScore);
      setHasAnsweredCorrectly(true);
      if (clientId) {
        updateScore(clientId, data.newScore);
      }
      if (data?.teamScores) {
        setTeams(data.teamScores);
      }
      if (data?.correctPlayers) {
        setCorrectPlayers(data.correctPlayers);
      }
      if (data?.correctTeams) {
        setCorrectTeams(data.correctTeams);
      }
      if (data?.bonusPlayers) {
        setBonusPlayers(data.bonusPlayers);
      }
      if (data?.bonusTeams) {
        setBonusTeams(data.bonusTeams);
      }
      if (typeof data?.artistBonusEnabled === 'boolean') {
        setArtistBonusEnabled(data.artistBonusEnabled);
      }
    }

    function onBonusGoodAnswer(data: {
      newScore: number;
      bonusPoints?: number;
      teamScores?: Team[];
      correctPlayers?: string[];
      correctTeams?: string[];
      bonusPlayers?: string[];
      bonusTeams?: string[];
      artistBonusEnabled?: boolean;
    }) {
      console.log('Bonus answer valid:', data);
      setHasBonusAnswered(true);
      if (clientId) {
        updateScore(clientId, data.newScore);
      }
      if (data?.teamScores) {
        setTeams(data.teamScores);
      }
      if (data?.correctPlayers) {
        setCorrectPlayers(data.correctPlayers);
      }
      if (data?.correctTeams) {
        setCorrectTeams(data.correctTeams);
      }
      if (data?.bonusPlayers) {
        setBonusPlayers(data.bonusPlayers);
      }
      if (data?.bonusTeams) {
        setBonusTeams(data.bonusTeams);
      }
      if (typeof data?.artistBonusEnabled === 'boolean') {
        setArtistBonusEnabled(data.artistBonusEnabled);
      }
    }

    function onRoomSettingsUpdated(data: {
      totalRounds?: number;
      gameMode?: GameMode;
      teams?: Team[];
      artistBonusEnabled?: boolean;
    }) {
      if (data?.totalRounds) {
        setTotalRounds(data.totalRounds);
      }
      if (data?.gameMode) {
        setGameMode(data.gameMode);
      }
      if (data?.teams) {
        setTeams(data.teams);
      }
      if (typeof data?.artistBonusEnabled === 'boolean') {
        setArtistBonusEnabled(data.artistBonusEnabled);
      }
    }

    function onSync(data: GameSyncPayload) {
      setFinalResults(
        data.state === 'FINISHED'
          ? { players: data.players, gameMode: data.gameMode, teams: data.teams }
          : null,
      );
      if (data.playerName) {
        setHasJoined(true);
      }
      if (data.state === 'PLAYING') {
        setTimeLeft(data.secondsLeft ?? 30);
        setHasAnsweredCorrectly(Boolean(clientId) && data.correctPlayers.includes(clientId));
        setHasBonusAnswered(Boolean(clientId) && data.bonusPlayers.includes(clientId));
        return;
      }
      setTimeLeft(null);
      setHasAnsweredCorrectly(false);
      setHasBonusAnswered(false);
    }

    socket.on(ServerEvents.PLAYER_JOINED, onPlayerJoined);
    socket.on(ServerEvents.PLAYER_UPDATED, onPlayerUpdated);
    socket.on(ServerEvents.PLAYERS_UPDATED, onPlayersUpdated);
    socket.on(ServerEvents.GAME_STARTED, onGameStarted);
    socket.on(ServerEvents.ROUND_STARTED, onRoundStarted);
    socket.on(ServerEvents.ROUND_COUNTDOWN, onRoundCountdown);
    socket.on(ServerEvents.ROUND_ENDED, onRoundEnded);
    socket.on(ServerEvents.SCORE_UPDATED, onScoreUpdated);
    socket.on(ServerEvents.VALID_ANSWER, onGoodAnswer);
    socket.on(ServerEvents.BONUS_VALID_ANSWER, onBonusGoodAnswer);
    socket.on(ServerEvents.GAME_FINISHED, onGameFinished);
    socket.on(ServerEvents.ROOM_SETTINGS_UPDATED, onRoomSettingsUpdated);
    socket.on(ServerEvents.GAME_SYNC, onSync);

    return () => {
      socket.off(ServerEvents.PLAYER_JOINED, onPlayerJoined);
      socket.off(ServerEvents.PLAYER_UPDATED, onPlayerUpdated);
      socket.off(ServerEvents.PLAYERS_UPDATED, onPlayersUpdated);
      socket.off(ServerEvents.GAME_STARTED, onGameStarted);
      socket.off(ServerEvents.ROUND_STARTED, onRoundStarted);
      socket.off(ServerEvents.ROUND_COUNTDOWN, onRoundCountdown);
      socket.off(ServerEvents.ROUND_ENDED, onRoundEnded);
      socket.off(ServerEvents.SCORE_UPDATED, onScoreUpdated);
      socket.off(ServerEvents.VALID_ANSWER, onGoodAnswer);
      socket.off(ServerEvents.BONUS_VALID_ANSWER, onBonusGoodAnswer);
      socket.off(ServerEvents.GAME_FINISHED, onGameFinished);
      socket.off(ServerEvents.ROOM_SETTINGS_UPDATED, onRoomSettingsUpdated);
      socket.off(ServerEvents.GAME_SYNC, onSync);
    };
  }, [
    isConnected,
    socket,
    setState,
    setCurrentRound,
    setTotalRounds,
    setGameMode,
    setTeams,
    setArtistBonusEnabled,
    setPlayers,
    addPlayer,
    updatePlayer,
    updateScore,
    setCode,
    setCorrectPlayers,
    setCorrectTeams,
    setBonusPlayers,
    setBonusTeams,
    clearCorrectAnswers,
    clientId,
  ]);

  // Trouver le joueur courant
  const currentPlayer = players.find(
    (p) => p.id === clientId || (playerName && p.name === playerName)
  );

  const currentTeam = teams.find((t) => t.id === currentPlayer?.teamId);

  const isMyTeamAnswered =
    gameMode === GameMode.TEAM &&
    Boolean(currentPlayer?.teamId) &&
    correctTeams.includes(currentPlayer?.teamId as string);

  const isTeammateAnswered = isMyTeamAnswered && !hasAnsweredCorrectly;

  const isMainFound = hasAnsweredCorrectly || isMyTeamAnswered;

  const hasPlayerBonusAnswered =
    hasBonusAnswered ||
    (Boolean(clientId) && bonusPlayers.includes(clientId)) ||
    (Boolean(currentPlayer?.id) && bonusPlayers.includes(currentPlayer!.id));

  const isMyTeamBonusAnswered =
    gameMode === GameMode.TEAM &&
    Boolean(currentPlayer?.teamId) &&
    bonusTeams.includes(currentPlayer?.teamId as string);

  const isBonusFound =
    gameMode === GameMode.TEAM
      ? isMyTeamBonusAnswered || hasPlayerBonusAnswered
      : hasPlayerBonusAnswered;

  // Selecteur d'equipe (mode equipe) : disponible dans le lobby et apres une partie
  const teamSelector =
    gameMode === GameMode.TEAM ? (
      <div className="w-full bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 flex flex-col gap-3 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
            Choisissez votre équipe :
          </span>
          {currentTeam && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: currentTeam.color }}
            >
              {currentTeam.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {teams.map((team) => {
            const isMyTeam = currentPlayer?.teamId === team.id;
            const members = players.filter((p) => p.teamId === team.id);
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => handleSelectTeam(team.id)}
                className={`flex flex-col p-3 rounded-lg border transition-all text-left cursor-pointer ${
                  isMyTeam
                    ? 'bg-white dark:bg-zinc-900 shadow-md ring-2 ring-offset-1 ring-indigo-500 border-transparent font-bold'
                    : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800'
                }`}
                style={{ borderLeftColor: team.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm text-zinc-900 dark:text-white font-semibold flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    {team.name}
                  </span>
                  {isMyTeam && (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                      ✓ Rejoint
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400 mt-1">
                  {members.length} joueur{members.length > 1 ? 's' : ''}
                </span>
              </button>
            );
          })}
        </div>

        {!currentPlayer?.teamId && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
            💡 Si vous ne choisissez pas d&apos;équipe, vous serez assigné automatiquement.
          </p>
        )}
      </div>
    ) : null;

  // Resultats figes de la derniere partie (voir finalResults)
  const results = finalResults ?? { players, gameMode, teams };
  const finalPlayer = results.players.find(
    (p) => p.id === clientId || (playerName && p.name === playerName),
  );
  const finalTeam = results.teams.find((t) => t.id === finalPlayer?.teamId);

  // Écran de saisie du pseudo si non renseigné
  if (!hasJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black font-sans p-4">
        <main className="flex flex-col w-full max-w-md gap-6 p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white text-center">
            Rejoindre la partie
          </h1>
          <div className="text-center">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Salon :</span>
            <p className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {codeGame}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="inputName"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Votre pseudo
            </label>
            <input
              id="inputName"
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinDirectly()}
              placeholder="Ex: Alex"
              className="px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
            />
          </div>
          {joinError && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{joinError}</p>
          )}
          <button
            onClick={handleJoinDirectly}
            disabled={!inputName.trim() || !isConnected}
            className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Rejoindre
          </button>
          <Link
            href="/"
            onClick={() => clearSocketSession()}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors text-center"
          >
            Retour à l&apos;accueil
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black font-sans p-4">
      <main className="flex flex-col w-full max-w-md gap-6 p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800">
        {/* Header joueur & partie */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Joueur</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900 dark:text-white text-base">
                {playerName || inputName}
              </span>
              {gameMode === GameMode.TEAM && currentTeam && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: currentTeam.color }}
                >
                  {currentTeam.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Salon</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-base">
              {codeGame}
            </span>
          </div>
        </div>

        {/* Phase LOBBY */}
        {state === GameState.LOBBY && (
          <div className="flex flex-col items-center text-center gap-6 py-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold animate-pulse">
              🎮
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
                Vous êtes dans le salon
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                En attente que l&apos;hôte lance la partie...
              </p>
            </div>

            {teamSelector}

            <div className="w-full bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <span className="uppercase tracking-wider">Configuration</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                  {gameMode === GameMode.TEAM ? `Mode Équipe (${teams.length} éq.)` : 'Mode Solo'} • {totalRounds || 5} manches
                </span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block text-left">
                Joueurs prêts ({players.length})
              </span>
              <div className="flex flex-wrap gap-2 justify-center">
                {players.map((p) => {
                  const pTeam = teams.find((t) => t.id === p.teamId);
                  return (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                    >
                      {gameMode === GameMode.TEAM && pTeam && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: pTeam.color }}
                        />
                      )}
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Phase COUNTDOWN */}
        {state === GameState.COUNTDOWN && (
          <div className="flex flex-col items-center text-center gap-6 py-10">
            <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center text-3xl font-black animate-bounce shadow-lg shadow-indigo-500/30">
              ⚡
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                Préparez-vous !
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                La manche va bientôt commencer...
              </p>
            </div>
          </div>
        )}

        {/* Phase PLAYING */}
        {state === GameState.PLAYING && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                Manche {currentRound} {totalRounds > 0 ? `/ ${totalRounds}` : ''}
              </span>
              {timeLeft !== null && (
                <div
                  className={`px-3 py-1 rounded-full text-sm font-mono font-bold ${
                    timeLeft <= 3
                      ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 animate-pulse'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                  }`}
                >
                  ⏱️ {timeLeft}s
                </div>
              )}
            </div>

            {isMainFound ? (
              artistBonusEnabled ? (
                isBonusFound ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 text-3xl font-bold">
                      🎉
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
                        Morceau & Artiste trouvés !
                      </h3>
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-semibold flex items-center justify-center gap-1">
                        <span>⭐</span> Bonus Artiste validé (+50 pts)
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                        En attente de la fin de la manche...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 text-xl font-bold shrink-0">
                        ✓
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-green-800 dark:text-green-300">
                          {hasAnsweredCorrectly
                            ? 'Bonne réponse ! Morceau trouvé !'
                            : 'Votre équipe a trouvé le morceau !'}
                        </h3>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {gameMode === GameMode.TEAM
                            ? 'Points de manche remportés pour l’équipe.'
                            : 'Points de manche remportés.'}
                        </p>
                      </div>
                    </div>

                    {/* Formulaire Bonus Artiste */}
                    <div className="flex flex-col gap-3 p-5 bg-amber-50/80 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800 rounded-xl shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">⭐</span>
                        <div>
                          <h4 className="text-base font-bold text-amber-900 dark:text-amber-200">
                            Bonus Artiste (+50 pts)
                          </h4>
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Donnez le nom de l&apos;artiste ou de l&apos;interprète pour gagner des points bonus !
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleSendBonusAnswer} className="flex flex-col gap-3 mt-1">
                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor="bonusArtistInput"
                            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider"
                          >
                            Nom de l&apos;artiste :
                          </label>
                          <input
                            id="bonusArtistInput"
                            type="text"
                            value={artistAnswer}
                            onChange={(e) => setArtistAnswer(e.target.value)}
                            placeholder="Écrivez le nom de l'artiste..."
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            className="px-4 py-3 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white text-base"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={!artistAnswer.trim()}
                          className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold px-5 py-3 text-base shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          ⭐ Valider l&apos;artiste (+50 pts)
                        </button>
                      </form>

                      {submittedBonusAnswer && (
                        <div className="p-2.5 bg-amber-100/80 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800 rounded-lg text-center">
                          <span className="text-xs text-amber-800 dark:text-amber-300 block font-medium">
                            Dernière tentative d&apos;artiste :
                          </span>
                          <span className="text-zinc-900 dark:text-white font-semibold text-sm">
                            &quot;{submittedBonusAnswer}&quot;
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : hasAnsweredCorrectly ? (
                <div className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 text-2xl font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
                      Bonne réponse !
                    </h3>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      {gameMode === GameMode.TEAM
                        ? 'Vous avez marqué des points pour votre équipe !'
                        : 'En attente de la fin de la manche...'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                      En attente de la fin de la manche...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold">
                    👥
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200">
                      Votre équipe a trouvé la réponse !
                    </h3>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                      Un coéquipier a validé la bonne réponse (1 seule bonne réponse par équipe).
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                      En attente de la fin de la manche...
                    </p>
                  </div>
                </div>
              )
            ) : (
              <>
                <form onSubmit={handleSendAnswer} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="answerInput"
                      className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      {artistBonusEnabled ? 'Titre du morceau' : 'Votre réponse (Titre / Artiste)'}
                    </label>
                    <input
                      id="answerInput"
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={
                        artistBonusEnabled
                          ? 'Écrivez le titre du morceau...'
                          : 'Écrivez votre réponse ici...'
                      }
                      autoFocus
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white text-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!answer.trim()}
                    className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-lg"
                  >
                    Valider le titre
                  </button>
                </form>

                {submittedAnswer && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 rounded-lg text-center">
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 block font-medium">
                      Dernière réponse envoyée :
                    </span>
                    <span className="text-zinc-900 dark:text-white font-semibold">
                      &quot;{submittedAnswer}&quot;
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Phase RESULTS */}
        {state === GameState.RESULTS && (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Fin de la manche {currentRound}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Score personnel : {currentPlayer?.score ?? 0} pts
                {gameMode === GameMode.TEAM && currentTeam && (
                  <span className="ml-2 font-bold text-indigo-600 dark:text-indigo-400">
                    • {currentTeam.name} : {currentTeam.score || 0} pts
                  </span>
                )}
              </p>
            </div>

            {/* Classement par équipes si Mode Équipe */}
            {gameMode === GameMode.TEAM && (
              <div className="w-full flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 text-left">
                  Classement des équipes
                </h3>
                <ul className="flex flex-col gap-2 w-full">
                  {[...teams]
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((team, idx) => {
                      const isMyTeam = currentPlayer?.teamId === team.id;
                      return (
                        <li
                          key={team.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isMyTeam
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 font-bold'
                              : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60'
                          }`}
                          style={{ borderLeftColor: team.color, borderLeftWidth: '4px' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-sm text-zinc-500 w-4">
                              {idx + 1}.
                            </span>
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="font-medium text-zinc-900 dark:text-white">
                              {team.name} {isMyTeam && '(Votre équipe)'}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {team.score || 0} pts
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            {/* Classement individuel */}
            <div className="w-full flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 text-left">
                {gameMode === GameMode.TEAM ? 'Scores individuels' : 'Classement'}
              </h3>
              <ul className="flex flex-col gap-2 w-full">
                {[...players]
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((p, idx) => {
                    const isMe =
                      p.id === clientId || (playerName && p.name === playerName);
                    const pTeam = teams.find((t) => t.id === p.teamId);
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isMe
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-bold text-sm text-zinc-500 w-4 shrink-0">
                            {idx + 1}.
                          </span>
                          {gameMode === GameMode.TEAM && pTeam && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: pTeam.color }}
                              title={pTeam.name}
                            />
                          )}
                          <span
                            className={`font-medium truncate ${
                              isMe
                                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {p.name} {isMe && '(Vous)'}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-zinc-900 dark:text-white shrink-0">
                          {p.score || 0} pts
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        )}

        {/* Phase FINISHED */}
        {state === GameState.FINISHED && (
          <div className="flex flex-col items-center gap-6 py-4 text-center">
            <div className="text-4xl">🏆</div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Partie terminée !
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Votre score final : {finalPlayer?.score ?? 0} pts
                {results.gameMode === GameMode.TEAM && finalTeam && (
                  <span className="ml-2 font-bold text-indigo-600 dark:text-indigo-400">
                    • {finalTeam.name} : {finalTeam.score || 0} pts
                  </span>
                )}
              </p>
            </div>

            {/* Podium Équipes si Mode Équipe */}
            {results.gameMode === GameMode.TEAM && (
              <div className="w-full flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 text-left">
                  Podium des équipes
                </h3>
                <ul className="flex flex-col gap-2 w-full">
                  {[...results.teams]
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((team, idx) => {
                      const isMyTeam = currentPlayer?.teamId === team.id;
                      return (
                        <li
                          key={team.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border ${
                            idx === 0
                              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                              : isMyTeam
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                              : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60'
                          }`}
                          style={{ borderLeftColor: team.color, borderLeftWidth: '5px' }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                            </span>
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {team.name} {isMyTeam && '(Votre équipe)'}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {team.score || 0} pts
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            <div className="w-full flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 text-left">
                {results.gameMode === GameMode.TEAM ? 'Classement individuel' : 'Classement final'}
              </h3>
              <ul className="flex flex-col gap-2 w-full">
                {[...results.players]
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((p, idx) => {
                    const isMe =
                      p.id === clientId || (playerName && p.name === playerName);
                    const pTeam = results.teams.find((t) => t.id === p.teamId);
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          idx === 0 && results.gameMode === GameMode.SOLO
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                            : isMe
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-bold text-sm text-zinc-500 w-4 shrink-0">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                          </span>
                          {results.gameMode === GameMode.TEAM && pTeam && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: pTeam.color }}
                              title={pTeam.name}
                            />
                          )}
                          <span
                            className={`font-medium truncate ${
                              isMe
                                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {p.name} {isMe && '(Vous)'}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-zinc-900 dark:text-white shrink-0">
                          {p.score || 0} pts
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>

            {/* Configuration de la prochaine partie */}
            <div className="w-full bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-between gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <span className="uppercase tracking-wider">Prochaine partie</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold text-right">
                {gameMode === GameMode.TEAM ? `Mode Équipe (${teams.length} éq.)` : 'Mode Solo'} • {totalRounds || 5} manches
                {artistBonusEnabled ? ' • Bonus artiste' : ''}
              </span>
            </div>

            {teamSelector}

            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              En attente que l&apos;hôte relance une nouvelle partie...
            </p>

            <button
              onClick={() => {
                clearSocketSession();
                router.push('/');
              }}
              className="w-full mt-2 rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Retour à l&apos;accueil
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
