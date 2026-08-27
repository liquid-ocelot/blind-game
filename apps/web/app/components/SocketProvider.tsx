// components/SocketProvider.tsx
'use client';
import { useEffect } from 'react';
import { useSocketStore } from '../store/socketStore';
import { useRouter } from 'next/navigation';
import {useGameStore} from "@/app/store/gameStore";

interface SocketProviderProps {
  children: React.ReactNode;
}

export default function SocketProvider({ children }: SocketProviderProps) {
  const { connect, disconnect, socket } = useSocketStore();
  const router = useRouter();
  const { setMasterId, setCode, setTotalRounds } = useGameStore();

  useEffect(() => {
    connect();
    // On ne déconnecte pas ici pour éviter de fermer la connexion
    // lors des transitions de page où le Provider pourrait être remonté.
    // return () => {
    //   disconnect();
    // };
  }, [connect]);

  useEffect(() => {
    if (socket) {
      socket.on('game:created', (data: { code: string; totalRounds?: number }) => {
        setCode(data.code);
        if (data.totalRounds) {
          setTotalRounds(data.totalRounds);
        }
        setMasterId(socket.id);

        router.push(`/room/${data.code}`);
      });
    }

    return () => {
      if (socket) {
        socket.off('game:created');
      }
    };
  }, [socket, router]);

  return <>{children}</>;
}
