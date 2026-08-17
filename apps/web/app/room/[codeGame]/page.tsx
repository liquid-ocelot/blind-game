'use client';

import { useParams } from 'next/navigation';
import {useSocketStore} from "@/app/store/socketStore";
import {useEffect, useState} from "react";

export default function RoomPage() {
  const params = useParams();
  const codeGame = params.codeGame;

  const { socket, isConnected } = useSocketStore();
  const [players, setPlayers] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    function addPlayer(player: { id: string, name: string }) {
      setPlayers((prev) => [...prev, player]);
    }

    if (socket && isConnected) {
      socket.on('game:player-joined', addPlayer);
    }


    return () => {
      if (socket && isConnected) {
        socket.off('game:player-joined', addPlayer);
      }

    };
  }, [isConnected, socket]);
  
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
      </main>
    </div>
  );
}
