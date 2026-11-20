import { ConnectionRegistry } from './connection-registry';

describe('ConnectionRegistry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancels a pending removal when the same client comes back', () => {
    const registry = new ConnectionRegistry();
    const onExpire = jest.fn();
    registry.remember({
      clientId: 'player-1',
      gameCode: 'ABCD',
      role: 'player',
      playerName: 'Ada',
    });

    registry.scheduleDisconnect('player-1', onExpire, 15000);
    registry.remember({
      clientId: 'player-1',
      gameCode: 'ABCD',
      role: 'player',
      playerName: 'Ada',
    });

    jest.advanceTimersByTime(15000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(registry.get('player-1')?.gameCode).toBe('ABCD');
  });

  it('runs the removal callback once the grace period elapses', () => {
    const registry = new ConnectionRegistry();
    const onExpire = jest.fn();
    registry.remember({
      clientId: 'player-1',
      gameCode: 'ABCD',
      role: 'player',
    });

    registry.scheduleDisconnect('player-1', onExpire, 15000);
    jest.advanceTimersByTime(14999);
    expect(onExpire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
