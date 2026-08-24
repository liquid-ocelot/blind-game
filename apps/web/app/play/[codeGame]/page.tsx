'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSocketStore } from '@/app/store/socketStore';
import { useEffect, useState } from 'react';
import { GameState, Player, useGameStore } from '@/app/store/gameStore';
import { ClientEvents, ServerEvents } from '@blindtest/shared';
import Link from 'next/link';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const rawCodeGame = params.codeGame as string;
  const codeGame = rawCodeGame?.toUpperCase() || '';

  const { socket, isConnected } = useSocketStore();
  const {
    playerName,
    setPlayerName,
    state,
    setState,
    players,
    setPlayers,
    addPlayer,
    currentRound,
    setCurrentRound,
    totalRounds,
    setTotalRounds,
    code,
    setCode,
    updateScore,
  } = useGameStore();

  const [inputName, setInputName] = useState(playerName || '');
  const [hasJoined, setHasJoined] = useState(Boolean(playerName));
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasAnsweredCorrectly, setHasAnsweredCorrectly] = useState(false);

  // Gérer la connexion directe si le pseudo n'est pas encore défini
  function handleJoinDirectly() {
    if (socket && isConnected && inputName.trim() && codeGame) {
      const formattedName = inputName.trim();
      setPlayerName(formattedName);
      setHasJoined(true);
      setCode(codeGame);
      socket.emit(ClientEvents.JOIN_GAME, {
        gameCode: codeGame,
        playerName: formattedName,
      });
    }
  }

  // Soumission de réponse lors du jeu
  function handleSendAnswer(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!socket || !isConnected || !answer.trim()) return;

    socket.emit(ClientEvents.ANSWER, {
      gameCode:code,
      answer: answer.trim(),
    });

    setSubmittedAnswer(answer.trim());
    setAnswer('');
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

    function onPlayerJoined(player: { id: string; name: string; score?: number }) {
      addPlayer(player);
    }

    function onGameStarted(data: { code: string; totalRounds: number }) {
      setState(GameState.COUNTDOWN);
      if (data?.code) {
        setCode(data.code);
      }
      if (data?.totalRounds) {
        setTotalRounds(data.totalRounds);
      }
    }

    function onRoundStarted(data: {
      currentRound: number;
      totalRounds: number;
      duration: number;
    }) {
      setState(GameState.PLAYING);
      setCurrentRound(data.currentRound);
      setTotalRounds(data.totalRounds);
      setTimeLeft(data.duration || 10);
      setSubmittedAnswer(null);
      setAnswer('');
      setHasAnsweredCorrectly(false);
    }

    function onRoundEnded(data: {
      currentRound: number;
      players: Player[];
    }) {
      setState(GameState.RESULTS);
      setHasAnsweredCorrectly(false);
      if (data?.players) {
        setPlayers(data.players);
      }
    }

    function onGameFinished(data: { players: Player[] }) {
      setState(GameState.FINISHED);
      setHasAnsweredCorrectly(false);
      if (data?.players) {
        setPlayers(data.players);
      }
    }

    function onGoodAnswer(data: {newScore : number}) {
      console.log(data.newScore);
      setHasAnsweredCorrectly(true);
      if (socket?.id) {
        updateScore(socket.id, data.newScore);
      }
    }

    socket.on(ServerEvents.PLAYER_JOINED, onPlayerJoined);
    socket.on(ServerEvents.GAME_STARTED, onGameStarted);
    socket.on(ServerEvents.ROUND_STARTED, onRoundStarted);
    socket.on(ServerEvents.ROUND_ENDED, onRoundEnded);
    socket.on(ServerEvents.VALID_ANSWER, onGoodAnswer);
    socket.on('game:finished', onGameFinished);

    return () => {
      socket.off(ServerEvents.PLAYER_JOINED, onPlayerJoined);
      socket.off(ServerEvents.GAME_STARTED, onGameStarted);
      socket.off(ServerEvents.ROUND_STARTED, onRoundStarted);
      socket.off(ServerEvents.ROUND_ENDED, onRoundEnded);
      socket.off(ServerEvents.VALID_ANSWER, onGoodAnswer);
      socket.off('game:finished', onGameFinished);
    };
  }, [
    isConnected,
    socket,
    setState,
    setCurrentRound,
    setTotalRounds,
    setPlayers,
    addPlayer,
    updateScore,
  ]);

  // Trouver le joueur courant pour afficher son score
  const currentPlayer = players.find(
    (p) => p.id === socket?.id || (playerName && p.name === playerName)
  );

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
          <button
            onClick={handleJoinDirectly}
            disabled={!inputName.trim() || !isConnected}
            className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Rejoindre
          </button>
          <Link
            href="/"
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
            <span className="font-semibold text-zinc-900 dark:text-white text-base">
              {playerName || inputName}
            </span>
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
          <div className="flex flex-col items-center text-center gap-6 py-6">
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold animate-pulse">
              🎮
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                Vous êtes dans le salon
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                En attente que l&apos;hôte lance la partie...
              </p>
            </div>

            <div className="w-full bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 block">
                Joueurs prêts ({players.length})
              </span>
              <div className="flex flex-wrap gap-2 justify-center">
                {players.map((p) => (
                  <span
                    key={p.id}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                  >
                    {p.name}
                  </span>
                ))}
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

            {hasAnsweredCorrectly ? (
              <div className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 text-2xl font-bold">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
                    Bonne réponse !
                  </h3>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    En attente de la fin de la manche...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={handleSendAnswer} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="answerInput"
                      className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Votre réponse (Titre / Artiste)
                    </label>
                    <input
                      id="answerInput"
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Écrivez votre réponse ici..."
                      autoFocus
                      className="px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white text-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!answer.trim()}
                    className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-lg"
                  >
                    Valider
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
                Score actuel : {currentPlayer?.score ?? 0} pts
              </p>
            </div>

            <div className="w-full flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Classement
              </h3>
              <ul className="flex flex-col gap-2 w-full">
                {[...players]
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((p, idx) => {
                    const isMe =
                      p.id === socket?.id || (playerName && p.name === playerName);
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isMe
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm text-zinc-500 w-4">
                            {idx + 1}.
                          </span>
                          <span
                            className={`font-medium ${
                              isMe
                                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {p.name} {isMe && '(Vous)'}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-zinc-900 dark:text-white">
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
                Votre score final : {currentPlayer?.score ?? 0} pts
              </p>
            </div>

            <div className="w-full flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 text-left">
                Classement final
              </h3>
              <ul className="flex flex-col gap-2 w-full">
                {[...players]
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((p, idx) => {
                    const isMe =
                      p.id === socket?.id || (playerName && p.name === playerName);
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          idx === 0
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                            : isMe
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm text-zinc-500 w-4">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                          </span>
                          <span
                            className={`font-medium ${
                              isMe
                                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {p.name} {isMe && '(Vous)'}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                          {p.score || 0} pts
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>

            <button
              onClick={() => router.push('/')}
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
