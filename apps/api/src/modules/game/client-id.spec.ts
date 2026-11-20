import { resolveClientId } from './client-id';
import { Socket } from 'socket.io';

describe('resolveClientId', () => {
  it('uses a stable auth client id when it is valid', () => {
    const client = {
      id: 'socket-1',
      handshake: { auth: { clientId: 'abc12345xyz' } },
    } as unknown as Socket;

    expect(resolveClientId(client)).toBe('abc12345xyz');
  });

  it('falls back to the socket id when auth is missing or invalid', () => {
    const missing = { id: 'socket-1' } as unknown as Socket;
    const invalid = {
      id: 'socket-2',
      handshake: { auth: { clientId: 'no' } },
    } as unknown as Socket;

    expect(resolveClientId(missing)).toBe('socket-1');
    expect(resolveClientId(invalid)).toBe('socket-2');
  });
});
