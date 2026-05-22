// Firebase initialization.
// NEXT_PUBLIC_ vars are available at runtime (browser + server with .env.local).
// During `next build` without .env.local (e.g., CI), we use fallback placeholders
// so the module loads without crashing — real connections only happen in the browser
// inside useEffect / event handlers where actual API keys are present at runtime.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "build-placeholder",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "placeholder.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "placeholder",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "placeholder.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "1:000000000000:web:placeholder",
};

// Prevent re-initializing on hot reloads during development
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { app };

// Request Google Calendar scope when user signs in
googleProvider.addScope("https://www.googleapis.com/auth/calendar.readonly");
