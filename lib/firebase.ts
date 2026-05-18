import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, EmailAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
const microsoftProvider = new OAuthProvider('microsoft.com');

export { app, firestoreDb, auth, googleProvider, appleProvider, microsoftProvider, EmailAuthProvider };
