import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Verifica se as variáveis essenciais estão presentes para evitar crash
const isFirebaseConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let app;
try {
  if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
  } else {
    console.warn("Firebase não configurado. O app funcionará apenas em modo local.");
    app = { isDummy: true };
  }
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
  app = { isDummy: true };
}

export const db       = isFirebaseConfigured ? getFirestore(app) : null;
export const auth     = isFirebaseConfigured ? getAuth(app) : { onAuthStateChanged: (auth, cb) => cb(null) };
export const provider = isFirebaseConfigured ? new GoogleAuthProvider() : null;
