import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

try {
  if (firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    if (firebaseConfig.firestoreDatabaseId) {
      firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    } else {
      firestoreDb = getFirestore(app);
    }
  }
} catch (err) {
  console.warn('Firebase initialization note (offline or local fallback active):', err);
}

export { app, firestoreDb, firebaseConfig };
