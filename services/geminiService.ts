import { GoogleGenAI, Type } from "@google/genai";
import { Problem, JudgeResult } from '../types';

const getAI = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const judgeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    success: {
      type: Type.BOOLEAN,
      description: "Whether the code passed all tests."
    },
    reason: {
      type: Type.STRING,
      description: "A short code for the outcome, e.g., 'PASSED', 'WRONG_ANSWER', 'ERROR'."
    },
    detail: {
      type: Type.STRING,
      description: "A detailed explanation of the failure or error, if any."
    }
  },
  required: ['success', 'reason']
};

export const checkSolution = async (code: string, problem: Problem): Promise<JudgeResult> => {
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
        id: { 
            type: Type.STRING, 
            description: "A concise, snake_case Python function name from the problem title." 
        },
        description: { 
            type: Type.STRING, 
            description: "A one-sentence summary of the problem's goal." 
        },
        tests: { 
            type: Type.STRING, 
            description: "A valid JSON string representing an array of 3-5 test cases. Each object in the array MUST have 'inputs' (an array of arguments) and 'expected' (the return value). Example: '[{\"inputs\": [[1,2,3], 5], \"expected\": true}, {\"inputs\": [[4,5], 2], \"expected\": false}]'"
        },
        complexity: { 
            type: Type.STRING, 
            description: "The estimated optimal time complexity (e.g., 'O(n)')." 
        },
        template: { 
            type: Type.STRING, 
            description: "A basic Python function template with the generated id as the function name." 
        }
    },
    required: ['id', 'description', 'tests', 'complexity', 'template']
};

const problemsListSchema = {
    type: Type.OBJECT,
    properties: {
        problems: {
            type: Type.ARRAY,
            items: problemSchema
        }
    },
    required: ['problems']
};

const parseAndValidateProblems = (rawProblems: any[]): Problem[] => {
    if (!rawProblems || !Array.isArray(rawProblems) || rawProblems.length === 0) {
        throw new Error("Generated data is missing the 'problems' array or is empty.");
    }

    return rawProblems.map((p: any) => {
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


export const generateProblems = async (count: number, difficulty: string): Promise<Problem[]> => {
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

export const generateCustomProblems = async (prompts: string[], difficulty: string): Promise<Problem[]> => {
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