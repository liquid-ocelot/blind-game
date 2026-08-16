'use client';


import { ClientEvents } from "@blindtest/shared";
import { useSocketStore } from "./store/socketStore";
import { useEffect } from "react";


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
          <button onClick={createGame}>
        Créer salon
      </button>
        </div>

      </main>
    </div>
  );
}
