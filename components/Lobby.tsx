import React, { useState } from 'react';
import { Game, PlayerId } from '../types';
import * as gameService from '../services/gameService';
import { WandSparklesIcon, PencilIcon } from './icons';

interface LobbyProps {
    onGameReady: (game: Game, playerId: PlayerId) => void;
}

const difficulties = ['Easy', 'Medium', 'Hard'];
const problemCounts = [3, 5, 7];
type Tab = 'create' | 'join';
type CreateTab = 'random' | 'custom';

const Lobby: React.FC<LobbyProps> = ({ onGameReady }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('create');
    
    // Create state
    const [createTab, setCreateTab] = useState<CreateTab>('random');
    const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
    const [selectedCount, setSelectedCount] = useState(3);
    const [customPrompts, setCustomPrompts] = useState('');
    
    // Join state
    const [joinGameId, setJoinGameId] = useState('');

    const handleCreateGame = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const prompts = customPrompts.split('\n').filter(p => p.trim() !== '');
            if (createTab === 'custom' && prompts.length === 0) {
                 setError("Please enter at least one problem idea for a custom clash.");
                 setIsLoading(false);
                 return;
            }
            
            const { game, playerId } = await gameService.createGame(selectedCount, selectedDifficulty, createTab === 'custom' ? prompts : undefined);
            onGameReady(game, playerId);
        } catch (err: any) {
            setError(err.message || 'Failed to create game. Please try again.');
            setIsLoading(false);
        }
    };
    
    const handleJoinGame = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { game, playerId } = await gameService.joinGame(joinGameId.toUpperCase());
            onGameReady(game, playerId);
        } catch (err: any) {
            setError(err.message || 'Failed to join game. Check the ID and try again.');
            setIsLoading(false);
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
            <div className="w-full max-w-lg mx-auto bg-gray-800 border border-cyan-500/30 rounded-lg p-8 shadow-2xl">
                <h1 className="text-5xl font-bold text-cyan-400 mb-2 text-center">Welcome to LeetClash</h1>
                <p className="text-gray-400 mb-8 text-center">Choose your challenge and start the duel!</p>

                 <div className="flex bg-gray-900 rounded-lg p-1 mb-6">
                    <button 
                        onClick={() => setActiveTab('create')}
                        className={`w-1/2 py-2 rounded-md font-bold transition-colors ${activeTab === 'create' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                        Create Game
                    </button>
                    <button 
                        onClick={() => setActiveTab('join')}
                        className={`w-1/2 py-2 rounded-md font-bold transition-colors ${activeTab === 'join' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                       Join Game
                    </button>
                </div>
                
                {activeTab === 'create' && (
                    <>
                        <div className="flex bg-gray-700 rounded-lg p-1 mb-6">
                            <button 
                                onClick={() => setCreateTab('random')}
                                className={`w-1/2 py-2 rounded-md font-bold text-sm transition-colors ${createTab === 'random' ? 'bg-cyan-700 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                            >
                                Random Clash
                            </button>
                            <button 
                                onClick={() => setCreateTab('custom')}
                                className={`w-1/2 py-2 rounded-md font-bold text-sm transition-colors ${createTab === 'custom' ? 'bg-cyan-700 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                            >
                               Custom Clash
                            </button>
                        </div>

                        <div className="space-y-6">
                             <div>
                                <label className="block text-lg font-medium text-gray-300 mb-2">Difficulty</label>
                                <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1">
                                    {difficulties.map(d => (
                                        <button key={d} onClick={() => setSelectedDifficulty(d)} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${selectedDifficulty === d ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}`}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {createTab === 'random' ? (
                                <div>
                                    <label className="block text-lg font-medium text-gray-300 mb-2">Number of Problems</label>
                                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1">
                                        {problemCounts.map(c => (
                                            <button key={c} onClick={() => setSelectedCount(c)} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${selectedCount === c ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}`}>
                                                {c} Problems
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                     <label htmlFor="custom-prompts" className="block text-lg font-medium text-gray-300 mb-2">Problem Ideas</label>
                                     <textarea id="custom-prompts" rows={3} value={customPrompts} onChange={(e) => setCustomPrompts(e.target.value)} className="w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y" placeholder="e.g., Check if a string is a palindrome&#10;e.g., Find the maximum value in an array" />
                                </div>
                            )}
                        </div>
                        <div className="mt-8">
                             <button onClick={handleCreateGame} disabled={isLoading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-105">
                                {isLoading ? (<><svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Creating Game...</>) 
                                : (createTab === 'random' ? <><WandSparklesIcon /> Create Random Clash</> : <><PencilIcon /> Create Custom Clash</>)}
                            </button>
                        </div>
                    </>
                )}
                
                {activeTab === 'join' && (
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="game-id" className="block text-lg font-medium text-gray-300 mb-2">Game ID</label>
                            <input
                                id="game-id"
                                type="text"
                                value={joinGameId}
                                onChange={(e) => setJoinGameId(e.target.value)}
                                className="w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-4 font-mono text-2xl tracking-widest text-center uppercase focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                placeholder="ABC123"
                                maxLength={6}
                            />
                        </div>
                         <button onClick={handleJoinGame} disabled={isLoading || !joinGameId} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105">
                             {isLoading ? (<><svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Joining...</>) : "Join Clash"}
                        </button>
                    </div>
                )}
                
                {error && <p className="text-red-400 text-center mt-4">{error}</p>}
                
            </div>
        </div>
    );
};

export default Lobby;