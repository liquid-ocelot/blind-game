'use client';

import { socket } from "@/lib/socket";
import { useEffect, useState } from "react";



export default function TestSocketPage() {
    const [connected, setConnected] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        function onConnect() {
            setConnected(true);
        }

        function onDisconnect() {
            setConnected(false);
        }

        function onPong(data: {message: string}) {
            setMessage(data.message);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('pong', onPong);

        socket.connect();

        return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('pong', onPong);

        socket.disconnect();
        };
    }, []);

    function sendPing() {
        socket.emit('ping', {message: "coucougnou"});
    }

    return (
    <main>
      <h1>Socket.IO test</h1>

      <p>
        Status : {connected ? '🟢 connecté' : '🔴 déconnecté'}
      </p>

      <button onClick={sendPing}>
        Envoyer Ping
      </button>

      <p>{message}</p>
    </main>
  );
}