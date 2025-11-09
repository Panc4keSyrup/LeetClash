import React, { useState, useEffect } from 'react';
// FIX: Import GameOverStatus to be used for explicit typing.
import { Game, PlayerId, SinglePlayerGame, GameOverReason, GameOverStatus } from './types';
import * as gameService from './services/gameService';
import PlayerView from './components/PlayerView';
import OpponentView from './components/OpponentView';
import GameLog from './components/GameLog';
import GameOverModal from './components/GameOverModal';
import Lobby from './components/Lobby';
import MainMenu from './components/MainMenu';
import { SwordsIcon } from './components/icons';
import { Problem } from './types';


const SinglePlayerGameView: React.FC<{ onExit: () => void }> = ({ onExit }) => {
    const [game, setGame] = useState<SinglePlayerGame | null>(null);

    useEffect(() => {
        if (game?.status === 'playing') {
            const interval = setInterval(() => {
                setGame(currentGame => {
                    if (!currentGame || currentGame.status !== 'playing') {
                        clearInterval(interval);
                        return currentGame;
                    }
                    let updatedGame = gameService.applyHPDrain(currentGame);
                    updatedGame = gameService.checkGameOver(updatedGame);
                    return updatedGame;
                });
            }, 120);
            return () => clearInterval(interval);
        }
    }, [game?.status]);

    const handleStartGame = (problems: Problem[]) => {
        setGame(gameService.initializeGame(problems));
    };

    const handleCodeChange = (code: string) => {
        if (game) {
            setGame({ ...game, player: { ...game.player, code } });
        }
    };

    const handleSubmit = async () => {
        if (!game || game.player.isSubmitting) return;

        setGame({ ...game, player: { ...game.player, isSubmitting: true } });
        const updatedGame = await gameService.submitSolution(game);
        setGame(updatedGame);
    };

    const resetGame = () => {
        setGame(null);
    };

    if (!game) {
        return <MainMenu onStartGame={handleStartGame} />;
    }

    const { player, problems, logs, status, winnerInfo } = game;

    // Adapt single-player winnerInfo to what GameOverModal expects
    // FIX: Explicitly typing gameOverStatus to GameOverStatus ensures the object structure is correct and prevents type inference issues.
    const gameOverStatus: GameOverStatus | null = winnerInfo ? {
        status: 'over',
        winner: winnerInfo.won ? 'playerA' : 'draw', // Dummy values for display
        winnerName: winnerInfo.won ? 'You' : 'Game Over',
        reason: winnerInfo.reason,
    } : null;

    return (
         <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                     <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400 tracking-wider flex items-center justify-center gap-4">
                        <SwordsIcon /> LeetClash <SwordsIcon />
                    </h1>
                    <p className="text-gray-400 mt-2">Code Alone Challenge</p>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2">
                         <PlayerView 
                            player={player}
                            problem={problems[player.currentProblem]}
                            onCodeChange={handleCodeChange}
                            onSubmit={handleSubmit}
                        />
                    </div>
                    <div className="flex flex-col gap-8">
                        <div className="bg-gray-800 border border-cyan-500/30 rounded-lg p-6 shadow-2xl text-center">
                            <h3 className="text-xl font-bold text-gray-400">Game Mode: Solo</h3>
                            <p className="text-gray-500 mt-2">Focus and defeat the clock!</p>
                        </div>
                        <GameLog logs={logs} />
                    </div>
                </main>
                
                {status === 'over' && gameOverStatus && (
                    <GameOverModal 
                        gameStatus={gameOverStatus} 
                        onReset={resetGame} 
                    />
                )}
                 <button onClick={onExit} className="mt-8 mx-auto block text-cyan-400 hover:text-cyan-300">
                    Back to Main Menu
                </button>
            </div>
        </div>
    );
};


