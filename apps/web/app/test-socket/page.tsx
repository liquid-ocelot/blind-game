'use client';

import { useEffect, useState } from "react";
import { useSocketStore } from "../store/socketStore";



export default function TestSocketPage() {
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const { socket, isConnected } = useSocketStore();

  useEffect(() => {


    function onPong(data: { message: string }) {
      setMessage(data.message);
    }

    if (socket && isConnected) {
      socket.on('pong', onPong);
    }


    return () => {
      if (socket && isConnected) {
        socket.off('pong', onPong);
      }

    };
  }, [isConnected]);

  function sendPing() {
    if (socket && isConnected) {
      socket.emit('ping', { message: "coucougnou" });
    }

  }

  return (
    <main>
      <h1>Socket.IO test</h1>

      <p>
        Status : {isConnected ? '🟢 connecté' : '🔴 déconnecté'}
      </p>

      <button onClick={sendPing}>
        Envoyer Ping
      </button>

      <p>{message}</p>
    </main>
  );
}