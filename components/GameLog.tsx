
import React from 'react';
import { LogIcon } from './icons';

interface GameLogProps {
    logs: string[];
}

const GameLog: React.FC<GameLogProps> = ({ logs }) => {
    return (
        <div className="mt-8 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <LogIcon />
                Game Log
            </h3>
            <div className="h-40 overflow-y-auto bg-gray-900 rounded-md p-3 flex flex-col-reverse">
                <ul>
                    {logs.map((log, index) => (
                        <li key={index} className="text-sm text-gray-400 font-mono py-1 border-b border-gray-800">
                            {log.startsWith('✅') ? <span className="text-green-400">{log}</span> :
                             log.startsWith('❌') ? <span className="text-red-400">{log}</span> :
                             log}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default GameLog;
