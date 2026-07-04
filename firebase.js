import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
export const auth = getAuth(app);
