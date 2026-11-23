import { create } from 'zustand';
import { io } from 'socket.io-client';
import { ClientEvents, GameErrorPayload, ServerEvents } from '@blindtest/shared';
import { getSocketUrl, TypedSocket } from '@/lib/socket';
import {
  clearSocketSession,
  getOrCreateClientId,
  loadSocketSession,
} from '@/lib/socket-session';
import { useGameStore } from './gameStore';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

interface SocketState {
  socket: TypedSocket | null;
  status: ConnectionStatus;
  isConnected: boolean;
  clientId: string;
  lastError: GameErrorPayload | null;
  connect: () => TypedSocket;
  disconnect: () => void;
  clearError: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  status: 'idle',
  isConnected: false,
  clientId: '',
  lastError: null,

  connect: () => {
    const clientId = getOrCreateClientId();
    set({ clientId });

    let { socket } = get();
    if (socket?.connected) {
      return socket;
    }

    if (!socket) {
      socket = io(getSocketUrl(), {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 10000,
        auth: { clientId },
      }) as TypedSocket;

      socket.on('connect', () => {
        set({ isConnected: true, status: 'connected', lastError: null });
        const session = loadSocketSession();
        if (session) {
          socket?.emit(ClientEvents.RESUME_GAME, session);
        }
      });

      socket.on('disconnect', (reason) => {
        set({
          isConnected: false,
          status: reason === 'io client disconnect' ? 'disconnected' : 'reconnecting',
        });
      });

      socket.io.on('reconnect_attempt', () => {
        set({ status: 'reconnecting', isConnected: false });
      });

      socket.on('connect_error', (error) => {
        set({
          isConnected: false,
          status: 'reconnecting',
          lastError: {
            code: 'CONNECTION',
            message: error.message || 'Connexion impossible',
          },
        });
      });

      socket.on(ServerEvents.ERROR, (error) => {
        // Une session sauvegardee qui ne correspond plus a aucun salon est
        // simplement abandonnee, sans afficher d'erreur a l'utilisateur.
        if (
          error.event === ClientEvents.RESUME_GAME &&
          (error.code === 'GAME_NOT_FOUND' || error.code === 'NOT_HOST')
        ) {
          clearSocketSession();
          return;
        }
        set({ lastError: error });
      });

      socket.on(ServerEvents.GAME_SYNC, (data) => {
        const session = loadSocketSession();
        if (!session || session.gameCode !== data.code) {
          return;
        }
        useGameStore.getState().applySync(data);
        set({ lastError: null });
      });

      set({ socket, status: 'connecting' });
    }

    if (!socket.connected) {
      set({ status: 'connecting' });
      socket.connect();
    }

    return socket;
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false, status: 'disconnected' });
    }
  },

  clearError: () => set({ lastError: null }),
}));
