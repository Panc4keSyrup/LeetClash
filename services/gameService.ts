import { Problem, Player, SinglePlayerGame, Game, JudgeResult, PlayerId, GameOverReason } from '../types';
import { checkSolution, generateProblems, generateCustomProblems } from './geminiService';
import { HP_REGAIN } from '../constants';
import { db } from './firebase';
import { ref, set, get, onValue, off, runTransaction } from 'firebase/database';

// --- Single Player Game Logic ---

const addLog = (game: SinglePlayerGame, message: string): SinglePlayerGame => {
    const newLogs = [message, ...game.logs.slice(0, 19)];
    return { ...game, logs: newLogs };
};

const DRAIN_PER_TICK = 0.01;
const TICK_INTERVAL_MS = 120; // 100 HP / 0.01 HP/tick = 10000 ticks. 20 min * 60s/min = 1200s. 1200s / 10000 ticks = 0.12s/tick = 120ms/tick.

export const applyHPDrain = (game: SinglePlayerGame): SinglePlayerGame => {
    if (game.status !== 'playing') {
        return game;
    }
    const now = Date.now();
    const elapsedMs = now - game.lastTickTime;
    
    const ticksPassed = Math.floor(elapsedMs / TICK_INTERVAL_MS);

    if (ticksPassed > 0) {
        const drainAmount = ticksPassed * DRAIN_PER_TICK;
        const player = game.player;
        const newGame = {
            ...game,
            player: { ...player, hp: Math.max(0, player.hp - drainAmount) },
            lastTickTime: game.lastTickTime + (ticksPassed * TICK_INTERVAL_MS),
        };
        return newGame;
    }

    return game;
};

export const checkGameOver = (game: SinglePlayerGame): SinglePlayerGame => {
    if (game.status !== 'playing') {
        return game;
    }
    const player = game.player;
    let isOver = false;
    let winnerInfo: SinglePlayerGame['winnerInfo'] = null;

    if (player.hp <= 0) {
        winnerInfo = { won: false, reason: 'You lost all your HP.' };
        isOver = true;
    } else if (player.currentProblem >= game.problems.length) {
        winnerInfo = { won: true, reason: 'You solved all the problems!' };
        isOver = true;
    }
    
    return isOver ? { ...game, status: 'over', winnerInfo } : game;
};

export const initializeGame = (problems: Problem[]): SinglePlayerGame => {
    const player: Player = {
        name: 'Solo Coder',
        hp: 100,
        currentProblem: 0,
        code: problems[0].template,
        isSubmitting: false,
    };
    return {
        problems,
        player,
        status: 'playing',
        logs: [`Game started with ${problems.length} problems. Good luck!`],
        winnerInfo: null,
        lastTickTime: Date.now(),
    };
};

export const submitSolution = async (game: SinglePlayerGame): Promise<SinglePlayerGame> => {
    if (game.status !== 'playing' || game.player.isSubmitting) return game;

    const problem = game.problems[game.player.currentProblem];
    if (!problem) return game;
    
    // Apply drain before judging
    let gameAfterDrain = applyHPDrain(game);
    let player = gameAfterDrain.player;
    
    const result: JudgeResult = await checkSolution(player.code, problem);
    
    // Apply drain again after judging to account for time taken
    let updatedGame = applyHPDrain(gameAfterDrain);
    let currentPlayer = updatedGame.player;

    if (result.success) {
        const regain = HP_REGAIN[problem.complexity as keyof typeof HP_REGAIN] || 5;
        currentPlayer.hp += regain;
        currentPlayer.currentProblem += 1;
        updatedGame = addLog(updatedGame, `✅ Solved ${problem.id} (+${regain} HP)`);
        if (currentPlayer.currentProblem < updatedGame.problems.length) {
            currentPlayer.code = updatedGame.problems[currentPlayer.currentProblem].template;
        }
    } else {
        updatedGame = addLog(updatedGame, `❌ Failed ${problem.id}. ${result.detail || 'Wrong answer.'}`);
    }
    
    currentPlayer.isSubmitting = false;
    
    return checkGameOver(updatedGame);
};


