import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  // Make the API_KEY available in the app
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  // Ensure the server can be accessed from your network if needed
  server: {
    host: true,
  }
});
