import { Socket } from 'socket.io';

const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export function resolveClientId(client: Socket): string {
  const auth = client.handshake?.auth as { clientId?: unknown } | undefined;
  const clientId = auth?.clientId;
  if (typeof clientId === 'string' && CLIENT_ID_PATTERN.test(clientId)) {
    return clientId;
  }
  return client.id;
}
