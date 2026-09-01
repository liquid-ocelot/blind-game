
export const ClientEvents = {
  CREATE_GAME: 'game:create',
  JOIN_GAME: 'game:join',
  START_GAME: 'game:start',
  ANSWER: 'game:answer',
  UPDATE_SETTINGS: 'game:update-settings',
  SELECT_TEAM: 'game:select-team',
} as const;

export const ServerEvents = {
  GAME_CREATED: 'game:created',
  PLAYER_JOINED: 'game:player-joined',
  PLAYER_UPDATED: 'game:player-updated',
  PLAYERS_UPDATED: 'game:players-updated',
  GAME_STARTED: 'game:started',
  ROUND_STARTED: 'round:started',
  ROUND_COUNTDOWN: 'round:countdown',
  ROUND_ENDED: 'round:ended',
  SCORE_UPDATED: 'game:score-updated',
  VALID_ANSWER: 'game:valid-answer',
  BONUS_VALID_ANSWER: 'game:bonus-valid-answer',
  INVALID_ANSWER: 'game:invalid-answer',
  GAME_FINISHED: 'game:finished',
  ROOM_SETTINGS_UPDATED: 'room:settings-updated',
} as const;
