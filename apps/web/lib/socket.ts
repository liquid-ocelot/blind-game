import { io } from "socket.io-client";

function getSocketUrl(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== "undefined") {
        return `http://${window.location.hostname}:3001`;
    }
    return "http://localhost:3001";
}

export const socket = io(getSocketUrl(), {
    autoConnect: false,
});