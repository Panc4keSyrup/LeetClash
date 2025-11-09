import React, { useState } from 'react';
import { Problem } from '../types';
import { generateProblems, generateCustomProblems } from '../services/geminiService';
import { WandSparklesIcon, PencilIcon } from './icons';

interface MainMenuProps {
    onStartGame: (problems: Problem[]) => void;
}

const difficulties = ['Easy', 'Medium', 'Hard'];
const problemCounts = [3, 5, 7];
type Tab = 'random' | 'custom';

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
    const [selectedCount, setSelectedCount] = useState(3);
    const [activeTab, setActiveTab] = useState<Tab>('random');
    const [customPrompts, setCustomPrompts] = useState('');

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const generatedProblems = await generateProblems(selectedCount, selectedDifficulty);
            if (!generatedProblems || generatedProblems.length === 0) {
                throw new Error("The AI failed to generate any problems.");
            }
            onStartGame(generatedProblems);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to generate problems. Please try again.');
            setIsLoading(false);
        }
    };

    const handleCustomGenerate = async () => {
        const prompts = customPrompts.split('\n').filter(p => p.trim() !== '');
        if (prompts.length === 0) {
            setError("Please enter at least one problem idea.");
            return;
        }

        setIsLoading(true);
        setError(null);
        
        try {
            const generatedProblems = await generateCustomProblems(prompts, selectedDifficulty);
            if (!generatedProblems || generatedProblems.length === 0) {
                throw new Error("The AI failed to generate any custom problems.");
            }
            onStartGame(generatedProblems);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to generate custom problems. Please try again.');
            setIsLoading(false);
        }
    };


    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
            <div className="w-full max-w-lg mx-auto bg-gray-800 border border-cyan-500/30 rounded-lg p-8 shadow-2xl text-center">
                <h1 className="text-5xl font-bold text-cyan-400 mb-2">Welcome to LeetClash</h1>
                <p className="text-gray-400 mb-8">Choose your challenge and start the duel!</p>

                <div className="mb-6">
                    <div className="flex bg-gray-900 rounded-lg p-1">
                        <button 
                            onClick={() => setActiveTab('random')}
                            className={`w-1/2 py-2 rounded-md font-bold transition-colors ${activeTab === 'random' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            Random Clash
                        </button>
                        <button 
                            onClick={() => setActiveTab('custom')}
                            className={`w-1/2 py-2 rounded-md font-bold transition-colors ${activeTab === 'custom' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                           Custom Clash
                        </button>
                    </div>
                </div>

                {activeTab === 'random' ? (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-lg font-medium text-gray-300 mb-2">Difficulty</label>
                            <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1">
                                {difficulties.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSelectedDifficulty(d)}
                                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                                            selectedDifficulty === d
                                                ? 'bg-cyan-600 text-white'
                                                : 'bg-transparent text-gray-400 hover:bg-gray-700'
                                        }`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-lg font-medium text-gray-300 mb-2">Number of Problems</label>
                            <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1">
                                {problemCounts.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setSelectedCount(c)}
                                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                                            selectedCount === c
                                                ? 'bg-cyan-600 text-white'
                                                : 'bg-transparent text-gray-400 hover:bg-gray-700'
                                        }`}
                                    >
                                        {c} Problems
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-lg font-medium text-gray-300 mb-2">Difficulty</label>
                             <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1">
                                {difficulties.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSelectedDifficulty(d)}
                                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                                            selectedDifficulty === d
                                                ? 'bg-cyan-600 text-white'
                                                : 'bg-transparent text-gray-400 hover:bg-gray-700'
                                        }`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                             <label htmlFor="custom-prompts" className="block text-lg font-medium text-gray-300 mb-2">Problem Ideas</label>
                             <textarea 
                                id="custom-prompts"
                                rows={4}
                                value={customPrompts}
                                onChange={(e) => setCustomPrompts(e.target.value)}
                                className="w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y"
                                placeholder="e.g., Check if a string is a palindrome&#10;e.g., Find the maximum value in an array"
                             />
                        </div>
                    </div>
                )}


                <div className="mt-10">
                    <button
                        onClick={activeTab === 'random' ? handleGenerate : handleCustomGenerate}
                        disabled={isLoading}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-105"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Generating Clash...
                            </>
                        ) : (
                           activeTab === 'random' ? (
                                <> <WandSparklesIcon /> Start Random Clash </>
                           ) : (
                                <> <PencilIcon /> Start Custom Clash </>
                           )
                        )}
                    </button>
                </div>

                {error && <p className="text-red-400 text-center mt-4">{error}</p>}
            </div>
        </div>
    );
};

export default MainMenu;
