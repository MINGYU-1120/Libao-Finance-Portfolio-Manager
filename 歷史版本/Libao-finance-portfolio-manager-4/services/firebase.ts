
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
// Firebase Configuration
// ==========================================
// 🛡️ SECURITY NOTICE:
// Firestore Security Rules are the primary defense mechanism.
// Ensure rules are set to: allow read, write: if request.auth != null && request.auth.uid == userId;
const firebaseConfig = {
  apiKey: "AIzaSyD5A9UsWLO6vb5N0pcX5x8I4d9kzy5lvUU",
  authDomain: "libao-finance-manager.firebaseapp.com",
  projectId: "libao-finance-manager",
  storageBucket: "libao-finance-manager.firebasestorage.app",
  messagingSenderId: "379106694870",
  appId: "1:379106694870:web:83e75404107d2af6fa5b77",
  measurementId: "G-1659VMVZMN"
};

let app;
let auth: any;
let db: any;
// Default to true since we have hardcoded config
let isConfigured = true;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("Firebase initialized successfully.");
} catch (e) {
  console.error("Firebase initialization error:", e);
  isConfigured = false;
}

export const isFirebaseReady = () => isConfigured;

// --- Auth Functions ---

export const loginWithGoogle = async () => {
  if (!isConfigured) {
    alert("Firebase 初始化失敗，請重新整理頁面。");
    return;
  }
  const provider = new GoogleAuthProvider();
  
  // Force account selection every time
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    // Specific handling for Unauthorized Domain error
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
    } else if (error.code === 'auth/popup-closed-by-user') {
        console.log("User closed login popup.");
    } else {
        console.error("Login failed", error);
        alert(`登入發生錯誤: ${error.message}`);
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
    // Merge true ensures we don't overwrite other fields if they exist
    await setDoc(userRef, { portfolio: data }, { merge: true });
    console.log("Cloud sync successful");
  } catch (error: any) {
    if (error.code === 'permission-denied') {
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

export const resetCloudPortfolio = async (userId: string) => {
  if (!isConfigured || !userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    // Overwrite portfolio with null to indicate no data
    await setDoc(userRef, { portfolio: null }, { merge: true });
    console.log("Cloud portfolio reset successful");
  } catch (error: any) {
    console.error("Reset cloud portfolio failed", error);
    throw error;
  }
};
