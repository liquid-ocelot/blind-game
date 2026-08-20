
export const ClientEvents = {
  CREATE_GAME: 'game:create',
  JOIN_GAME: 'game:join',
  START_GAME: 'game:start',
  ANSWER: 'game:answer',
} as const;

export const ServerEvents = {
  GAME_CREATED: 'game:created',
  PLAYER_JOINED: 'game:player-joined',
  GAME_STARTED: 'game:started',
  ROUND_STARTED: 'round:started',
  ROUND_ENDED: 'round:ended',
  SCORE_UPDATED: 'game:score-updated',
  VALID_ANSWER: 'game:valid-answer',
  INVALID_ANSWER: 'game:invalid-answer',
} as const;
