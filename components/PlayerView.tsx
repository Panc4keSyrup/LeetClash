

import React from 'react';
import { Player, Problem } from '../types';
import { CodeIcon, ComplexityIcon, BrainCircuitIcon } from './icons';

interface ProgressBarProps {
    value: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value }) => {
    const healthBarGradient = 'linear-gradient(to right, #ef4444, #fde047 40%, #22c55e 60%)';

    return (
        <div className="w-full bg-gray-700 rounded-full h-6 border-2 border-gray-600 overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-500 ease-out flex items-center justify-center"
                style={{
                    width: `${Math.max(0, value)}%`,
                    backgroundImage: healthBarGradient
                }}
            >
                <span className="font-bold text-sm text-white text-shadow-sm">{value.toFixed(2)} HP</span>
            </div>
        </div>
    );
};


interface PlayerViewProps {
    player: Player;
    problem: Problem | undefined;
    onCodeChange: (code: string) => void;
    onSubmit: () => void;
}

const PlayerView: React.FC<PlayerViewProps> = ({ player, problem, onCodeChange, onSubmit }) => {
    return (
        <div className="bg-gray-800 border border-cyan-500/30 rounded-lg p-6 shadow-2xl shadow-cyan-500/10 flex flex-col gap-4 h-full">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-cyan-400">{player.name}</h2>
                <ProgressBar value={player.hp} />
            </div>

            {problem ? (
                <>
                    <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
                        <div className="flex items-center gap-2 mb-2 text-lg font-semibold text-gray-300">
                           <BrainCircuitIcon /> Problem {player.currentProblem + 1}: {problem.id}
                        </div>
                        <p className="text-gray-400">{problem.description}</p>
                        <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                            <ComplexityIcon />
                            <span>Complexity Bonus: <span className="font-mono text-yellow-400">{problem.complexity}</span></span>
                        </div>
                    </div>

                    <div className="flex-grow flex flex-col">
                         <label htmlFor={`code-${player.name}`} className="flex items-center gap-2 mb-2 text-gray-400">
                            <CodeIcon />
                            <span>Solution</span>
                        </label>
                        <textarea
                            id={`code-${player.name}`}
                            value={player.code}
                            onChange={(e) => onCodeChange(e.target.value)}
                            className="w-full flex-grow bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-4 font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none"
                            placeholder="Write your function here..."
                            spellCheck="false"
                            disabled={player.isSubmitting}
                        />
                    </div>

                    <button
                        onClick={onSubmit}
                        disabled={player.isSubmitting}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {player.isSubmitting ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Judging...
                            </>
                        ) : 'Submit Solution'}
                    </button>
                </>
            ) : (
                <div className="text-center py-20 bg-gray-900 rounded-lg">
                    <h3 className="text-2xl font-bold text-green-400">🎉 All Problems Completed! 🎉</h3>
                </div>
            )}
        </div>
    );
};

export default PlayerView;