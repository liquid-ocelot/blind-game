// components/SocketProvider.tsx
'use client';
import { useEffect } from 'react';
import { useSocketStore } from '../store/socketStore';

interface SocketProviderProps {
  children: React.ReactNode;
}

export default function SocketProvider({ children }: SocketProviderProps) {
  const { connect, disconnect } = useSocketStore();

  useEffect(() => {
    const socket = connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return <>{children}</>;
}