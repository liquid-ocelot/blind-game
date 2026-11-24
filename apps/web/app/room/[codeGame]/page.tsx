'use client';

import { useParams } from 'next/navigation';
import { useSocketStore } from "@/app/store/socketStore";
import { useEffect, useRef, useState, useCallback } from "react";
import { GameState, Player, useGameStore } from "@/app/store/gameStore";
import { ClientEvents, ServerEvents, GameMode, Team, DEFAULT_TEAMS, GameSyncPayload } from "@blindtest/shared";
import { getApiUrl } from "@/lib/socket";
import JoinQrCode from "@/app/components/JoinQrCode";

export interface MusicTrack {
  id: string;
  filename: string;
  title: string;
  author?: string;
  artist?: string;
  url: string;
  duration?: number;
  startTimes?: number[];
}

export default function RoomPage() {
  const params = useParams();
  const rawCodeGame = params.codeGame as string;
  const codeGame = rawCodeGame?.toUpperCase() || '';

  const { socket, isConnected, clientId } = useSocketStore();
  const {
    masterId,
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
    setCode,
  } = useGameStore();

  // État des musiques et du téléchargement
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [downloadedBlobs, setDownloadedBlobs] = useState<Record<string, string>>({});
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; isDownloading: boolean }>({
    current: 0,
    total: 0,
    isDownloading: false,
  });
  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [showTitle, setShowTitle] = useState<boolean>(false);
  const [showMusicManager, setShowMusicManager] = useState<boolean>(true);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  // Copie figee des resultats de la partie : le podium reste identique meme si
  // l'hote change le mode ou les equipes avant de relancer.
  const [finalResults, setFinalResults] = useState<{
    players: Player[];
    gameMode: GameMode;
    teams: Team[];
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Vérification si le client courant est le maître de jeu
  function isMaster(): boolean {
    return Boolean(clientId && masterId && masterId === clientId);
  }

  // Initialisation de l'élément audio HTML5
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = isMuted ? 0 : volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setAudioCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setActivePreviewId(null);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  // Gestion du volume et mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Récupération de la liste des musiques depuis l'API
  const fetchMusicList = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/music/list`);
      if (res.ok) {
        const data: MusicTrack[] = await res.json();
        setTracks(data);
        return data;
      }
    } catch (err) {
      console.error('Erreur lors du chargement de la liste des musiques :', err);
    }
    return [];
  }, []);

  // Télécharger une musique en mémoire locale (Blob URL) pour préchargement
  const downloadTrack = useCallback(async (track: MusicTrack): Promise<string | null> => {
    try {
      const apiUrl = getApiUrl();
      const fileUrl = track.url.startsWith('http') ? track.url : `${apiUrl}${track.url}`;
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setDownloadedBlobs((prev) => ({
        ...prev,
        [track.id]: blobUrl,
      }));
      return blobUrl;
    } catch (error) {
      console.error(`Erreur lors du téléchargement de la musique ${track.filename}:`, error);
      return null;
    }
  }, []);

  // Télécharger toutes les musiques disponibles
  const downloadAllTracks = useCallback(async () => {
    if (tracks.length === 0) {
      const fetched = await fetchMusicList();
      if (fetched.length === 0) return;
    }

    setDownloadProgress({ current: 0, total: tracks.length, isDownloading: true });

    let completed = 0;
    for (const track of tracks) {
      await downloadTrack(track);
      completed++;
      setDownloadProgress({
        current: completed,
        total: tracks.length,
        isDownloading: completed < tracks.length,
      });
    }
  }, [tracks, downloadTrack, fetchMusicList]);

  // Téléchargement d'un fichier .mp3 directement sur l'ordinateur du maître
  const downloadFileToDisk = (track: MusicTrack) => {
    const apiUrl = getApiUrl();
    const sourceUrl = downloadedBlobs[track.id] || (track.url.startsWith('http') ? track.url : `${apiUrl}${track.url}`);
    const anchor = document.createElement('a');
    anchor.href = sourceUrl;
    anchor.download = track.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  // Jouer une musique donnée (utilise le Blob téléchargé si disponible ou l'URL directe)
  const playTrack = useCallback((track: MusicTrack, startTime: number = 0) => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const apiUrl = getApiUrl();
    const sourceUrl = downloadedBlobs[track.id] || (track.url.startsWith('http') ? track.url : `${apiUrl}${track.url}`);

    const applyStartTime = () => {
      if (startTime > 0) {
        try {
          audio.currentTime = startTime;
        } catch (err) {
          console.warn('Impossible de positionner le curseur audio :', err);
        }
      } else {
        audio.currentTime = 0;
      }
    };

    if (audio.src !== sourceUrl) {
      audio.src = sourceUrl;
      audio.addEventListener('loadedmetadata', () => {
        applyStartTime();
      }, { once: true });
    } else {
      applyStartTime();
    }

    setActiveTrack(track);
    audio.play().catch((err) => {
      console.warn('Autoplay bloqué ou erreur de lecture audio :', err);
    });
  }, [downloadedBlobs]);

  // Arrêter la lecture
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setActivePreviewId(null);
  }, []);

  // Basculer Lecture / Pause
  const togglePlayPause = () => {
    if (!audioRef.current || !audioRef.current.src) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.warn('Erreur lecture :', err));
    }
  };

  // Pré-écoute d'un morceau dans le salon
  const handlePreviewTrack = (track: MusicTrack) => {
    if (activePreviewId === track.id && isPlaying) {
      stopAudio();
    } else {
      setActivePreviewId(track.id);
      playTrack(track);
    }
  };

  // Lancement de la partie
  function handleStartGame() {
    if (socket && isConnected) {
      // Déverrouiller le contexte audio si nécessaire
      if (audioRef.current) {
        audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
      }
      socket.emit(ClientEvents.START_GAME, { gameCode: codeGame });
    }
  }

  // Modification du nombre de manches (réservé au maître de jeu)
  const handleTotalRoundsChange = (newTotal: number) => {
    const clamped = Math.max(5, Math.min(20, Math.round(newTotal)));
    setTotalRounds(clamped);
    if (socket && isConnected && isMasterUser) {
      socket.emit(ClientEvents.UPDATE_SETTINGS, {
        gameCode: codeGame,
        totalRounds: clamped,
        gameMode,
        teams,
        artistBonusEnabled,
      });
    }
  };

  // Modification du mode de jeu (réservé au maître de jeu)
  const handleGameModeChange = (newMode: GameMode) => {
    setGameMode(newMode);
    if (socket && isConnected && isMasterUser) {
      socket.emit(ClientEvents.UPDATE_SETTINGS, {
        gameCode: codeGame,
        totalRounds,
        gameMode: newMode,
        teams,
        artistBonusEnabled,
      });
    }
  };

  // Modification du nombre d'équipes (réservé au maître de jeu)
  const handleTeamCountChange = (count: number) => {
    const clampedCount = Math.max(2, Math.min(4, count));
    const newTeams = DEFAULT_TEAMS.slice(0, clampedCount);
    setTeams(newTeams);
    if (socket && isConnected && isMasterUser) {
      socket.emit(ClientEvents.UPDATE_SETTINGS, {
        gameCode: codeGame,
        totalRounds,
        gameMode,
        teams: newTeams,
        artistBonusEnabled,
      });
    }
  };

  // Modification du bonus artiste (réservé au maître de jeu)
  const handleArtistBonusChange = (enabled: boolean) => {
    setArtistBonusEnabled(enabled);
    if (socket && isConnected && isMasterUser) {
      socket.emit(ClientEvents.UPDATE_SETTINGS, {
        gameCode: codeGame,
        totalRounds,
        gameMode,
        teams,
        artistBonusEnabled: enabled,
      });
    }
  };

  // Sélection d'équipe pour un joueur
  const handleSelectTeam = (teamId: string | null) => {
    if (socket && isConnected) {
      socket.emit(ClientEvents.SELECT_TEAM, {
        gameCode: codeGame,
        teamId,
      });
    }
  };

  // Chargement initial de la liste des musiques
  useEffect(() => {
    fetchMusicList();
    if (codeGame) {
      setCode(codeGame);
    }
  }, [fetchMusicList, codeGame, setCode]);

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
      tracks?: MusicTrack[];
      players?: Player[];
      gameMode?: GameMode;
      teams?: Team[];
      artistBonusEnabled?: boolean;
    }) {
      setState(GameState.COUNTDOWN);
      setFinalResults(null);
      clearCorrectAnswers();
      if (data?.code) setCode(data.code);
      if (data?.totalRounds) setTotalRounds(data.totalRounds);
      if (data?.gameMode) setGameMode(data.gameMode);
      if (data?.teams) setTeams(data.teams);
      if (typeof data?.artistBonusEnabled === 'boolean') {
        setArtistBonusEnabled(data.artistBonusEnabled);
      }
      if (data?.tracks && data.tracks.length > 0) {
        setTracks(data.tracks);
      }
      if (data?.players) {
        setPlayers(data.players);
      } else {
        setPlayers(useGameStore.getState().players.map((p) => ({ ...p, score: 0 })));
      }
      stopAudio();
    }

    function onRoundStarted(data: {
      currentRound: number;
      totalRounds: number;
      duration: number;
      track?: MusicTrack;
      musicUrl?: string;
      startTime?: number;
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
      setCorrectPlayers(data?.correctPlayers || []);
      setCorrectTeams(data?.correctTeams || []);
      setBonusPlayers(data?.bonusPlayers || []);
      setBonusTeams(data?.bonusTeams || []);
      setTimeLeft(data.duration || 30);
      setShowTitle(false);

      // Si le client est le maître, lancer la musique du round
      const roundTrack = data.track || (data.musicUrl ? {
        id: String(data.currentRound),
        filename: data.musicUrl.split('/').pop() || 'Musique',
        title: `Piste ${data.currentRound}`,
        url: data.musicUrl,
      } : null);

      if (roundTrack) {
        setActiveTrack(roundTrack);
        const startTime = typeof data.startTime === 'number'
          ? data.startTime
          : Math.floor(Math.random() * 21) + 10;
        playTrack(roundTrack, startTime);
      }
    }

    function onRoundEnded(data: {
      currentRound: number;
      players: Player[];
      track?: MusicTrack;
      gameMode?: GameMode;
      teams?: Team[];
      artistBonusEnabled?: boolean;
      correctPlayers?: string[];
      correctTeams?: string[];
      bonusPlayers?: string[];
      bonusTeams?: string[];
    }) {
      setState(GameState.RESULTS);
      clearCorrectAnswers();
      if (data?.players) {
        setPlayers(data.players);
      }
      if (data?.track) {
        setActiveTrack(data.track);
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
      clearCorrectAnswers();
      stopAudio();
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
      clearCorrectAnswers();
      stopAudio();
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
      if (data.state === 'PLAYING') {
        setTimeLeft(data.secondsLeft ?? 30);
        setShowTitle(false);
        if (data.track?.url && typeof data.audioOffset === 'number') {
          playTrack(data.track as MusicTrack, data.audioOffset);
        }
        return;
      }
      if (data.state === 'RESULTS' && data.track) {
        setActiveTrack(data.track as MusicTrack);
        setShowTitle(true);
        return;
      }
      if (data.state === 'COUNTDOWN' || data.state === 'FINISHED') {
        stopAudio();
        setTimeLeft(null);
      }
    }

    socket.on(ServerEvents.PLAYER_JOINED, onPlayerJoined);
    socket.on(ServerEvents.PLAYER_UPDATED, onPlayerUpdated);
    socket.on(ServerEvents.PLAYERS_UPDATED, onPlayersUpdated);
    socket.on(ServerEvents.GAME_STARTED, onGameStarted);
    socket.on(ServerEvents.ROUND_STARTED, onRoundStarted);
    socket.on(ServerEvents.ROUND_COUNTDOWN, onRoundCountdown);
    socket.on(ServerEvents.ROUND_ENDED, onRoundEnded);
    socket.on(ServerEvents.SCORE_UPDATED, onScoreUpdated);
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
      socket.off(ServerEvents.GAME_FINISHED, onGameFinished);
      socket.off(ServerEvents.ROOM_SETTINGS_UPDATED, onRoomSettingsUpdated);
      socket.off(ServerEvents.GAME_SYNC, onSync);
    };
  }, [
    isConnected,
    socket,
    setState,
    setPlayers,
    addPlayer,
    updatePlayer,
    setCurrentRound,
    setTotalRounds,
    setGameMode,
    setTeams,
    setArtistBonusEnabled,
    setCode,
    playTrack,
    stopAudio,
    setCorrectPlayers,
    setCorrectTeams,
    setBonusPlayers,
    setBonusTeams,
    clearCorrectAnswers,
  ]);

  const downloadedCount = Object.keys(downloadedBlobs).length;
  const isMasterUser = isMaster();
  const results = finalResults ?? { players, gameMode, teams };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black font-sans p-4 sm:p-6">
      <main className="flex flex-col w-full max-w-4xl gap-6 p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
        
        {/* Header Salon */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-indigo-500/20">
              🎵
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Salon de jeu
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {isMasterUser ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                    👑 Hôte / Maître du jeu
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                    🎮 Joueur
                  </span>
                )}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  • Phase : <strong className="text-zinc-700 dark:text-zinc-300">{state}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end bg-zinc-50 dark:bg-zinc-800/60 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Code de la partie
            </span>
            <span className="text-3xl font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400">
              {codeGame}
            </span>
          </div>
        </div>

        {/* QR code pour rejoindre le salon */}
        {state === GameState.LOBBY && <JoinQrCode gameCode={codeGame} />}

        {/* Phase COUNTDOWN */}
        {state === GameState.COUNTDOWN && (
          <div className="flex flex-col items-center text-center gap-4 py-10 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <div className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-black animate-bounce shadow-lg shadow-indigo-500/30">
              ⚡
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Préparez-vous !
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                La manche va débuter dans quelques secondes...
              </p>
            </div>
          </div>
        )}

        {/* Phase PLAYING : Écran de jeu actif avec lecteur audio pour le maître */}
        {state === GameState.PLAYING && (
          <div className="flex flex-col gap-6 py-4">
            <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800/80 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  Manche {currentRound} {totalRounds > 0 ? `/ ${totalRounds}` : ''}
                </span>
                <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium animate-pulse">
                  En cours
                </span>
              </div>
              {timeLeft !== null && (
                <div
                  className={`px-4 py-1.5 rounded-full text-base font-mono font-bold ${
                    timeLeft <= 3
                      ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 animate-pulse'
                      : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  }`}
                >
                  ⏱️ {timeLeft}s
                </div>
              )}
            </div>

            {/* Lecteur Audio de manche (contrôlé par le Maître) */}
            <div className="flex flex-col gap-4 p-6 bg-gradient-to-br from-indigo-900/10 via-zinc-900/5 to-purple-900/10 dark:from-indigo-950/40 dark:to-zinc-900 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isPlaying ? 'bg-indigo-600 animate-pulse' : 'bg-zinc-400'}`}>
                    🎵
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white text-base">
                      {isMasterUser ? (
                        showTitle && activeTrack ? (
                          <>
                            {activeTrack.title}
                            {activeTrack.author && (
                              <span className="text-zinc-500 dark:text-zinc-400 font-normal ml-1">
                                - {activeTrack.author}
                              </span>
                            )}
                          </>
                        ) : (
                          'Musique en cours de lecture'
                        )
                      ) : (
                        'Écoutez attentivement !'
                      )}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {isPlaying ? 'Lecture audio en cours' : 'Audio en pause'}
                    </p>
                  </div>
                </div>

                {isMasterUser && activeTrack && (
                  <button
                    onClick={() => setShowTitle((prev) => !prev)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    {showTitle ? '🙈 Masquer le titre' : '👁️ Révéler le titre'}
                  </button>
                )}
              </div>

              {/* Barre de progression audio */}
              <div className="flex flex-col gap-1.5">
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-200 ease-linear"
                    style={{
                      width: audioDuration > 0 ? `${(audioCurrentTime / audioDuration) * 100}%` : '0%',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  <span>{Math.floor(audioCurrentTime)}s</span>
                  <span>{audioDuration > 0 ? `${Math.floor(audioDuration)}s` : '--'}</span>
                </div>
              </div>

              {/* Contrôles Maître */}
              {isMasterUser && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlayPause}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm shadow-sm cursor-pointer"
                    >
                      {isPlaying ? '⏸️ Pause' : '▶️ Reprendre'}
                    </button>
                    <button
                      onClick={() => setIsMuted((prev) => !prev)}
                      className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                      title={isMuted ? 'Activer le son' : 'Couper le son'}
                    >
                      {isMuted ? '🔇' : '🔊'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Volume</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVolume(val);
                        if (isMuted) setIsMuted(false);
                      }}
                      className="w-24 sm:w-32 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase RESULTS */}
        {state === GameState.RESULTS && (
          <div className="flex flex-col items-center gap-4 py-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="text-center">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Fin de la manche {currentRound}
              </h2>
              {activeTrack && (
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                  Morceau : &quot;{activeTrack.title}&quot;
                  {activeTrack.author && (
                    <span className="font-normal text-zinc-600 dark:text-zinc-300 ml-1">
                      - {activeTrack.author}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Classement par équipes si Mode Équipe */}
            {gameMode === GameMode.TEAM && (
              <div className="w-full max-w-md px-4 mt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center justify-between">
                  <span>🏆 Classement des équipes</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                    Mode Équipe
                  </span>
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {[...teams]
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((team, idx) => {
                      const teamMembers = players.filter((p) => p.teamId === team.id);
                      return (
                        <li
                          key={team.id}
                          className="flex flex-col p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm"
                          style={{ borderLeftColor: team.color, borderLeftWidth: '4px' }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-sm text-zinc-500 w-5">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                              </span>
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: team.color }}
                              />
                              <span className="font-bold text-zinc-900 dark:text-white">
                                {team.name}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-base">
                              {team.score || 0} pts
                            </span>
                          </div>
                          {teamMembers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                              {teamMembers.map((m) => (
                                <span
                                  key={m.id}
                                  className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                >
                                  {m.name} <span className="font-mono text-[10px] text-zinc-400">({m.score || 0}p)</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            {/* Classement individuel */}
            <div className="w-full max-w-md px-4 mt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                {gameMode === GameMode.TEAM ? 'Scores individuels' : 'Classement provisoire'}
              </h3>
              <ul className="flex flex-col gap-2">
                {[...players]
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((player, idx) => {
                    const playerTeam = teams.find((t) => t.id === player.teamId);
                    return (
                      <li
                        key={player.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-bold text-sm text-zinc-500 w-4 shrink-0">
                            {idx + 1}.
                          </span>
                          {gameMode === GameMode.TEAM && playerTeam && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: playerTeam.color }}
                              title={playerTeam.name}
                            />
                          )}
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                            {player.name}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {player.score || 0} pts
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
          <div className="flex flex-col items-center text-center gap-6 py-8 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="text-4xl">🏆</div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                Partie terminée !
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Bravo à tous les participants !
              </p>
            </div>

            {/* Podium Équipes si Mode Équipe */}
            {results.gameMode === GameMode.TEAM && (
              <div className="w-full max-w-md px-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 text-left flex items-center justify-between">
                  <span>🏆 Podium des équipes</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                    Mode Équipe
                  </span>
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {[...results.teams]
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((team, idx) => {
                      const teamMembers = results.players.filter((p) => p.teamId === team.id);
                      return (
                        <li
                          key={team.id}
                          className={`flex flex-col p-3.5 rounded-xl border text-left ${
                            idx === 0
                              ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-md'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
                          }`}
                          style={{ borderLeftColor: team.color, borderLeftWidth: '5px' }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                              </span>
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: team.color }}
                              />
                              <span className="font-bold text-zinc-900 dark:text-white text-base">
                                {team.name}
                              </span>
                            </div>
                            <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-lg">
                              {team.score || 0} pts
                            </span>
                          </div>
                          {teamMembers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500 dark:text-zinc-400">
                              {teamMembers.map((m) => (
                                <span
                                  key={m.id}
                                  className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                >
                                  {m.name} <span className="font-mono text-[10px] text-zinc-400">({m.score || 0} pts)</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            <div className="w-full max-w-md px-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 text-left">
                {results.gameMode === GameMode.TEAM ? 'Classement individuel' : 'Podium final'}
              </h3>
              <ul className="flex flex-col gap-2">
                {[...results.players]
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((player, idx) => {
                    const playerTeam = results.teams.find((t) => t.id === player.teamId);
                    return (
                      <li
                        key={player.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          idx === 0 && results.gameMode === GameMode.SOLO
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 font-bold'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-base shrink-0">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                          </span>
                          {results.gameMode === GameMode.TEAM && playerTeam && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: playerTeam.color }}
                              title={playerTeam.name}
                            />
                          )}
                          <span className="text-zinc-900 dark:text-white truncate">
                            {player.name}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {player.score || 0} pts
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>

            <div className="w-full max-w-md px-4 mt-2">
              {isMasterUser ? (
                <button
                  onClick={handleStartGame}
                  className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-white font-bold text-base shadow-lg hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer shadow-indigo-500/20"
                >
                  Rejouer avec la même configuration
                </button>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 italic text-center">
                  En attente de l&apos;hôte pour relancer une partie...
                </p>
              )}
              {isMasterUser && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                  Vous pouvez aussi modifier la configuration ci-dessous avant de relancer.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Section Configuration de la room (Nombre de manches & Mode de jeu) */}
        {(state === GameState.LOBBY || state === GameState.FINISHED) && (
          <div className="flex flex-col gap-5 p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>⚙️</span>{' '}
                  {state === GameState.FINISHED ? 'Configuration de la prochaine partie' : 'Configuration de la partie'}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isMasterUser
                    ? state === GameState.FINISHED
                      ? 'Ajustez le mode, les équipes et le nombre de manches avant de relancer une partie.'
                      : 'Configurez le mode de jeu, les équipes et le nombre de manches.'
                    : state === GameState.FINISHED
                      ? 'L’hôte prépare la prochaine partie.'
                      : 'Paramètres configurés par l’hôte pour cette partie.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-sm">
                  {gameMode === GameMode.TEAM ? '👥 Mode Équipes' : '👤 Mode Solo'}
                </span>
                {artistBonusEnabled && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-sm">
                    ⭐ Bonus Artiste
                  </span>
                )}
                <span className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400 px-3 py-1 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  {totalRounds || 5} manches
                </span>
              </div>
            </div>

            {/* Mode de jeu : Solo ou Équipes */}
            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/80">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                Mode de jeu :
              </span>
              {isMasterUser ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleGameModeChange(GameMode.SOLO)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      gameMode === GameMode.SOLO
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500 ring-offset-1'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>👤</span> Solo (Chacun pour soi)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGameModeChange(GameMode.TEAM)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      gameMode === GameMode.TEAM
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500 ring-offset-1'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>👥</span> Par Équipe
                  </button>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Mode sélectionné : <strong className="text-zinc-700 dark:text-zinc-200">{gameMode === GameMode.TEAM ? 'Par Équipe' : 'Solo'}</strong>
                </p>
              )}
            </div>

            {/* Option Bonus Artiste */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-700/80">
              <div>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block">
                  Bonus Artiste (+50 pts) :
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Permet de saisir le nom de l&apos;artiste après avoir trouvé le titre pour remporter des points bonus.
                </p>
              </div>
              {isMasterUser ? (
                <button
                  type="button"
                  onClick={() => handleArtistBonusChange(!artistBonusEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    artistBonusEnabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                  role="switch"
                  aria-checked={artistBonusEnabled}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      artistBonusEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              ) : (
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    artistBonusEnabled
                      ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {artistBonusEnabled ? '✓ Activé' : '✕ Désactivé'}
                </span>
              )}
            </div>

            {/* Paramètres spécifiques au Mode Équipe */}
            {gameMode === GameMode.TEAM && (
              <div className="flex flex-col gap-3 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                    Nombre d&apos;équipes :
                  </span>
                  {isMasterUser ? (
                    <div className="flex items-center gap-2">
                      {[2, 3, 4].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => handleTeamCountChange(count)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            teams.length === count
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {count} équipes
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {teams.length} équipes
                    </span>
                  )}
                </div>

                {/* Badges des équipes configurées */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {teams.map((team) => {
                    const memberCount = players.filter((p) => p.teamId === team.id).length;
                    return (
                      <div
                        key={team.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs shadow-xs"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <div className="truncate">
                          <p className="font-bold text-zinc-900 dark:text-white truncate">
                            {team.name}
                          </p>
                          <span className="text-[10px] text-zinc-400">
                            {memberCount} joueur{memberCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Réglage du nombre de manches */}
            {isMasterUser && (
              <div className="flex flex-col gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-700/80">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                  Nombre de manches :
                </span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleTotalRoundsChange((totalRounds || 5) - 1)}
                    disabled={(totalRounds || 5) <= 5}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 font-bold text-lg text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center cursor-pointer"
                    title="Diminuer le nombre de manches"
                  >
                    -
                  </button>

                  <input
                    type="range"
                    min="5"
                    max="20"
                    step="1"
                    value={totalRounds || 5}
                    onChange={(e) => handleTotalRoundsChange(parseInt(e.target.value, 10))}
                    className="flex-1 accent-indigo-600 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
                  />

                  <button
                    type="button"
                    onClick={() => handleTotalRoundsChange((totalRounds || 5) + 1)}
                    disabled={(totalRounds || 5) >= 20}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 font-bold text-lg text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center cursor-pointer"
                    title="Augmenter le nombre de manches"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400">Min : 5 manches</span>
                  <div className="flex gap-1 sm:gap-2">
                    {[5, 10, 15, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleTotalRoundsChange(preset)}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                          (totalRounds || 5) === preset
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-zinc-400">Max : 20 manches</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section Maître : Gestionnaire Audio & Téléchargement des Musiques (LOBBY & Général) */}
        {isMasterUser && (
          <div className="flex flex-col gap-4 p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>🎧</span> Gestionnaire de musiques (Maître)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Téléchargez et pré-écoutez les musiques du serveur pour préparer la partie.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowMusicManager((prev) => !prev)}
                  className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer text-xs flex items-center gap-1.5 font-medium"
                >
                  {showMusicManager ? '🙈 Masquer' : '👁️ Afficher'}
                </button>

                {showMusicManager && (
                  <>
                    <button
                      onClick={downloadAllTracks}
                      disabled={downloadProgress.isDownloading || tracks.length === 0}
                      className="w-full sm:w-auto rounded-lg bg-indigo-600 px-4 py-2 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                      {downloadProgress.isDownloading ? (
                        <>
                          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Téléchargement ({downloadProgress.current}/{downloadProgress.total})...
                        </>
                      ) : downloadedCount === tracks.length && tracks.length > 0 ? (
                        <>✓ Musiques prêtes ({downloadedCount})</>
                      ) : (
                        <>⬇️ Tout télécharger ({tracks.length})</>
                      )}
                    </button>

                    <button
                      onClick={() => fetchMusicList()}
                      title="Actualiser la liste des musiques"
                      className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer text-xs"
                    >
                      🔄
                    </button>
                  </>
                )}
              </div>
            </div>

            {showMusicManager && (
              <>
                {/* Barre de progression du téléchargement global */}
                {downloadProgress.isDownloading && (
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{
                        width: downloadProgress.total > 0 ? `${(downloadProgress.current / downloadProgress.total) * 100}%` : '0%',
                      }}
                    />
                  </div>
                )}

                {/* Liste des musiques disponibles avec options de pré-écoute et téléchargement */}
                {tracks.length > 0 ? (
                  <div className="flex flex-col gap-2 mt-2 max-h-60 overflow-y-auto pr-1">
                    {tracks.map((track) => {
                      const isDownloaded = Boolean(downloadedBlobs[track.id]);
                      const isPreviewing = activePreviewId === track.id && isPlaying;

                      return (
                        <div
                          key={track.id}
                          className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => handlePreviewTrack(track)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors shrink-0 ${
                                isPreviewing
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                              }`}
                              title={isPreviewing ? 'Mettre en pause' : 'Pré-écouter'}
                            >
                              {isPreviewing ? '⏸️' : '▶️'}
                            </button>
                            <div className="truncate">
                              <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                {track.title}
                                {track.author && (
                                  <span className="text-xs text-zinc-400 font-normal ml-1.5">
                                    ({track.author})
                                  </span>
                                )}
                              </p>
                              <span className="text-xs text-zinc-400 truncate block">
                                {track.filename}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isDownloaded ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                                ✓ En local
                              </span>
                            ) : (
                              <button
                                onClick={() => downloadTrack(track)}
                                className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              >
                                Précharger
                              </button>
                            )}

                            <button
                              onClick={() => downloadFileToDisk(track)}
                              title="Télécharger le fichier .mp3 sur votre appareil"
                              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                            >
                              ⬇️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-2">
                    Aucune musique trouvée dans le répertoire du serveur.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Section Joueurs connectés (Solo vs Équipes) */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>👥</span> Joueurs connectés ({players.length})
            </h2>
            {gameMode === GameMode.TEAM && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                Répartition par équipe
              </span>
            )}
          </div>

          {players.length > 0 ? (
            gameMode === GameMode.TEAM ? (
              <div className="flex flex-col gap-4 w-full">
                {/* Grille des équipes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                  {teams.map((team) => {
                    const teamMembers = players.filter((p) => p.teamId === team.id);
                    const hasTeamFound = correctTeams.includes(team.id);
                    return (
                      <div
                        key={team.id}
                        className={`flex flex-col p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border ${
                          hasTeamFound && state === GameState.PLAYING
                            ? 'border-green-400 dark:border-green-700 bg-green-50/30 dark:bg-green-950/20 shadow-md'
                            : 'border-zinc-200 dark:border-zinc-700 shadow-sm'
                        }`}
                        style={{ borderTopColor: team.color, borderTopWidth: '4px' }}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="font-bold text-zinc-900 dark:text-white text-sm">
                              {team.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {state === GameState.PLAYING && hasTeamFound && (
                              <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/60 px-2 py-0.5 rounded-full border border-green-300 dark:border-green-800 animate-pulse">
                                ✓ A trouvé !
                              </span>
                            )}
                            {state === GameState.PLAYING && bonusTeams.includes(team.id) && (
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                                ⭐ Bonus Artiste !
                              </span>
                            )}
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                              {teamMembers.length} joueur{teamMembers.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Liste des joueurs de l'équipe */}
                        <div className="flex flex-col gap-1.5 mt-3 min-h-[60px]">
                          {teamMembers.length > 0 ? (
                            teamMembers.map((member) => {
                              const hasMemberFound = correctPlayers.includes(member.id);
                              const hasMemberFoundBonus = bonusPlayers.includes(member.id);
                              return (
                                <div
                                  key={member.id}
                                  className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                                    hasMemberFound && state === GameState.PLAYING
                                      ? 'bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-800 font-semibold'
                                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
                                  }`}
                                >
                                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                    {member.name}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {state === GameState.PLAYING && hasMemberFound && (
                                      <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
                                        ✓ Réponse validée
                                      </span>
                                    )}
                                    {state === GameState.PLAYING && hasMemberFoundBonus && (
                                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                        ⭐ + Bonus
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-zinc-400 italic py-2 text-center">
                              Aucun joueur dans cette équipe
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Section des joueurs sans équipe */}
                {players.some((p) => !p.teamId) && (
                  <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <span>⚠️</span> Joueurs sans équipe ({players.filter((p) => !p.teamId).length})
                      </span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">
                        (Répartition automatique au lancement)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {players
                        .filter((p) => !p.teamId)
                        .map((p) => (
                          <span
                            key={p.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 text-zinc-800 dark:text-zinc-200 shadow-xs"
                          >
                            {p.name}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {players.map((player) => {
                  const hasPlayerFound = correctPlayers.includes(player.id);
                  const hasPlayerFoundBonus = bonusPlayers.includes(player.id);
                  return (
                    <li
                      key={player.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                        hasPlayerFound && state === GameState.PLAYING
                          ? 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800'
                          : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0">
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-zinc-700 dark:text-zinc-200 font-medium truncate">
                          {player.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasPlayerFound && state === GameState.PLAYING && (
                          <span className="text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/60 px-2 py-0.5 rounded-full border border-green-300 dark:border-green-800">
                            ✓ A trouvé !
                          </span>
                        )}
                        {hasPlayerFoundBonus && state === GameState.PLAYING && (
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                            ⭐ Bonus Artiste !
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <p className="text-sm text-zinc-400 italic">
              En attente de joueurs...
            </p>
          )}
        </div>

        {/* Bouton de démarrage (LOBBY) ou de relance avec la nouvelle configuration (FINISHED, hôte) */}
        {(state === GameState.LOBBY || (state === GameState.FINISHED && isMasterUser)) && (
          <div className="w-full flex justify-center mt-2">
            {isMasterUser ? (
              <button
                onClick={handleStartGame}
                className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-white font-bold text-base shadow-lg hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer shadow-indigo-500/20"
              >
                {state === GameState.FINISHED ? 'Relancer avec cette configuration' : 'Lancer la partie'}
              </button>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 italic text-center">
                En attente de l&apos;hôte pour lancer la partie...
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
