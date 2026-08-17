// components/SocketProvider.tsx
'use client';
import { useEffect } from 'react';
import { useSocketStore } from '../store/socketStore';
import { useRouter } from 'next/navigation';

interface SocketProviderProps {
  children: React.ReactNode;
}

export default function SocketProvider({ children }: SocketProviderProps) {
  const { connect, disconnect, socket } = useSocketStore();
  const router = useRouter();

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
      socket.on('game:created', (data: { code: string }) => {
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