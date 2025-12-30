/**
 * Game Types for HaxBall Impostor Game
 */
/**
 * Game phases following the state machine pattern
 */
export declare enum GamePhase {
    WAITING = "WAITING",
    ASSIGN = "ASSIGN",
    CLUES = "CLUES",
    DISCUSSION = "DISCUSSION",
    VOTING = "VOTING",
    REVEAL = "REVEAL",
    RESULTS = "RESULTS"
}
/**
 * Player in the game system
 */
export interface GamePlayer {
    id: number;
    name: string;
    auth: string;
    isAdmin: boolean;
    joinedAt: number;
}
/**
 * A single round of the game
 */
export interface Round {
    id: string;
    footballer: string;
    impostorId: number;
    normalPlayerIds: number[];
    clues: Map<number, string>;
    votes: Map<number, number>;
    clueOrder: number[];
    currentClueIndex: number;
    phaseDeadline: number | null;
    startedAt: number;
    endedAt?: number;
    result?: RoundResult;
}
/**
 * Result of a completed round
 */
export interface RoundResult {
    impostorWon: boolean;
    impostorId: number;
    impostorName: string;
    footballer: string;
    votedOutId: number | null;
    votedOutName: string | null;
    wasCorrectVote: boolean;
}
/**
 * Complete game state
 */
export interface GameState {
    phase: GamePhase;
    players: Map<number, GamePlayer>;
    queue: number[];
    currentRound: Round | null;
    roundHistory: RoundResult[];
    settings: GameSettings;
}
/**
 * Configurable game settings
 */
export interface GameSettings {
    minPlayers: number;
    maxPlayersPerRound: number;
    clueTimeSeconds: number;
    discussionTimeSeconds: number;
    votingTimeSeconds: number;
}
/**
 * Default game settings
 */
export declare const DEFAULT_GAME_SETTINGS: GameSettings;
/**
 * Actions that can modify game state
 */
export type GameAction = {
    type: 'PLAYER_JOIN';
    player: GamePlayer;
} | {
    type: 'PLAYER_LEAVE';
    playerId: number;
} | {
    type: 'JOIN_QUEUE';
    playerId: number;
} | {
    type: 'LEAVE_QUEUE';
    playerId: number;
} | {
    type: 'START_GAME';
    footballers: string[];
} | {
    type: 'SUBMIT_CLUE';
    playerId: number;
    clue: string;
} | {
    type: 'CLUE_TIMEOUT';
} | {
    type: 'END_DISCUSSION';
} | {
    type: 'SUBMIT_VOTE';
    playerId: number;
    votedId: number;
} | {
    type: 'END_VOTING';
} | {
    type: 'END_REVEAL';
} | {
    type: 'FORCE_REVEAL';
} | {
    type: 'SKIP_PHASE';
} | {
    type: 'RESET_ROUND';
} | {
    type: 'RESET_GAME';
};
/**
 * Result from a state transition
 */
export interface TransitionResult {
    state: GameState;
    sideEffects: SideEffect[];
}
/**
 * Side effects to execute after state transition
 */
export type SideEffect = {
    type: 'ANNOUNCE_PUBLIC';
    message: string;
    style?: AnnouncementStyle;
} | {
    type: 'ANNOUNCE_PRIVATE';
    playerId: number;
    message: string;
} | {
    type: 'SET_PHASE_TIMER';
    durationSeconds: number;
} | {
    type: 'CLEAR_TIMER';
} | {
    type: 'LOG_ROUND';
    result: RoundResult;
} | {
    type: 'AUTO_START_GAME';
};
/**
 * Announcement styling options
 */
export interface AnnouncementStyle {
    color?: number;
    style?: 'normal' | 'bold' | 'italic' | 'small' | 'small-bold' | 'small-italic';
    sound?: 0 | 1 | 2;
}
/**
 * Initial game state factory
 */
export declare function createInitialState(settings?: Partial<GameSettings>): GameState;
//# sourceMappingURL=types.d.ts.map