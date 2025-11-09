import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFZTUF2GVbTv9bkzRwpDbly0SmEyunyr4",
  authDomain: "leetclash-1fb4d.firebaseapp.com",
  databaseURL: "https://leetclash-1fb4d.firebaseio.com",
  projectId: "leetclash-1fb4d",
  storageBucket: "leetclash-1fb4d.appspot.com",
  messagingSenderId: "531481099673",
  appId: "1:531481099673:web:324bd39c75735e1597e708",
  measurementId: "G-5E3JHYYM47"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the database service
export const db = getDatabase(app);