// --- Multiplayer Game Logic (using Firebase) ---

const generateGameId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const getGameRef = (gameId: string) => ref(db, `games/${gameId}`);

const addLogMultiplayer = (game: Game, message: string): Game => {
    const newLogs = [message, ...(game.logs || []).slice(0, 19)];
    return { ...game, logs: newLogs };
}

export const createGame = async (count: number, difficulty: string, prompts?: string[]): Promise<{ game: Game, playerId: PlayerId }> => {
    const problems = prompts && prompts.length > 0
        ? await generateCustomProblems(prompts, difficulty)
        : await generateProblems(count, difficulty);

    if (!problems || problems.length === 0) throw new Error("Failed to generate problems.");

    const gameId = generateGameId();
    const playerId: PlayerId = 'playerA';
    
    const player: Player = {
        name: 'Player A',
        hp: 100,
        currentProblem: 0,
        code: problems[0].template,
        isSubmitting: false,
    };

    const game: Game = {
        id: gameId,
        players: { [playerId]: player },
        problems,
        status: 'waiting',
        logs: [`Game ${gameId} created. Waiting for opponent...`],
    };
    
    await set(getGameRef(gameId), game);
    return { game, playerId };
};

export const joinGame = async (gameId: string): Promise<{ game: Game, playerId: PlayerId }> => {
    const normalizedGameId = gameId.toUpperCase();
    const gameRef = getGameRef(normalizedGameId);
    
    try {
        const result = await runTransaction(gameRef, (currentGame: Game | null) => {
            if (!currentGame) {
                // Game doesn't exist. Abort transaction.
                return; 
            }
            if (currentGame.players.playerB) {
                // Game is full. Abort transaction.
                return;
            }

            const playerB: Player = {
                name: 'Player B',
                hp: 100,
                currentProblem: 0,
                code: currentGame.problems[0].template,
                isSubmitting: false,
            };
            currentGame.players.playerB = playerB;
            currentGame.status = 'playing';
            currentGame.lastTickTime = Date.now();
            currentGame.logs.unshift('Player B joined. The clash begins!');
            return currentGame;
        });

        if (!result.committed || !result.snapshot.exists()) {
             const gameSnapshot = await get(gameRef);
             if (!gameSnapshot.exists()) throw new Error("Game not found.");
             if (gameSnapshot.val().players.playerB) throw new Error("Game is full.");
             throw new Error("Failed to join the game. Please try again.");
        }

        return { game: result.snapshot.val(), playerId: 'playerB' };

    } catch (error: any) {
        console.error("Join Game Transaction error:", error);
        if (error.message.includes("full") || error.message.includes("not found")) {
            throw error;
        }
        throw new Error("An error occurred while trying to join the game.");
    }
};


export const onGameUpdate = (gameId: string, callback: (game: Game | null) => void): (() => void) => {
    const gameRef = getGameRef(gameId);
    const listener = onValue(gameRef, (snapshot) => {
        callback(snapshot.val());
    });

    // Return the unsubscribe function
    return () => off(gameRef, 'value', listener);
};

export const updateCode = (gameId: string, playerId: PlayerId, code: string) => {
    const codeRef = ref(db, `games/${gameId}/players/${playerId}/code`);
    set(codeRef, code);
};

const applyHPDrainMultiplayer = (game: Game): Game => {
    if (game.status !== 'playing' || !game.lastTickTime) return game;
    
    const now = Date.now();
    const elapsedMs = now - game.lastTickTime;
    
    const ticksPassed = Math.floor(elapsedMs / TICK_INTERVAL_MS);

    if (ticksPassed > 0) {
        const drainAmount = ticksPassed * DRAIN_PER_TICK;
        if (game.players.playerA) game.players.playerA.hp = Math.max(0, game.players.playerA.hp - drainAmount);
        if (game.players.playerB) game.players.playerB.hp = Math.max(0, game.players.playerB.hp - drainAmount);
        game.lastTickTime += (ticksPassed * TICK_INTERVAL_MS);
    }
    
    return game;
}

