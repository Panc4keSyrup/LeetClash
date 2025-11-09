import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAGAg9LocluM8CIy6k2gsJtmX6bZD3vb4o",
  authDomain: "leetclash2.firebaseapp.com",
  databaseURL: "https://leetclash2-default-rtdb.firebaseio.com/", // <- exact URL from Console
  projectId: "leetclash2",
  storageBucket: "leetclash2.appspot.com",
  messagingSenderId: "907615790245",
  appId: "1:907615790245:web:745cae12be99d0013e194c"
};

export const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);
