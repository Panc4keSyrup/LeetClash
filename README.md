<div align="center">
<img width="150" height="150" alt="LeetClash Logo" src="https://raw.githubusercontent.com/Panc4keSyrup/LeetClash/master/assets/logo.png" />



<div style="background: linear-gradient(45deg, #FF5733, #FFC300); padding: 2px; border-radius: 10px; margin: 20px 0;">
  <h1 align="center" style="color: white; margin: 0; padding: 10px;">
    LeetClash
  </h1>
</div>

[![Built with React](https://img.shields.io/badge/Built%20with-React-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Powered by Firebase](https://img.shields.io/badge/Powered%20by-Firebase-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![AI by Gemini](https://img.shields.io/badge/AI%20by-Gemini-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

<h3 align="center" style="color: #FF5733; margin: 25px 0;">
  🏰 The Ultimate Coding Battle Arena ⚔️
</h3>

<p align="center" style="font-style: italic; font-size: 1.2em; color: #666; margin-bottom: 30px; max-width: 600px;">
  Challenge yourself or duel with other programmers in an epic battle of code, where time is your enemy and efficiency is your sword!
</p>

</div>

---

## Features

### Game Modes
- **Single Player**: Challenge yourself against AI-generated coding problems
- **Multiplayer**: Engage in real-time coding duels with other players

### Core Mechanics
- **HP System**: Players start with 100 HP that gradually drains over time
- **Problem Solving**: Successfully solve coding problems to regain HP:
  - O(1) solutions: +25 HP
  - O(log n) solutions: +20 HP
  - O(n) solutions: +15 HP
  - O(n log n) solutions: +10 HP
  - O(n^2) solutions: +5 HP
  - O(n^3) solutions: +2 HP

### Problem Generation
- AI-powered problem generation using Gemini 2.5
- Multiple difficulty levels: Easy, Medium, Hard
- Customizable problem count: 3, 5, or 7 problems per match
- Custom problem prompts supported

### Real-time Features
- Live code synchronization
- Real-time HP tracking
- Interactive game logs
- Instant feedback on solutions

### Technical Stack
- Frontend: React with TypeScript
- Backend: Firebase Realtime Database
- AI: Google Gemini 2.5 for problem generation
- Testing: Automated test case validation

## How to Play

1. **Choose Your Mode**
   - Single Player for solo practice
   - Multiplayer for competitive duels

2. **In Multiplayer Mode**
   - Create a new game and share the game ID
   - Or join an existing game with a game ID

3. **During the Game**
   - Solve coding problems before your HP runs out
   - Write efficient solutions to gain more HP
   - Monitor your opponent's progress in real-time
   - First to solve all problems or last player standing wins!

## Victory Conditions
- Solve all problems before your opponent
- Maintain your HP while your opponent's reaches zero
- Achieve the highest efficiency in your solutions

## Development

### Prerequisites
- Node.js
- Google Gemini API key
- Firebase project credentials

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   - Create a `.env.local` file
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Firebase Configuration
The project requires Firebase setup with Realtime Database. Configure your Firebase credentials in `services/firebase.ts`.

---
Built with ❤️ using React, Firebase, and Google's Gemini AI
