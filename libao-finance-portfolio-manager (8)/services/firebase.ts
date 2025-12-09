import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { PortfolioState } from '../types';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// ==========================================
// Firebase Service
// ==========================================

let app;
let auth: any;
let db: any;
let isConfigured = false;

try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isConfigured = true;
    console.log("Firebase initialized successfully.");
  }
} catch (e) {
  console.error("Firebase initialization error:", e);
}

export const isFirebaseReady = () => isConfigured;

// --- Auth Functions ---

export const loginWithGoogle = async () => {
  if (!isConfigured) {
    alert("Firebase 設定未完成。");
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    // Suppress default console.error for domain issues to avoid panic
    if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        console.warn(`[Firebase Auth] Domain '${domain}' is not authorized.`);
        alert(
            `【登入被阻擋：網域未授權】\n\n` +
            `這是 Firebase 的安全機制 (Security Rule)。\n` +
            `您目前的執行環境網域是：${domain}\n\n` +
            `請前往 Firebase Console > Authentication > Settings > Authorized domains，\n` +
            `新增上述網域即可正常登入。`
        );
    } else if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Login failed", error);
        alert(`登入錯誤: ${error.message || '未知錯誤'}`);
    } else {
        console.log("User closed login popup");
    }
    return null; 
  }
};

export const logoutUser = async () => {
  if (!isConfigured) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
  }
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  if (!isConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

// --- Database Functions ---

export const savePortfolioToCloud = async (userId: string, data: PortfolioState) => {
  if (!isConfigured || !userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { portfolio: data }, { merge: true });
  } catch (error: any) {
    if (error && error.code === 'permission-denied') {
       console.error("Permission denied. Security rules are working!");
    } else {
       console.error("Save to cloud failed", error);
    }
  }
};

export const loadPortfolioFromCloud = async (userId: string): Promise<PortfolioState | null> => {
  if (!isConfigured || !userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.portfolio as PortfolioState;
    } else {
      return null;
    }
  } catch (error: any) {
    console.error("Load from cloud failed", error);
    return null;
  }
};