const MultiplayerGameView: React.FC<{ onExit: () => void }> = ({ onExit }) => {
    const [gameId, setGameId] = useState<string | null>(null);
    const [playerId, setPlayerId] = useState<PlayerId | null>(null);
    const [game, setGame] = useState<Game | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Effect for real-time game state updates from Firebase
    useEffect(() => {
        if (!gameId) return;

        const handleGameUpdate = (newGame: Game | null) => {
            if (newGame) {
                setGame(newGame);
                setError(null);
            } else {
                setError("Game not found. It may have been deleted or the ID is incorrect.");
                // Reset state if game becomes null
                setGameId(null); 
                setPlayerId(null);
                setGame(null);
            }
        };

        const unsubscribe = gameService.onGameUpdate(gameId, handleGameUpdate);
        
        // Cleanup subscription on component unmount or gameId change
        return () => unsubscribe();
    }, [gameId]);


    // Effect for running the drain loop (host-only)
    useEffect(() => {
        if (game?.status === 'playing' && gameId && playerId === 'playerA') {
            const interval = setInterval(() => {
                gameService.tickMultiplayerGame(gameId);
            }, 120);
            return () => clearInterval(interval);
        }
    }, [game?.status, gameId, playerId]);

    const handleGameReady = (newGame: Game, joinedPlayerId: PlayerId) => {
        setGame(newGame);
        setGameId(newGame.id);
        setPlayerId(joinedPlayerId);
        setError(null);
    };
    
    const handleCodeChange = (code: string) => {
        if (game && playerId && game.players[playerId]) {
            // Update local state immediately for responsiveness
            const updatedGame: Game = {
                ...game,
                players: {
                    ...game.players,
                    [playerId]: {
                        ...game.players[playerId]!,
                        code: code,
                    }
                }
            };
            setGame(updatedGame);
            // Debounce or directly call Firebase update
            gameService.updateCode(game.id, playerId, code);
        }
    };

    const handleSubmit = () => {
        if (gameId && playerId) {
            gameService.submitSolutionMultiplayer(gameId, playerId);
        }
    };

    const resetGame = () => {
        // No need to manually remove from storage; can be handled by a TTL policy in Firebase or left as is.
        setGameId(null);
        setPlayerId(null);
        setGame(null);
        setError(null);
        onExit();
    };

    if (!game || !playerId) {
        return <Lobby onGameReady={handleGameReady} />;
    }

    const me = game.players[playerId];
    const opponentId = playerId === 'playerA' ? 'playerB' : 'playerA';
    const opponent = game.players[opponentId];

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400 tracking-wider flex items-center justify-center gap-4">
                        <SwordsIcon /> LeetClash <SwordsIcon />
                    </h1>
                    <p className="text-gray-400 mt-2">The Ultimate Coding Duel</p>
                </header>

                 {game.status === 'waiting' && (
                    <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl">
                        <h2 className="text-3xl font-bold text-yellow-400 mb-4 animate-pulse">Waiting for Opponent...</h2>
                        <p className="text-gray-400 mb-2">Share this Game ID with your friend:</p>
                        <div className="bg-gray-900 border-2 border-dashed border-cyan-500 rounded-lg p-4 max-w-sm mx-auto">
                            <p className="text-2xl font-mono text-white tracking-widest">{game.id}</p>
                        </div>
                    </div>
                 )}

                {game.status !== 'waiting' && me && (
                     <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2">
                             <PlayerView 
                                player={me}
                                problem={game.problems[me.currentProblem]}
                                onCodeChange={handleCodeChange}
                                onSubmit={handleSubmit}
                            />
                        </div>
                        <div className="flex flex-col gap-8">
                            {opponent ? <OpponentView opponent={opponent} totalProblems={game.problems.length}/> : <div className="bg-gray-800 border border-cyan-500/30 rounded-lg p-6 shadow-2xl text-center"><p className="text-gray-400">Waiting for opponent...</p></div>}
                            <GameLog logs={game.logs} />
                        </div>
                    </main>
                )}
                
                {game.status === 'over' && game.winnerInfo && (
                    <GameOverModal 
                        gameStatus={{ status: 'over', ...game.winnerInfo }} 
                        onReset={resetGame} 
                    />
                )}
                 {error && <p className="text-red-400 text-center mt-4 animate-pulse">{error}</p>}
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [gameMode, setGameMode] = useState<'menu' | 'single' | 'multi'>('menu');

    const handleExit = () => setGameMode('menu');

    if (gameMode === 'single') {
        return <SinglePlayerGameView onExit={handleExit} />;
    }

    if (gameMode === 'multi') {
        return <MultiplayerGameView onExit={handleExit} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-gray-800 border border-cyan-500/30 rounded-lg p-8 shadow-2xl text-center">
                <h1 className="text-5xl font-bold text-cyan-400 mb-2 flex items-center justify-center gap-4"><SwordsIcon />LeetClash</h1>
                <p className="text-gray-400 mb-10">Select Your Game Mode</p>
                <div className="space-y-4">
                    <button
                        onClick={() => setGameMode('single')}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all transform hover:scale-105"
                    >
                        Single Player
                    </button>
                    <button
                        onClick={() => setGameMode('multi')}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all transform hover:scale-105"
                    >
                        Multiplayer
                    </button>
                </div>
            </div>
        </div>
    );
};


export default App;