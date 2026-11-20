export interface GameSocketSession {
  gameCode: string;
  role: 'host' | 'player';
  playerName?: string;
}

const CLIENT_ID_KEY = 'blindtest.clientId';
const SESSION_KEY = 'blindtest.socketSession';
const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export function getOrCreateClientId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const existing = sessionStorage.getItem(CLIENT_ID_KEY);
  if (existing && CLIENT_ID_PATTERN.test(existing)) {
    return existing;
  }

  const id = crypto.randomUUID().replace(/-/g, '');
  sessionStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

export function loadSocketSession(): GameSocketSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as GameSocketSession;
    if (!parsed?.gameCode || (parsed.role !== 'host' && parsed.role !== 'player')) {
      return null;
    }
    return {
      gameCode: parsed.gameCode.toUpperCase(),
      role: parsed.role,
      playerName: parsed.playerName,
    };
  } catch {
    return null;
  }
}

export function saveSocketSession(session: GameSocketSession) {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...session,
      gameCode: session.gameCode.toUpperCase(),
    }),
  );
}

export function clearSocketSession() {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(SESSION_KEY);
}
