// Importa as funções que vamos precisar do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Suas chaves de configuração do Firebase que você copiou
const firebaseConfig = {
  apiKey: "AIzaSyDdLh6-VvSmDNI7Fw4lV_U5q5w3_S8xopI",
  authDomain: "ficha-rpg-sidera.firebaseapp.com",
  projectId: "ficha-rpg-sidera",
  storageBucket: "ficha-rpg-sidera.firebasestorage.app",
  messagingSenderId: "309531890217",
  appId: "1:309531890217:web:90d2cb626cd6121d814238"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o banco de dados (Firestore) para que outros scripts possam usá-lo
export const db = getFirestore(app);