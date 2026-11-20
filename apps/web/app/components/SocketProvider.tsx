'use client';
import { useEffect, useState } from 'react';
import { useSocketStore } from '../store/socketStore';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/app/store/gameStore';
import { GameCreatedPayload, ServerEvents } from '@blindtest/shared';
import { saveSocketSession } from '@/lib/socket-session';

interface SocketProviderProps {
  children: React.ReactNode;
}

export default function SocketProvider({ children }: SocketProviderProps) {
  const { connect, socket, clientId, status, lastError, clearError } = useSocketStore();
  const router = useRouter();
  const { setMasterId, setCode, setTotalRounds, setGameMode, setTeams, setArtistBonusEnabled, resetGame } = useGameStore();

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!socket) return;

    const onCreated = (data: GameCreatedPayload) => {
      saveSocketSession({ gameCode: data.code, role: 'host' });
      clearError();
      resetGame();
      setCode(data.code);
      setTotalRounds(data.totalRounds);
      setGameMode(data.gameMode);
      setTeams(data.teams);
      setArtistBonusEnabled(data.artistBonusEnabled);
      setMasterId(clientId);
      router.push(`/room/${data.code}`);
    };

    socket.on(ServerEvents.GAME_CREATED, onCreated);

    return () => {
      socket.off(ServerEvents.GAME_CREATED, onCreated);
    };
  }, [socket, router, clientId, setCode, setTotalRounds, setGameMode, setTeams, setArtistBonusEnabled, setMasterId, resetGame, clearError]);

  return (
    <>
      <ConnectionStatus status={status} message={lastError?.message} onDismiss={clearError} onRetry={connect} />
      {children}
    </>
  );
}

function ConnectionStatus({
  status,
  message,
  onDismiss,
  onRetry,
}: {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  message?: string;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const [showConnecting, setShowConnecting] = useState(false);

  useEffect(() => {
    if (status !== 'connecting') {
      setShowConnecting(false);
      return;
    }
    const timer = setTimeout(() => setShowConnecting(true), 400);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === 'connecting' && !showConnecting) {
    return null;
  }

  if (status === 'reconnecting' || status === 'connecting') {
    return (
      <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black">
        {status === 'connecting' ? 'Connexion au serveur…' : 'Connexion interrompue, reconnexion…'}
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
        <span>{message || 'Serveur injoignable'}</span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (message) {
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-zinc-900 px-4 py-2 text-center text-sm text-white">
        <span>{message}</span>
        <button type="button" onClick={onDismiss} className="text-xs underline">
          Fermer
        </button>
      </div>
    );
  }

  return null;
}
