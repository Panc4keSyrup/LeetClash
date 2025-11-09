export interface Player {
    name: string;
    hp: number;
    currentProblem: number;
    code: string;
    isSubmitting: boolean;
}

export interface Test {
    inputs: any[];
    expected: any;
}

export interface Problem {
    id: string;
    description: string;
    tests: Test[];
    complexity: string;
    template: string;
}

export type PlayerId = 'playerA' | 'playerB';
export type GameStatus = 'waiting' | 'playing' | 'over';
export type GameOverReason = { winner: PlayerId | 'draw'; winnerName: string; reason: string };

// Multiplayer game state
export interface Game {
    id: string;
    players: { [key in PlayerId]?: Player };
    problems: Problem[];
    logs: string[];
    status: GameStatus;
    winnerInfo?: GameOverReason;
    lastTickTime?: number;
}

// Single player game state
export interface SinglePlayerGame {
    player: Player;
    problems: Problem[];
    logs: string[];
    status: 'playing' | 'over';
    winnerInfo: { won: boolean; reason: string } | null;
    lastTickTime: number;
}


export type GameOverStatus = { status: 'over' } & GameOverReason;

export interface JudgeResult {
    success: boolean;
    reason: string;
    detail?: string;
}
