// store/useSocketStore.ts
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { getSocketUrl, TypedSocket } from '@/lib/socket';


interface SocketState {
  //socket: TypedSocket | null;
  socket: Socket | null;
  isConnected: boolean;
  connect: () => TypedSocket;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: () => {
    // const socket: TypedSocket = io(getSocketUrl(), {
    //   autoConnect: false,
    //   reconnectionAttempts: 5,
    //   reconnectionDelay: 5000,
    // }) as TypedSocket;

        const socket = io(getSocketUrl(), {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 5000,
    });


    socket.on('connect', () => {
      set({ isConnected: true });
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
      console.log('Socket disconnected');
    });


    set({ socket });
    socket.connect();
    return socket;
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));