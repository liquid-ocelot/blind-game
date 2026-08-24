import { io, Socket } from "socket.io-client";


export interface ServerToClientEvents {
  connect: () => void;
  disconnect: () => void;
  pong: (data: {message: string}) => void;
}

export interface ClientToServerEvents {
  joinGame: (code: string) => void;
  ping: (data: {message: string}) => void;
  createGame: () => void;
}




export function getSocketUrl(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== "undefined") {
        return `http://${window.location.hostname}:3001`;
    }
    return "http://localhost:3001";
}

export const getApiUrl = getSocketUrl;

export const socket = io(getSocketUrl(), {
    autoConnect: false,
    reconnectionAttempts: 5,
    reconnectionDelay: 5000,
});

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
