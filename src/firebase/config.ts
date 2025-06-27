import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAQSQ_69ObypSWhbIiqme-S8uyzXc4WRYc",
  authDomain: "pickleballhyd.firebaseapp.com",
  projectId: "pickleballhyd",
  storageBucket: "pickleballhyd.firebasestorage.app",
  messagingSenderId: "520033562224",
  appId: "1:520033562224:web:85f08c88737bb5a5280eb5",
  measurementId: "G-JTL52RE8P4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };