/**
 * Pure State Machine - CLEAN & HORIZONTAL MESSAGES
 */
import { GameState, GameAction, GamePhase, TransitionResult } from './types';
export declare function transition(state: GameState, action: GameAction): TransitionResult;
export declare function transitionToClues(state: GameState): TransitionResult;
export declare function canPlayerAct(state: GameState, playerId: number, action: 'clue' | 'vote'): boolean;
export declare function getCurrentActor(state: GameState): number | null;
export declare function getPhaseDescription(phase: GamePhase): string;
//# sourceMappingURL=state-machine.d.ts.map