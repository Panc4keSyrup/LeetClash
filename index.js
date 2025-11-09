/* MP-FIX-APPLIED */
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, off, runTransaction } from 'firebase/database';

// --- Start of constants.ts ---
const HP_REGAIN = {
    "O(1)": 25,
    "O(log n)": 20,
    "O(n)": 15,
    "O(n log n)": 10,
    "O(n^2)": 5,
    "O(n^3)": 2,
};
// --- End of constants.ts ---

// --- Start of services/firebase.ts ---
const firebaseConfig = {
apiKey: "AIzaSyAGAg9LocluM8CIy6k2gsJtmX6bZD3vb4o",
authDomain: "leetclash2.firebaseapp.com",
databaseURL: "https://leetclash2-default-rtdb.firebaseio.com/",
projectId: "leetclash2",
storageBucket: "leetclash2.firebasestorage.app",
messagingSenderId: "907615790245",
appId: "1:907615790245:web:745cae12be99d0013e194c"
};
const appFirebase = initializeApp(firebaseConfig);
const db = getDatabase(appFirebase, (globalThis.process?.env?.RTDB_URL || undefined));
// --- End of services/firebase.ts ---

// --- Start of services/geminiService.ts ---
const getAI = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const judgeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    success: { type: Type.BOOLEAN, description: "Whether the code passed all tests." },
    reason: { type: Type.STRING, description: "A short code for the outcome, e.g., 'PASSED', 'WRONG_ANSWER', 'ERROR'." },
    detail: { type: Type.STRING, description: "A detailed explanation of the failure or error, if any." }
  },
  required: ['success', 'reason']
};

const checkSolution = async (code, problem) => {
    const formattedTests = problem.tests.map(t => ({
        inputs: t.inputs,
        expected_output: t.expected
    }));

    const prompt = `
        You are a strict and precise code judge for a Python programming challenge.
        Your task is to evaluate a user-submitted Python function against a set of test cases.
        Do not provide hints or fix the code. Only report the outcome based on my instructions.

        Problem:
        - Function Name: ${problem.id}
        - Description: ${problem.description}

        User's Code:
        \`\`\`python
        ${code}
        \`\`\`

        Test Cases:
        ${JSON.stringify(formattedTests, null, 2)}

        Instructions:
        1. Check if the user's code defines a function with the correct name ('${problem.id}').
        2. Execute the function against each test case.
        3. If the function is missing, or if there is a syntax error, your output must indicate an ERROR.
        4. If the function runs but fails any test case, your output must indicate WRONG_ANSWER and provide details on the first failing test.
        5. If the function passes ALL test cases, your output must indicate PASSED.

        Your response MUST be a valid JSON object matching the provided schema. Do not include any other text or markdown formatting.
    `;

    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: judgeResponseSchema,
                temperature: 0.0,
            }
        });
        
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        return {
            success: result.success,
            reason: result.reason,
            detail: result.detail || ''
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            success: false,
            reason: "API_ERROR",
            detail: "Failed to communicate with the judging service. Please check the console."
        };
    }
};

const problemSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A concise, snake_case Python function name from the problem title." },
        description: { type: Type.STRING, description: "A one-sentence summary of the problem's goal." },
        tests: { type: Type.STRING, description: "A valid JSON string representing an array of 3-5 test cases. Each object in the array MUST have 'inputs' (an array of arguments) and 'expected' (the return value). Example: '[{\"inputs\": [[1,2,3], 5], \"expected\": true}, {\"inputs\": [[4,5], 2], \"expected\": false}]'" },
        complexity: { type: Type.STRING, description: "The estimated optimal time complexity (e.g., 'O(n)')." },
        template: { type: Type.STRING, description: "A basic Python function template with the generated id as the function name." }
    },
    required: ['id', 'description', 'tests', 'complexity', 'template']
};

const problemsListSchema = {
    type: Type.OBJECT,
    properties: {
        problems: { type: Type.ARRAY, items: problemSchema }
    },
    required: ['problems']
};

const parseAndValidateProblems = (rawProblems) => {
    if (!rawProblems || !Array.isArray(rawProblems) || rawProblems.length === 0) {
        throw new Error("Generated data is missing the 'problems' array or is empty.");
    }

    return rawProblems.map((p) => {
        if (!p.id || !p.description || !p.tests || !p.complexity || !p.template) {
            throw new Error(`A generated problem is missing required fields. Problem ID: ${p.id || 'N/A'}`);
        }
        try {
            const parsedTests = JSON.parse(p.tests);
            if (!Array.isArray(parsedTests)) {
                throw new Error(`Parsed 'tests' for problem '${p.id}' is not an array.`);
            }
            for (const t of parsedTests) {
                if (t.inputs === undefined || t.expected === undefined) {
                    throw new Error(`A test case for problem '${p.id}' is missing 'inputs' or 'expected' keys.`);
                }
            }
            return { ...p, tests: parsedTests };
        } catch (e) {
            console.error(`Failed to parse 'tests' JSON string for problem '${p.id}'. Raw string:`, p.tests);
            throw new Error(`The AI returned malformed JSON for the test cases of problem '${p.id}'.`);
        }
    });
};

