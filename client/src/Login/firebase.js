import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDGBaFKYo3yxrJN3rYuLUWKthM0rTjWhGM",
  authDomain: "resume-7b66d.firebaseapp.com",
  projectId: "resume-7b66d",
  storageBucket: "resume-7b66d.appspot.com",
  messagingSenderId: "774360237613",
  appId: "1:774360237613:web:ad0a399878652097f1daa4",
  measurementId: "G-0FDV2457KY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    throw error;
  }
};


export const firestore = getFirestore(app);