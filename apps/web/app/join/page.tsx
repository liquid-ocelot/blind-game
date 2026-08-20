'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocketStore } from '../store/socketStore';
import { useGameStore } from '../store/gameStore';
import { ClientEvents } from '@blindtest/shared';

export default function JoinPage() {
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const router = useRouter();
  const { socket, isConnected } = useSocketStore();
  const { setPlayerName: setStorePlayerName, setCode } = useGameStore();

  function handleJoin() {
    if (socket && isConnected && playerName.trim() && gameCode.trim()) {
      const formattedCode = gameCode.trim().toUpperCase();
      const formattedName = playerName.trim();

      setStorePlayerName(formattedName);
      setCode(formattedCode);
      socket.emit(ClientEvents.JOIN_GAME, { gameCode: formattedCode, playerName: formattedName });
      router.push(`/play/${formattedCode}`);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black font-sans">
      <main className="flex flex-col w-full max-w-md gap-8 p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white text-center">
          Rejoindre un salon
        </h1>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="playerName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nom du joueur
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
              placeholder="Ton pseudo"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="gameCode" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Code du salon
            </label>
            <input
              id="gameCode"
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value)}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white uppercase font-mono"
              placeholder="Ex: ABCD"
            />
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={!playerName || !gameCode || !isConnected}
          className="w-full rounded-full bg-blue-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Rejoindre
        </button>

        <button
          onClick={() => router.push('/')}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Retour à l'accueil
        </button>
      </main>
    </div>
  );
}