const generateProblems = async (count, difficulty) => {
    const prompt = `
        You are an expert programmer and problem designer with extensive knowledge of LeetCode.
        Your task is to generate a structured JSON object containing a list of LeetCode-style programming challenges.

        Instructions:
        - Generate exactly ${count} unique problems.
        - All problems must be of "${difficulty}" difficulty.
        - The problems should be varied and represent common algorithm/data structure topics.
        - For each problem, provide the following fields:
            1.  **id**: A concise, snake_case Python function name (e.g., "two_sum").
            2.  **description**: A one-sentence summary of the problem's goal.
            3.  **tests**: A JSON STRING representing an array of 3-5 diverse and accurate test cases. Each object must have 'inputs' (an array) and 'expected' (the output).
            4.  **complexity**: The expected optimal time complexity (e.g., "O(n)").
            5.  **template**: A basic Python function template with the generated 'id' as the name, correct parameters, and a 'pass' statement.

        Your response MUST be a single, valid JSON object matching the provided schema, containing a 'problems' array. Do not include any other text, comments, or markdown formatting.
    `;
    
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: problemsListSchema,
                temperature: 0.7,
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        return parseAndValidateProblems(result.problems);

    } catch (error) {
        console.error("Gemini API Error during problems generation:", error);
        throw new Error("Failed to generate the set of problems using the AI service. Please try again.");
    }
};

const generateCustomProblems = async (prompts, difficulty) => {
    const problemIdeas = prompts.map(p => `- ${p}`).join('\n');
    const prompt = `
        You are an expert programmer and problem designer with extensive knowledge of LeetCode.
        Your task is to generate a structured JSON object containing a list of LeetCode-style programming challenges based on user-provided ideas.

        Instructions:
        - Generate one problem for each of the following ideas:
        ${problemIdeas}
        - All generated problems must be of "${difficulty}" difficulty.
        - For each problem, provide the following fields:
            1.  **id**: A concise, snake_case Python function name (e.g., "two_sum").
            2.  **description**: A one-sentence summary of the problem's goal.
            3.  **tests**: A JSON STRING representing an array of 3-5 diverse and accurate test cases. Each object must have 'inputs' (an array) and 'expected' (the output).
            4.  **complexity**: The expected optimal time complexity (e.g., "O(n)").
            5.  **template**: A basic Python function template with the generated 'id' as the name, correct parameters, and a 'pass' statement.

        Your response MUST be a single, valid JSON object matching the provided schema, containing a 'problems' array. Do not include any other text, comments, or markdown formatting.
    `;
    
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: problemsListSchema,
                temperature: 0.7,
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        return parseAndValidateProblems(result.problems);

    } catch (error) {
        console.error("Gemini API Error during custom problems generation:", error);
        throw new Error("Failed to generate the set of custom problems using the AI service. Please try again.");
    }
};
// --- End of services/geminiService.ts ---

// --- Start of services/gameService.ts ---
const addLog = (game, message) => {
    const newLogs = [message, ...game.logs.slice(0, 19)];
    return { ...game, logs: newLogs };
};

const DRAIN_PER_TICK = 0.01;
const TICK_INTERVAL_MS = 120;

