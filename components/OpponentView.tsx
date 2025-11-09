


import React from 'react';
import { Player } from '../types';
import { BrainCircuitIcon } from './icons';

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

interface OpponentViewProps {
    opponent: Player;
    totalProblems: number;
}

const OpponentView: React.FC<OpponentViewProps> = ({ opponent, totalProblems }) => {
    return (
        <div className="bg-gray-800 border border-cyan-500/30 rounded-lg p-6 shadow-2xl shadow-cyan-500/10 flex flex-col gap-4">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-400">{opponent.name}</h2>
            </div>
             <ProgressBar value={opponent.hp} />
             <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-300">
                    <BrainCircuitIcon /> Progress
                </div>
                <p className="text-gray-400 mt-2">
                    Solved <span className="text-cyan-400 font-bold">{opponent.currentProblem}</span> / {totalProblems} problems
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-3">
                    <div className="bg-cyan-600 h-2.5 rounded-full" style={{ width: `${(opponent.currentProblem / totalProblems) * 100}%` }}></div>
                </div>
             </div>
        </div>
    );
};

export default OpponentView;