const checkGameOverMultiplayer = (game: Game): Game => {
    if (game.status !== 'playing') return game;

    const pA = game.players.playerA;
    const pB = game.players.playerB;
    let winnerInfo: GameOverReason | undefined = undefined;

    const pADead = pA && pA.hp <= 0;
    const pBDead = pB && pB.hp <= 0;
    const pAFinished = pA && pA.currentProblem >= game.problems.length;
    const pBFinished = pB && pB.currentProblem >= game.problems.length;
    
    if (pADead && pBDead) winnerInfo = { winner: 'draw', winnerName: "Draw", reason: "Both players ran out of HP!" };
    else if (pADead) winnerInfo = { winner: 'playerB', winnerName: "Player B", reason: "Player A ran out of HP!" };
    else if (pBDead) winnerInfo = { winner: 'playerA', winnerName: "Player A", reason: "Player B ran out of HP!" };
    else if (pAFinished) winnerInfo = { winner: 'playerA', winnerName: "Player A", reason: "Player A solved all problems!" };
    else if (pBFinished) winnerInfo = { winner: 'playerB', winnerName: "Player B", reason: "Player B solved all problems!" };
    
    if (winnerInfo) {
        game.status = 'over';
        game.winnerInfo = winnerInfo;
    }
    return game;
}

export const tickMultiplayerGame = (gameId: string) => {
    const gameRef = getGameRef(gameId);
    runTransaction(gameRef, (currentGame) => {
        if (currentGame && currentGame.status === 'playing') {
            const drainedGame = applyHPDrainMultiplayer(currentGame);
            return checkGameOverMultiplayer(drainedGame);
        }
        return currentGame; // No change
    });
};

export const submitSolutionMultiplayer = async (gameId: string, playerId: PlayerId): Promise<void> => {
    const gameRef = getGameRef(gameId);

    // Step 1: Read the game state to get the problem and code
    const gameSnapshot = await get(gameRef);
    if (!gameSnapshot.exists()) return;
    
    let game = gameSnapshot.val() as Game;
    const player = game.players[playerId];
    
    if (!player || player.isSubmitting || game.status !== 'playing') return;

    const problem = game.problems[player.currentProblem];
    if (!problem) return;

    // Step 2: Set submitting state to true atomically
    await runTransaction(gameRef, (currentGame) => {
        if (currentGame && currentGame.players[playerId]) {
            currentGame.players[playerId]!.isSubmitting = true;
        }
        return currentGame;
    });

    // Step 3: Run the async Gemini check
    const result = await checkSolution(player.code, problem);
    
    // Step 4: Apply the results atomically
    await runTransaction(gameRef, (finalGame) => {
        if (!finalGame) return;
        
        // Always apply drain to keep it fair
        finalGame = applyHPDrainMultiplayer(finalGame);
        
        const finalPlayer = finalGame.players[playerId];
        if (!finalPlayer) return;

        if (result.success) {
            const regain = HP_REGAIN[problem.complexity as keyof typeof HP_REGAIN] || 5;
            finalPlayer.hp += regain;
            finalPlayer.currentProblem += 1;
            finalGame = addLogMultiplayer(finalGame, `✅ ${finalPlayer.name} solved ${problem.id} (+${regain} HP)`);
            if (finalPlayer.currentProblem < finalGame.problems.length) {
                finalPlayer.code = finalGame.problems[finalPlayer.currentProblem].template;
            }
        } else {
            finalGame = addLogMultiplayer(finalGame, `❌ ${finalPlayer.name} failed ${problem.id}.`);
        }

        finalPlayer.isSubmitting = false;
        return checkGameOverMultiplayer(finalGame);
    });
};