const applyHPDrain = (game) => {
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

const checkGameOver = (game) => {
    if (game.status !== 'playing') {
        return game;
    }
    const player = game.player;
    let isOver = false;
    let winnerInfo = null;

    if (player.hp <= 0) {
        winnerInfo = { won: false, reason: 'You lost all your HP.' };
        isOver = true;
    } else if (player.currentProblem >= game.problems.length) {
        winnerInfo = { won: true, reason: 'You solved all the problems!' };
        isOver = true;
    }
    
    return isOver ? { ...game, status: 'over', winnerInfo } : game;
};

const initializeGame = (problems) => {
    const player = {
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

const submitSolution = async (game) => {
    if (game.status !== 'playing' || game.player.isSubmitting) return game;

    const problem = game.problems[game.player.currentProblem];
    if (!problem) return game;
    
    let gameAfterDrain = applyHPDrain(game);
    let player = gameAfterDrain.player;
    
    const result = await checkSolution(player.code, problem);
    
    let updatedGame = applyHPDrain(gameAfterDrain);
    let currentPlayer = updatedGame.player;

    if (result.success) {
        const regain = HP_REGAIN[problem.complexity] || 5;
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

const generateGameId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const getGameRef = (gameId) => ref(db, `games/${gameId}`);

const addLogMultiplayer = (game, message) => {
    const newLogs = [message, ...(game.logs || []).slice(0, 19)];
    return { ...game, logs: newLogs };
}

const createGame = async (count, difficulty, prompts) => {
    const problems = prompts && prompts.length > 0
        ? await generateCustomProblems(prompts, difficulty)
        : await generateProblems(count, difficulty);

    if (!problems || problems.length === 0) throw new Error("Failed to generate problems.");

    const gameId = generateGameId();
    const playerId = 'playerA';
    
    const player = {
        name: 'Player A',
        hp: 100,
        currentProblem: 0,
        code: problems[0].template,
        isSubmitting: false,
    };

    const game = {
        id: gameId,
        players: { [playerId]: player },
        problems,
        status: 'waiting',
        logs: [`Game ${gameId} created. Waiting for opponent...`],
    };
    
    await set(getGameRef(gameId), game);
    return { game, playerId };
};

const joinGame = async (gameId) => {
  const id = (gameId || "").trim();
  const gameRef = ref(db, `games/${id}`);
  try {
    const preSnap = await get(gameRef);
    if (!preSnap.exists()) {
      throw new Error("Game not found.");
    }

    const result = await runTransaction(
      gameRef,
      (currentGame) => {
        if (!currentGame) return currentGame; // not found → abort
        if (!currentGame.players || !currentGame.players.playerA) return; // invalid lobby → abort
        if (currentGame.players.playerB) {
        //    already taken by someone else → but backfill missing name
        if (!currentGame.players.playerB.name) {
            currentGame.players.playerB.name = 'Player B';
            currentGame.logs = Array.isArray(currentGame.logs) ? currentGame.logs : [];
            currentGame.logs.unshift('Filled missing Player B name.');
        }
        return currentGame; // commit with possible backfill
        }

        const playerB = {
          id: 'playerB',
           name: 'Player B', 
          hp: 100,
          currentProblem: 0,
          code: currentGame.problems[0].template,
          isSubmitting: false,
        };
        currentGame.players.playerB = playerB;
        currentGame.status = 'playing';
        currentGame.lastTickTime = Date.now();
        currentGame.logs = Array.isArray(currentGame.logs) ? currentGame.logs : [];
        currentGame.logs.unshift('Player B joined. The clash begins!');
        return currentGame; // commit
      },
      { applyLocally: false }
    );

    if (!result.committed || !result.snapshot.exists()) {
      const gameSnapshot = await get(gameRef);
      if (!gameSnapshot.exists()) throw new Error("Game not found.");
      if (gameSnapshot.val()?.players?.playerB) throw new Error("Game is full.");
      throw new Error("Failed to join the game. Please try again.");
    }

    return { game: result.snapshot.val(), playerId: 'playerB' };
  } catch (error) {
    console.error("Join Game Transaction error:", error);
    if (error.message.includes("full") || error.message.includes("not found")) {
      throw error;
    }
    throw new Error("An error occurred while trying to join the game.");
  }
};;

const onGameUpdate = (gameId, callback) => {
    const gameRef = getGameRef(gameId);
    const listener = onValue(gameRef, (snapshot) => {
        callback(snapshot.val());
    });
    return () => off(gameRef, 'value', listener);
};

const updateCode = (gameId, playerId, code) => {
    const codeRef = ref(db, `games/${gameId}/players/${playerId}/code`);
    set(codeRef, code);
};

const applyHPDrainMultiplayer = (game) => {
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

const checkGameOverMultiplayer = (game) => {
    if (game.status !== 'playing') return game;

    const pA = game.players.playerA;
    const pB = game.players.playerB;
    let winnerInfo = undefined;

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

const tickMultiplayerGame = (gameId) => {
    const gameRef = getGameRef(gameId);
    runTransaction(gameRef, (currentGame) => {
        if (currentGame && currentGame.status === 'playing') {
            const drainedGame = applyHPDrainMultiplayer(currentGame);
            return checkGameOverMultiplayer(drainedGame);
        }
        return currentGame;h.getTitle
    });
};

const submitSolutionMultiplayer = async (gameId, playerId) => {
    const gameRef = getGameRef(gameId);
    const gameSnapshot = await get(gameRef);
    if (!gameSnapshot.exists()) return;
    
    let game = gameSnapshot.val();
    const player = game.players[playerId];
    
    if (!player || player.isSubmitting || game.status !== 'playing') return;

    const problem = game.problems[player.currentProblem];
    if (!problem) return;

    await runTransaction(gameRef, (currentGame) => {
        if (currentGame && currentGame.players[playerId]) {
            currentGame.players[playerId].isSubmitting = true;
        }
        return currentGame;
    });

    const result = await checkSolution(player.code, problem);
    
    await runTransaction(gameRef, (finalGame) => {
        if (!finalGame) return;
        
        finalGame = applyHPDrainMultiplayer(finalGame);
        
        const finalPlayer = finalGame.players[playerId];
        if (!finalPlayer) return;

        if (result.success) {
            const regain = HP_REGAIN[problem.complexity] || 5;
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
// --- End of services/gameService.ts ---

// --- Start of components/icons.tsx ---
const h = React.createElement;

const SwordsIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-8 h-8 text-cyan-400" }, h('path', { d: "M14.5 17.5 3 6l3-3 11.5 11.5" }), h('path', { d: "m18 2-6 6" }), h('path', { d: "m21 5-6 6" }), h('path', { d: "M9.5 17.5 21 6l-3-3L6.5 14.5" }));
const BrainCircuitIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-5 h-5" }, h('path', { d: "M12 5a3 3 0 1 0-5.993.142" }), h('path', { d: "M18 13a3 3 0 1 0-5.993.142" }), h('path', { d: "M12 21a3 3 0 1 0-5.993-.142" }), h('path', { d: "M18 5a3 3 0 1 0-5.993.142" }), h('path', { d: "M12 13a3 3 0 1 0-5.993.142" }), h('path', { d: "M6 5a3 3 0 1 0-5.993.142" }), h('path', { d: "M6 13a3 3 0 1 0-5.993.142" }), h('path', { d: "M18 21a3 3 0 1 0-5.993-.142" }), h('path', { d: "M6 21a3 3 0 1 0-5.993-.142" }), h('path', { d: "M9 8V7" }), h('path', { d: "M9 16v-1" }), h('path', { d: "M15 8V7" }), h('path', { d: "M15 16v-1" }), h('path', { d: "M12 16v-1" }), h('path', { d: "M12 8V7" }), h('path', { d: "m14.007 6.858-1 .142" }), h('path', { d: "m8.007 14.858-1 .142" }), h('path', { d: "m8.007 6.858-1 .142" }), h('path', { d: "m14.007 14.858-1 .142" }), h('path', { d: "m21 8-1-1" }), h('path', { d: "m21 16-1-1" }), h('path', { d: "m3 8 1-1" }), h('path', { d: "m3 16 1-1" }), h('path', { d: "m9 20-1-1" }), h('path', { d: "m15 20-1-1" }), h('path', { d: "m9 12-1-1" }), h('path', { d: "m15 12-1-1" }));
const ComplexityIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-5 h-5" }, h('path', { d: "M16 16.42A5.5 5.5 0 0 0 12 6c-3.04 0-5.5 2.46-5.5 5.5 0 1.28.43 2.45 1.18 3.38" }), h('path', { d: "M12 22v-4" }), h('path', { d: "M21 12h-4" }), h('path', { d: "M3 12H1" }), h('path', { d: "M12 6V2" }), h('path', { d: "m4.93 4.93-.71.71" }), h('path', { d: "m19.07 4.93-.71-.71" }), h('path', { d: "m4.93 19.07-.71-.71" }));
const CodeIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-5 h-5" }, h('polyline', { points: "16 18 22 12 16 6" }), h('polyline', { points: "8 6 2 12 8 18" }));
const LogIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-5 h-5" }, h('path', { d: "M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" }), h('line', { x1: "8", y1: "6", x2: "16", y2: "6" }), h('line', { x1: "8", y1: "10", x2: "16", y2: "10" }), h('line', { x1: "8", y1: "14", x2: "12", y2: "14" }));
const TrophyIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-full h-full" }, h('path', { d: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6" }), h('path', { d: "M18 9h1.5a2.5 2.5 0 0 0 0-5H18" }), h('path', { d: "M4 22h16" }), h('path', { d: "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" }), h('path', { d: "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" }), h('path', { d: "M18 2H6v7a6 6 0 0 0 12 0V2Z" }));
const SkullIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-full h-full" }, h('circle', { cx: "9", cy: "12", r: "1" }), h('circle', { cx: "15", cy: "12", r: "1" }), h('path', { d: "M8 20v2h8v-2" }), h('path', { d: "m12.5 17-.5-1-.5 1h1z" }), h('path', { d: "M16 20a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2" }), h('path', { d: "M16 4.47A10 10 0 0 0 12 2 10 10 0 0 0 8 4.47" }), h('path', { d: "M18.84 10.14a10.01 10.01 0 0 1-13.68 0" }), h('path', { d: "M12 2a10 10 0 0 1 8.84 14.14" }), h('path', { d: "M3.16 16.14A10 10 0 0 1 12 2" }));
const WandSparklesIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-5 h-5" }, h('path', { d: "m22 2-7 20-4-4-20-7Z" }), h('path', { d: "M6 18h.01" }), h('path', { d: "m2 2 3 3" }), h('path', { d: "M14 8h.01" }), h('path', { d: "M18 6h.01" }));
const PencilIcon = () => h('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "w-5 h-5" }, h('path', { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }), h('path', { d: "m15 5 4 4" }));
// --- End of components/icons.tsx ---

// --- Start of components/PlayerView.tsx ---
const PlayerProgressBar = ({ value }) => {
    const healthBarGradient = 'linear-gradient(to right, #ef4444, #fde047 40%, #22c55e 60%)';
    return h('div', { className: "w-full bg-gray-700 rounded-full h-6 border-2 border-gray-600 overflow-hidden" },
        h('div', {
            className: "h-full rounded-full transition-all duration-500 ease-out flex items-center justify-center",
            style: { width: `${Math.max(0, value)}%`, backgroundImage: healthBarGradient }
        }, h('span', { className: "font-bold text-sm text-white text-shadow-sm" }, `${value.toFixed(2)} HP`))
    );
};

const PlayerView = ({ player, problem, onCodeChange, onSubmit }) => {
    return h('div', { className: "bg-gray-800 border border-cyan-500/30 rounded-lg p-6 shadow-2xl shadow-cyan-500/10 flex flex-col gap-4 h-full" },
        h('div', { className: "flex justify-between items-center" },
            h('h2', { className: "text-2xl font-bold text-cyan-400" }, player.name),
            h(PlayerProgressBar, { value: player.hp })
        ),
        problem ? h(React.Fragment, null,
            h('div', { className: "bg-gray-900 p-4 rounded-md border border-gray-700" },
                h('div', { className: "flex items-center gap-2 mb-2 text-lg font-semibold text-gray-300" },
                    h(BrainCircuitIcon), ` Problem ${player.currentProblem + 1}: ${problem.id}`
                ),
                h('p', { className: "text-gray-400" }, problem.description),
                h('div', { className: "flex items-center gap-2 mt-3 text-sm text-gray-500" },
                    h(ComplexityIcon),
                    h('span', null, "Complexity Bonus: ", h('span', { className: "font-mono text-yellow-400" }, problem.complexity))
                )
            ),
            h('div', { className: "flex-grow flex flex-col" },
                h('label', { htmlFor: `code-${player.name}`, className: "flex items-center gap-2 mb-2 text-gray-400" },
                    h(CodeIcon),
                    h('span', null, "Solution")
                ),
                h('textarea', {
                    id: `code-${player.name}`,
                    value: player.code,
                    onChange: (e) => onCodeChange(e.target.value),
                    className: "w-full flex-grow bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-4 font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none",
                    placeholder: "Write your function here...",
                    spellCheck: "false",
                    disabled: player.isSubmitting
                })
            ),
            h('button', {
                onClick: onSubmit,
                disabled: player.isSubmitting,
                className: "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            }, player.isSubmitting ? h(React.Fragment, null,
                h('svg', { className: "animate-spin h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" },
                    h('circle', { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
                    h('path', { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
                ),
                "Judging..."
            ) : 'Submit Solution')
        ) : h('div', { className: "text-center py-20 bg-gray-900 rounded-lg" },
            h('h3', { className: "text-2xl font-bold text-green-400" }, "🎉 All Problems Completed! 🎉")
        )
    );
};
// --- End of components/PlayerView.tsx ---

// --- Start of components/OpponentView.tsx ---
const OpponentProgressBar = ({ value }) => {
    const healthBarGradient = 'linear-gradient(to right, #ef4444, #fde047 40%, #22c55e 60%)';
    return h('div', { className: "w-full bg-gray-700 rounded-full h-6 border-2 border-gray-600 overflow-hidden" },
        h('div', {
            className: "h-full rounded-full transition-all duration-500 ease-out flex items-center justify-center",
            style: { width: `${Math.max(0, value)}%`, backgroundImage: healthBarGradient }
        }, h('span', { className: "font-bold text-sm text-white text-shadow-sm" }, `${value.toFixed(2)} HP`))
    );
};

const OpponentView = ({ opponent, totalProblems }) => {
    return h('div', { className: "bg-gray-800 border border-cyan-500/30 rounded-lg p-6 shadow-2xl shadow-cyan-500/10 flex flex-col gap-4" },
        h('div', { className: "flex justify-between items-center" },
            h('h2', { className: "text-2xl font-bold text-gray-400" }, opponent.name)
        ),
        h(OpponentProgressBar, { value: opponent.hp }),
        h('div', { className: "bg-gray-900 p-4 rounded-md border border-gray-700" },
            h('div', { className: "flex items-center gap-2 text-lg font-semibold text-gray-300" },
                h(BrainCircuitIcon), " Progress"
            ),
            h('p', { className: "text-gray-400 mt-2" },
                "Solved ", h('span', { className: "text-cyan-400 font-bold" }, opponent.currentProblem), ` / ${totalProblems} problems`
            ),
            h('div', { className: "w-full bg-gray-700 rounded-full h-2.5 mt-3" },
                h('div', { className: "bg-cyan-600 h-2.5 rounded-full", style: { width: `${(opponent.currentProblem / totalProblems) * 100}%` } })
            )
        )
    );
};
// --- End of components/OpponentView.tsx ---

// --- Start of components/GameLog.tsx ---
const GameLog = ({ logs }) => {
    return h('div', { className: "mt-8 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg" },
        h('h3', { className: "text-lg font-semibold text-gray-300 mb-3 flex items-center gap-2" },
            h(LogIcon), " Game Log"
        ),
        h('div', { className: "h-40 overflow-y-auto bg-gray-900 rounded-md p-3 flex flex-col-reverse" },
            h('ul', null,
                logs.map((log, index) => h('li', { key: index, className: "text-sm text-gray-400 font-mono py-1 border-b border-gray-800" },
                    log.startsWith('✅') ? h('span', { className: "text-green-400" }, log) :
                    log.startsWith('❌') ? h('span', { className: "text-red-400" }, log) :
                    log
                ))
            )
        )
    );
};
// --- End of components/GameLog.tsx ---

// --- Start of components/GameOverModal.tsx ---
const GameOverModal = ({ gameStatus, onReset }) => {
    const { winner, winnerName, reason } = gameStatus;

    const getIcon = () => {
        if (winner === 'draw' || winnerName === 'Game Over') return h(SkullIcon);
        if (reason.includes('lost all HP')) return h(SkullIcon);
        return h(TrophyIcon);
    };

    const getTitle = () => {
        if (winner === 'draw') return "It's a Draw!";
        return `${winnerName} Wins!`;
    }

    return h('div', { className: "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" },
        h('div', { className: "bg-gray-800 rounded-xl border border-cyan-500/50 shadow-2xl shadow-cyan-500/20 w-full max-w-md text-center p-8" },
            h('div', { className: "text-7xl mx-auto mb-4 text-yellow-400 w-20 h-20 flex items-center justify-center" }, getIcon()),
            h('h2', { className: "text-4xl font-extrabold text-cyan-400 mb-2" }, getTitle()),
            h('p', { className: "text-gray-300 text-lg mb-8" }, reason),
            h('button', {
                onClick: onReset,
                className: "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105"
            }, "Play Again")
        )
    );
};
// --- End of components/GameOverModal.tsx ---

// --- Start of components/MainMenu.tsx ---
const MainMenu = ({ onStartGame }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
    const [selectedCount, setSelectedCount] = useState(3);
    const [activeTab, setActiveTab] = useState('random');
    const [customPrompts, setCustomPrompts] = useState('');
    
    const difficulties = ['Easy', 'Medium', 'Hard'];
    const problemCounts = [3, 5, 7];

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const generatedProblems = await generateProblems(selectedCount, selectedDifficulty);
            if (!generatedProblems || generatedProblems.length === 0) {
                throw new Error("The AI failed to generate any problems.");
            }
            onStartGame(generatedProblems);
        } catch (err) {
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
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to generate custom problems. Please try again.');
            setIsLoading(false);
        }
    };

    return h('div', { className: "min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4" },
        h('div', { className: "w-full max-w-lg mx-auto bg-gray-800 border border-cyan-500/30 rounded-lg p-8 shadow-2xl text-center" },
            h('h1', { className: "text-5xl font-bold text-cyan-400 mb-2" }, "Welcome to LeetClash"),
            h('p', { className: "text-gray-400 mb-8" }, "Choose your challenge and start the duel!"),
            h('div', { className: "mb-6" },
                h('div', { className: "flex bg-gray-900 rounded-lg p-1" },
                    h('button', { onClick: () => setActiveTab('random'), className: `w-1/2 py-2 rounded-md font-bold transition-colors ${activeTab === 'random' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}` }, "Random Clash"),
                    h('button', { onClick: () => setActiveTab('custom'), className: `w-1/2 py-2 rounded-md font-bold transition-colors ${activeTab === 'custom' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}` }, "Custom Clash")
                )
            ),
            activeTab === 'random' ? h('div', { className: "space-y-6" },
                h('div', null,
                    h('label', { className: "block text-lg font-medium text-gray-300 mb-2" }, "Difficulty"),
                    h('div', { className: "grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1" },
                        difficulties.map(d => h('button', { key: d, onClick: () => setSelectedDifficulty(d), className: `px-4 py-2 text-sm font-bold rounded-md transition-colors ${selectedDifficulty === d ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}` }, d))
                    )
                ),
                h('div', null,
                    h('label', { className: "block text-lg font-medium text-gray-300 mb-2" }, "Number of Problems"),
                    h('div', { className: "grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1" },
                        problemCounts.map(c => h('button', { key: c, onClick: () => setSelectedCount(c), className: `px-4 py-2 text-sm font-bold rounded-md transition-colors ${selectedCount === c ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}` }, `${c} Problems`))
                    )
                )
            ) : h('div', { className: "space-y-6" },
                h('div', null,
                    h('label', { className: "block text-lg font-medium text-gray-300 mb-2" }, "Difficulty"),
                    h('div', { className: "grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1" },
                        difficulties.map(d => h('button', { key: d, onClick: () => setSelectedDifficulty(d), className: `px-4 py-2 text-sm font-bold rounded-md transition-colors ${selectedDifficulty === d ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}` }, d))
                    )
                ),
                h('div', null,
                    h('label', { htmlFor: "custom-prompts", className: "block text-lg font-medium text-gray-300 mb-2" }, "Problem Ideas"),
                    h('textarea', { id: "custom-prompts", rows: 4, value: customPrompts, onChange: (e) => setCustomPrompts(e.target.value), className: "w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y", placeholder: "e.g., Check if a string is a palindrome\ne.g., Find the maximum value in an array" })
                )
            ),
            h('div', { className: "mt-10" },
                h('button', { onClick: activeTab === 'random' ? handleGenerate : handleCustomGenerate, disabled: isLoading, className: "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-105" },
                    isLoading ? h(React.Fragment, null,
                        h('svg', { className: "animate-spin h-6 w-6 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }, h('circle', { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), h('path', { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })),
                        "Generating Clash..."
                    ) : (activeTab === 'random' ? h(React.Fragment, null, h(WandSparklesIcon), " Start Random Clash ") : h(React.Fragment, null, h(PencilIcon), " Start Custom Clash "))
                )
            ),
            error && h('p', { className: "text-red-400 text-center mt-4" }, error)
        )
    );
};
// --- End of components/MainMenu.tsx ---

// --- Start of components/Lobby.tsx ---
const Lobby = ({ onGameReady }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('create');
    const [createTab, setCreateTab] = useState('random');
    const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
    const [selectedCount, setSelectedCount] = useState(3);
    const [customPrompts, setCustomPrompts] = useState('');
    const [joinGameId, setJoinGameId] = useState('');

    const difficulties = ['Easy', 'Medium', 'Hard'];
    const problemCounts = [3, 5, 7];

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
            const { game, playerId } = await createGame(selectedCount, selectedDifficulty, createTab === 'custom' ? prompts : undefined);
            onGameReady(game, playerId);
        } catch (err) {
            setError(err.message || 'Failed to create game. Please try again.');
            setIsLoading(false);
        }
    };
    
    const handleJoinGame = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { game, playerId } = await joinGame((joinGameId || "").trim());
            onGameReady(game, playerId);
        } catch (err) {
            setError(err.message || 'Failed to join game. Check the ID and try again.');
            setIsLoading(false);
        }
    };
    
    return h('div', { className: "min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4" },
        h('div', { className: "w-full max-w-lg mx-auto bg-gray-800 border border-cyan-500/30 rounded-lg p-8 shadow-2xl" },
            h('h1', { className: "text-5xl font-bold text-cyan-400 mb-2 text-center" }, "Welcome to LeetClash"),
            h('p', { className: "text-gray-400 mb-8 text-center" }, "Choose your challenge and start the duel!"),
            h('div', { className: "flex bg-gray-900 rounded-lg p-1 mb-6" },
                h('button', { onClick: () => setActiveTab('create'), className: `w-1/2 py-2 rounded-md font-bold transition-colors ${activeTab === 'create' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}` }, "Create Game"),
                h('button', { onClick: () => setActiveTab('join'), className: `w-1/2 py-2 rounded-md font-bold transition-colors ${activeTab === 'join' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-gray-700'}` }, "Join Game")
            ),
            activeTab === 'create' && h(React.Fragment, null,
                h('div', { className: "flex bg-gray-700 rounded-lg p-1 mb-6" },
                    h('button', { onClick: () => setCreateTab('random'), className: `w-1/2 py-2 rounded-md font-bold text-sm transition-colors ${createTab === 'random' ? 'bg-cyan-700 text-white' : 'text-gray-300 hover:bg-gray-600'}` }, "Random Clash"),
                    h('button', { onClick: () => setCreateTab('custom'), className: `w-1/2 py-2 rounded-md font-bold text-sm transition-colors ${createTab === 'custom' ? 'bg-cyan-700 text-white' : 'text-gray-300 hover:bg-gray-600'}` }, "Custom Clash")
                ),
                h('div', { className: "space-y-6" },
                    h('div', null,
                        h('label', { className: "block text-lg font-medium text-gray-300 mb-2" }, "Difficulty"),
                        h('div', { className: "grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1" },
                            difficulties.map(d => h('button', { key: d, onClick: () => setSelectedDifficulty(d), className: `px-4 py-2 text-sm font-bold rounded-md transition-colors ${selectedDifficulty === d ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}` }, d))
                        )
                    ),
                    createTab === 'random' ? h('div', null,
                        h('label', { className: "block text-lg font-medium text-gray-300 mb-2" }, "Number of Problems"),
                        h('div', { className: "grid grid-cols-3 gap-2 rounded-lg bg-gray-900 p-1" },
                            problemCounts.map(c => h('button', { key: c, onClick: () => setSelectedCount(c), className: `px-4 py-2 text-sm font-bold rounded-md transition-colors ${selectedCount === c ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}` }, `${c} Problems`))
                        )
                    ) : h('div', null,
                        h('label', { htmlFor: "custom-prompts-lobby", className: "block text-lg font-medium text-gray-300 mb-2" }, "Problem Ideas"),
                        h('textarea', { id: "custom-prompts-lobby", rows: 3, value: customPrompts, onChange: (e) => setCustomPrompts(e.target.value), className: "w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-3 font-mono text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y", placeholder: "e.g., Check if a string is a palindrome\ne.g., Find the maximum value in an array" })
                    )
                ),
                h('div', { className: "mt-8" },
                    h('button', { onClick: handleCreateGame, disabled: isLoading, className: "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-105" },
                        isLoading ? h(React.Fragment, null, h('svg', { className: "animate-spin h-6 w-6 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }, h('circle', { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), h('path', { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })), "Creating Game...")
                        : (createTab === 'random' ? h(React.Fragment, null, h(WandSparklesIcon), " Create Random Clash") : h(React.Fragment, null, h(PencilIcon), " Create Custom Clash"))
                    )
                )
            ),
            activeTab === 'join' && h('div', { className: "space-y-6" },
                h('div', null,
                    h('label', { htmlFor: "game-id", className: "block text-lg font-medium text-gray-300 mb-2" }, "Game ID"),
                    h('input', { id: "game-id", type: "text", value: joinGameId, onChange: (e) => setJoinGameId(e.target.value), className: "w-full bg-gray-900 text-gray-200 border border-gray-600 rounded-md p-4 font-mono text-2xl tracking-widest text-center uppercase focus:ring-2 focus:ring-cyan-500 focus:outline-none", placeholder: "ABC123", maxLength: 6 })
                ),
                h('button', { onClick: handleJoinGame, disabled: isLoading || !joinGameId, className: "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105" },
                    isLoading ? h(React.Fragment, null, h('svg', { className: "animate-spin h-6 w-6 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" }, h('circle', { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), h('path', { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })), "Joining...") : "Join Clash"
                )
            ),
            error && h('p', { className: "text-red-400 text-center mt-4" }, error)
        )
    );
};
// --- End of components/Lobby.tsx ---

// --- Start of App.tsx ---
const SinglePlayerGameView = ({ onExit }) => {
    const [game, setGame] = useState(null);

    useEffect(() => {
        if (game?.status === 'playing') {
            const interval = setInterval(() => {
                setGame(currentGame => {
                    if (!currentGame || currentGame.status !== 'playing') {
                        clearInterval(interval);
                        return currentGame;
                    }
                    let updatedGame = applyHPDrain(currentGame);
                    updatedGame = checkGameOver(updatedGame);
                    return updatedGame;
                });
            }, 120);
            return () => clearInterval(interval);
        }
    }, [game?.status]);

    const handleStartGame = (problems) => {
        setGame(initializeGame(problems));
    };

    const handleCodeChange = (code) => {
        if (game) {
            setGame({ ...game, player: { ...game.player, code } });
        }
    };

    const handleSubmit = async () => {
        if (!game || game.player.isSubmitting) return;
        setGame({ ...game, player: { ...game.player, isSubmitting: true } });
        const updatedGame = await submitSolution(game);
        setGame(updatedGame);
    };

    const resetGame = () => setGame(null);

    if (!game) {
        return h(MainMenu, { onStartGame: handleStartGame });
    }

    const { player, problems, logs, status, winnerInfo } = game;

    const gameOverStatus = winnerInfo ? {
        status: 'over',
        winner: winnerInfo.won ? 'playerA' : 'draw',
        winnerName: winnerInfo.won ? 'You' : 'Game Over',
        reason: winnerInfo.reason,
    } : null;

    return h('div', { className: "min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8" },
        h('div', { className: "max-w-7xl mx-auto" },
            h('header', { className: "text-center mb-8" },
                h('h1', { className: "text-4xl sm:text-5xl font-bold text-cyan-400 tracking-wider flex items-center justify-center gap-4" },
                    h(SwordsIcon), " LeetClash ", h(SwordsIcon)
                ),
                h('p', { className: "text-gray-400 mt-2" }, "Code Alone Challenge")
            ),
            h('main', { className: "grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" },
                h('div', { className: "lg:col-span-2" },
                    h(PlayerView, { player: player, problem: problems[player.currentProblem], onCodeChange: handleCodeChange, onSubmit: handleSubmit })
                ),
                h('div', { className: "flex flex-col gap-8" },
                    h('div', { className: "bg-gray-800 border border-cyan-500/30 rounded-lg p-6 shadow-2xl text-center" },
                        h('h3', { className: "text-xl font-bold text-gray-400" }, "Game Mode: Solo"),
                        h('p', { className: "text-gray-500 mt-2" }, "Focus and defeat the clock!")
                    ),
                    h(GameLog, { logs: logs })
                )
            ),
            status === 'over' && gameOverStatus && h(GameOverModal, { gameStatus: gameOverStatus, onReset: resetGame }),
            h('button', { onClick: onExit, className: "mt-8 mx-auto block text-cyan-400 hover:text-cyan-300" }, "Back to Main Menu")
        )
    );
};

const MultiplayerGameView = ({ onExit }) => {
    const [gameId, setGameId] = useState(null);
    const [playerId, setPlayerId] = useState(null);
    const [game, setGame] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!gameId) return;
        const handleGameUpdate = (newGame) => {
            if (newGame) {
                setGame(newGame);
                setError(null);
            } else {
                setError("Game not found. It may have been deleted or the ID is incorrect.");
                setGameId(null); 
                setPlayerId(null);
                setGame(null);
            }
        };
        const unsubscribe = onGameUpdate(gameId, handleGameUpdate);
        return () => unsubscribe();
    }, [gameId]);

    useEffect(() => {
        if (game?.status === 'playing' && gameId && playerId === 'playerA') {
            const interval = setInterval(() => {
                tickMultiplayerGame(gameId);
            }, 120);
            return () => clearInterval(interval);
        }
    }, [game?.status, gameId, playerId]);

    const handleGameReady = (newGame, joinedPlayerId) => {
        setGame(newGame);
        setGameId(newGame.id);
        setPlayerId(joinedPlayerId);
        setError(null);
    };
    
    const handleCodeChange = (code) => {
        if (game && playerId && game.players[playerId]) {
            const updatedGame = {
                ...game,
                players: { ...game.players, [playerId]: { ...game.players[playerId], code: code } }
            };
            setGame(updatedGame);
            updateCode(game.id, playerId, code);
        }
    };

    const handleSubmit = () => {
        if (gameId && playerId) {
            submitSolutionMultiplayer(gameId, playerId);
        }
    };

    const resetGame = () => {
        setGameId(null);
        setPlayerId(null);
        setGame(null);
        setError(null);
        onExit();
    };

    if (!game || !playerId) {
        return h(Lobby, { onGameReady: handleGameReady });
    }

    const me = game.players[playerId];
    const opponentId = playerId === 'playerA' ? 'playerB' : 'playerA';
    const opponent = game.players[opponentId];

    return h('div', { className: "min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8" },
        h('div', { className: "max-w-7xl mx-auto" },
            h('header', { className: "text-center mb-8" },
                h('h1', { className: "text-4xl sm:text-5xl font-bold text-cyan-400 tracking-wider flex items-center justify-center gap-4" },
                    h(SwordsIcon), " LeetClash ", h(SwordsIcon)
                ),
                h('p', { className: "text-gray-400 mt-2" }, "The Ultimate Coding Duel")
            ),
            game.status === 'waiting' && h('div', { className: "text-center p-8 bg-gray-800 rounded-lg shadow-xl" },
                h('h2', { className: "text-3xl font-bold text-yellow-400 mb-4 animate-pulse" }, "Waiting for Opponent..."),
                h('p', { className: "text-gray-400 mb-2" }, "Share this Game ID with your friend:"),
                h('div', { className: "bg-gray-900 border-2 border-dashed border-cyan-500 rounded-lg p-4 max-w-sm mx-auto" },
                    h('p', { className: "text-2xl font-mono text-white tracking-widest" }, game.id)
                )
            ),
            game.status !== 'waiting' && me && h('main', { className: "grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" },
                h('div', { className: "lg:col-span-2" },
                    h(PlayerView, { player: me, problem: game.problems[me.currentProblem], onCodeChange: handleCodeChange, onSubmit: handleSubmit })
                ),
                h('div', { className: "flex flex-col gap-8" },
                    opponent ? h(OpponentView, { opponent: opponent, totalProblems: game.problems.length }) : h('div', { className: "bg-gray-800 border border-cyan-500/30 rounded-lg p-6 shadow-2xl text-center" }, h('p', { className: "text-gray-400" }, "Waiting for opponent...")),
                    h(GameLog, { logs: game.logs })
                )
            ),
            game.status === 'over' && game.winnerInfo && h(GameOverModal, { gameStatus: { status: 'over', ...game.winnerInfo }, onReset: resetGame }),
            error && h('p', { className: "text-red-400 text-center mt-4 animate-pulse" }, error)
        )
    );
};

const App = () => {
    const [gameMode, setGameMode] = useState('menu');
    const handleExit = () => setGameMode('menu');

    if (gameMode === 'single') {
        return h(SinglePlayerGameView, { onExit: handleExit });
    }
    if (gameMode === 'multi') {
        return h(MultiplayerGameView, { onExit: handleExit });
    }

    return h('div', { className: "min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4" },
        h('div', { className: "w-full max-w-md mx-auto bg-gray-800 border border-cyan-500/30 rounded-lg p-8 shadow-2xl text-center" },
            h('h1', { className: "text-5xl font-bold text-cyan-400 mb-2 flex items-center justify-center gap-4" }, h(SwordsIcon), "LeetClash"),
            h('p', { className: "text-gray-400 mb-10" }, "Select Your Game Mode"),
            h('div', { className: "space-y-4" },
                h('button', { onClick: () => setGameMode('single'), className: "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all transform hover:scale-105" }, "Single Player"),
                h('button', { onClick: () => setGameMode('multi'), className: "w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all transform hover:scale-105" }, "Multiplayer")
            )
        )
    );
};
// --- End of App.tsx ---

// --- Start of index.tsx ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(h(React.StrictMode, null, h(App)));
// --- End of index.tsx ---