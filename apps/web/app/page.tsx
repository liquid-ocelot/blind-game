'use client';


import { ClientEvents } from "@blindtest/shared";
import { useSocketStore } from "./store/socketStore";
import Link from "next/link";


export default function Home() {
  const { socket, isConnected } = useSocketStore();

  function createGame() {
    if (socket && isConnected) {
      socket.emit(ClientEvents.CREATE_GAME);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <button
            onClick={createGame}
            className="rounded-full bg-blue-600 px-6 py-3 text-white font-semibold shadow-md hover:bg-blue-700 transition-colors"
          >
            Créer salon
          </button>
          <Link
            href="/join"
            className="rounded-full border border-zinc-300 dark:border-zinc-700 px-6 py-3 text-zinc-900 dark:text-white font-semibold shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Rejoindre un salon
          </Link>
        </div>

      </main>
    </div>
  );
}
