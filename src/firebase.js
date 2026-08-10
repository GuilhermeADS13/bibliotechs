import { initializeApp } from 'firebase/app';
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

export const auth     = isFirebaseConfigured ? getAuth(app) : { onAuthStateChanged: (auth, cb) => cb(null) };
export const provider = isFirebaseConfigured ? new GoogleAuthProvider() : null;

// O Firestore é o maior pedaço do Firebase (~250 KB) e só serve a quem tem
// conta — sem login, livros e conversas ficam no localStorage. Carregado sob
// demanda para não pesar no primeiro acesso de quem só está olhando o app.
// A promessa é memorizada: o import roda uma vez por sessão.
let firestorePromessa;

export function carregarFirestore() {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  if (!firestorePromessa) {
    firestorePromessa = import('firebase/firestore')
      .then(fs => ({ fs, db: fs.getFirestore(app) }))
      .catch(e => {
        // Não deixa a promessa rejeitada em cache: uma falha de rede pontual
        // impediria qualquer tentativa posterior de carregar o Firestore.
        firestorePromessa = undefined;
        throw e;
      });
  }
  return firestorePromessa;
}
