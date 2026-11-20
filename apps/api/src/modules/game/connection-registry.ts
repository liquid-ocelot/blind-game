import { Injectable } from '@nestjs/common';

export interface ConnectionMembership {
  clientId: string;
  gameCode: string;
  role: 'host' | 'player';
  playerName?: string;
}

@Injectable()
export class ConnectionRegistry {
  private memberships = new Map<string, ConnectionMembership>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  remember(membership: ConnectionMembership) {
    this.cancelDisconnect(membership.clientId);
    this.memberships.set(membership.clientId, membership);
  }

  get(clientId: string) {
    return this.memberships.get(clientId);
  }

  forget(clientId: string) {
    this.cancelDisconnect(clientId);
    this.memberships.delete(clientId);
  }

  scheduleDisconnect(clientId: string, onExpire: () => void, delayMs: number) {
    this.cancelDisconnect(clientId);
    if (!this.memberships.has(clientId)) {
      return;
    }
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(clientId);
      onExpire();
    }, delayMs);
    this.disconnectTimers.set(clientId, timer);
  }

  cancelDisconnect(clientId: string) {
    const timer = this.disconnectTimers.get(clientId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(clientId);
    }
  }
}
