import { initializeApp } from './vendor/firebase/12.18.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from './vendor/firebase/12.18.0/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocs, onSnapshot, runTransaction, setDoc, deleteDoc } from './vendor/firebase/12.18.0/firebase-firestore.js';

window.CreamCornFirebase = {
  create: config => {
    const app = initializeApp(config);
    return {
      auth: getAuth(app),
      db: getFirestore(app),
      doc,
      collection,
      getDoc,
      getDocs,
      onSnapshot,
      runTransaction,
      setDoc,
      deleteDoc,
      GoogleAuthProvider,
      onAuthStateChanged,
      signInWithPopup,
      signOut
    };
  }
};

window.dispatchEvent(new Event('firebase-sdk-ready'));
