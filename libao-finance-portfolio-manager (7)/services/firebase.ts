
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

// ==========================================
// Firebase Configuration for Libao Finance Manager
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyD5A9UsWLO6vb5N0pcX5x8I4d9kzy5lvUU",
  authDomain: "libao-finance-manager.firebaseapp.com",
  projectId: "libao-finance-manager",
  storageBucket: "libao-finance-manager.firebasestorage.app",
  messagingSenderId: "379106694870",
  appId: "1:379106694870:web:83e75404107d2af6fa5b77",
  measurementId: "G-1659VMVZMN"
};

// ==========================================

let app;
let auth: any;
let db: any;
let isConfigured = false;

// Initialize Firebase securely
try {
  // Check if config is valid (simple check)
  if (firebaseConfig.projectId && firebaseConfig.apiKey !== "請填入您的_API_KEY") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isConfigured = true;
    console.log("Firebase initialized successfully in Cloud Mode");
  } else {
    console.warn("Firebase config missing or invalid. Running in Offline Mode.");
  }
} catch (e) {
  console.error("Firebase initialization error:", e);
}

export const isFirebaseReady = () => isConfigured;

// --- Auth Functions ---

export const loginWithGoogle = async () => {
  if (!isConfigured) {
    alert("尚未設定 Firebase Config，無法使用雲端登入。");
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.error("Login failed", error);
    
    if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        alert(
            `【登入失敗：網域未授權】\n\n` +
            `這是 Firebase 的安全機制。請執行以下步驟：\n` +
            `1. 前往 Firebase Console -> Authentication -> Settings\n` +
            `2. 找到 Authorized domains (授權網域)\n` +
            `3. 點擊 "Add domain" 並填入下方網域：\n\n` +
            `${domain}`
        );
    } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed popup, ignore
        console.log('User closed login popup');
    } else {
        alert(`登入發生錯誤: ${error.message}`);
    }
    return null; // Gracefully return null without throwing
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
    // Convert complex objects if necessary, but PortfolioState is JSON-safe
    await setDoc(userRef, { portfolio: data }, { merge: true });
    console.log("Saved to cloud");
  } catch (error) {
    console.error("Save to cloud failed", error);
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
      return null; // New user, no data yet
    }
  } catch (error) {
    console.error("Load from cloud failed", error);
    return null;
  }
};
