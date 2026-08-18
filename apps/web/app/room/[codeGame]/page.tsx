'use client';

import {useParams} from 'next/navigation';
import {useSocketStore} from "@/app/store/socketStore";
import {useEffect, useState} from "react";
import {GameState, useGameStore} from "@/app/store/gameStore";
import {ClientEvents, ServerEvents} from "@blindtest/shared";

export default function RoomPage() {
  const params = useParams();
  const codeGame = params.codeGame as string;

  const { socket, isConnected } = useSocketStore();
  const [players, setPlayers] = useState<{ id: string, name: string }[]>([]);
  const { masterId, state, setState } = useGameStore();

  function isMaster(): boolean {
    const id = socket?.id;

    return id !== undefined && masterId !== undefined && masterId === id;
  }

  function handleStartGame() {
    if (socket && isConnected) {
      socket.emit(ClientEvents.START_GAME, { gameCode: codeGame });
    }
  }


  useEffect(() => {
    if (!socket || !isConnected) return;

    function addPlayer(player: { id: string, name: string }) {
      setPlayers((prev) => [...prev, player]);
    }

    function handleRoundStart() {
      setState(GameState.PLAYING);
    }

    function handleRoundEnd() {
      setState(GameState.COUNTDOWN);
    }

    socket.on(ServerEvents.PLAYER_JOINED, addPlayer);
    socket.on(ServerEvents.ROUND_STARTED, handleRoundStart);
    socket.on(ServerEvents.ROUND_ENDED, handleRoundEnd);

    return () => {
      socket.off(ServerEvents.PLAYER_JOINED, addPlayer);
      socket.off(ServerEvents.ROUND_STARTED, handleRoundStart);
      socket.off(ServerEvents.ROUND_ENDED, handleRoundEnd);
    };
  }, [isConnected, socket, setState]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black font-sans">
      <main className="flex flex-col items-center gap-8 p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Salon de jeu
        </h1>
        <div className="flex flex-col items-center gap-2">
          <p className="text-zinc-500 dark:text-zinc-400">Code de la partie :</p>
          <span className="text-4xl font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400">
            {codeGame}
          </span>
        </div>
        <div className="mt-4 w-full">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Joueurs connectés ({players.length})
          </h2>
          {players.length > 0 ? (
            <ul className="flex flex-col gap-2 w-full">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-zinc-700 dark:text-zinc-200 font-medium">
                    {player.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400 italic">
              En attente de joueurs...
            </p>
          )}
        </div>
        <div>
          {state}
        </div>
        <div className="w-full flex justify-center mt-2">
          {isMaster() ? (
            <button
              onClick={handleStartGame}
              className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
            >
              Lancer la partie
            </button>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 italic text-center">
              En attente de l&apos;hôte pour lancer la partie...
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
