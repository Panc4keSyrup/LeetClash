import React from 'react';
import { GameOverStatus } from '../types';
import { TrophyIcon, SkullIcon, HandshakeIcon } from './icons';

interface GameOverModalProps {
    gameStatus: GameOverStatus;
    onReset: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ gameStatus, onReset }) => {
    const { winner, winnerName, reason } = gameStatus;

    const getIcon = () => {
        if (winner === 'draw' || winnerName === 'Game Over') return <SkullIcon />;
        if (reason.includes('lost all HP')) return <SkullIcon />;
        return <TrophyIcon />;
    };

    const getTitle = () => {
        if (winner === 'draw') return "It's a Draw!";
        return `${winnerName} Wins!`;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl border border-cyan-500/50 shadow-2xl shadow-cyan-500/20 w-full max-w-md text-center p-8">
                <div className="text-7xl mx-auto mb-4 text-yellow-400 w-20 h-20 flex items-center justify-center">
                   {getIcon()}
                </div>
                <h2 className="text-4xl font-extrabold text-cyan-400 mb-2">{getTitle()}</h2>
                <p className="text-gray-300 text-lg mb-8">{reason}</p>
                <button
                    onClick={onReset}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105"
                >
                    Play Again
                </button>
            </div>
        </div>
    );
};

export default GameOverModal;