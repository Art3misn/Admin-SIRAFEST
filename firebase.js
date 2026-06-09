import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDwnQIHcCumF8_X8Yhfs9OnU2Mx-mInmBg",
  authDomain: "jalan-santai-a15a2.firebaseapp.com",
  projectId: "jalan-santai-a15a2",
  storageBucket: "jalan-santai-a15a2.firebasestorage.app",
  messagingSenderId: "200402016520",
  appId: "1:200402016520:web:1be461236324f37f6634bd",
  measurementId: "G-FZ2DZ6M7JR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);