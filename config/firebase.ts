import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDJZ3aUrjy2PGPX0tcveJdnea_XBtyzLcA",
  authDomain: "chorepal-f8122.firebaseapp.com",
  projectId: "chorepal-f8122",
  storageBucket: "chorepal-f8122.firebasestorage.app",
  messagingSenderId: "250248400564",
  appId: "1:250248400564:web:54fa24f0624e741706d1e1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;