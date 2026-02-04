
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  collection,
  getDocs
} from 'firebase/firestore';
import {
  PortfolioState, PositionCategory, AppSettings,
  NewsItem,
  UserRole,
  AccessTier,
  UserProfile,
  AIPick,
  AuditLog,
  TransactionRecord,
  StrategyStats
} from '../types';

// ==========================================
// Firebase Configuration
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

let app;
export let auth: any;
export let db: any;
let isConfigured = true;

try {
  app = initializeApp(firebaseConfig);

  if (typeof window !== 'undefined') {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('6LcenV8sAAAAALGLE_IlW1I_ntJhlueuwyRARiLd'),
      isTokenAutoRefreshEnabled: true
    });
    console.log("Firebase App Check initialized.");
  }

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
  if (!auth) {
    alert("系統啟動中或 Firebase 配置錯誤，請稍後再試或重新整理。");
    return null;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  // Broader mobile check including tablets
  const isMobileOrTablet = window.innerWidth <= 1024 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobileOrTablet) {
    console.log("[Auth] Mobile/Tablet environment detected, using direct Redirect.");
    await signInWithRedirect(auth, provider);
    return null;
  }

  // Desktop Flow
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.warn("[Auth] Popup failure:", error.code);

    // Explicit Fallback for popup block
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
      console.log("[Auth] Falling back to Redirect for Desktop...");
      await signInWithRedirect(auth, provider);
      return null;
    }

    if (error.code === 'auth/unauthorized-domain') {
      alert(`【網域未授權】請在 Firebase 控制台新增: ${window.location.hostname}`);
    } else if (error.code !== 'auth/popup-closed-by-user') {
      alert(`登入遭遇進階錯誤: ${error.message}`);
    }

    return null;
  }
};

/**
 * Check and handle redirect result after signInWithRedirect
 * This is critical for PWA standalone mode where the app restarts after redirect
 */
export const handleRedirectResult = async (): Promise<User | null> => {
  // Wait for auth to be initialized
  let retries = 0;
  while (!auth && retries < 10) {
    console.log("[Auth] Waiting for Firebase to initialize...");
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  if (!auth) {
    console.error("[Auth] Firebase auth not initialized after waiting");
    return null;
  }

  try {
    console.log("[Auth] Checking for redirect result...");

    // CRITICAL FIX: Only call getRedirectResult if we're actually coming from a redirect
    // Check if there's a redirect marker in the URL or session
    const urlParams = new URLSearchParams(window.location.search);
    const hasRedirectParams = urlParams.has('state') || urlParams.has('code');

    // Also check if current user is already authenticated
    const currentUser = auth.currentUser;

    if (currentUser) {
      console.log("[Auth] User already authenticated, skipping redirect check");
      return null;
    }

    if (!hasRedirectParams) {
      console.log("[Auth] No redirect parameters found, skipping getRedirectResult");
      return null;
    }

    console.log("[Auth] Redirect parameters detected, calling getRedirectResult...");
    const result = await getRedirectResult(auth);

    if (result) {
      console.log("[Auth] ✅ Redirect result found! User logged in:", result.user.email);
      return result.user;
    } else {
      console.log("[Auth] No redirect result (might have been consumed already)");
      return null;
    }
  } catch (error: any) {
    console.error("[Auth] ❌ Redirect result error:", error.code, error.message);

    if (error.code === 'auth/unauthorized-domain') {
      alert(`【網域未授權】請在 Firebase 控制台新增: ${window.location.hostname}`);
    } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
      console.error("[Auth] Unexpected redirect error:", error);
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
    return () => { };
  }
  return onAuthStateChanged(auth, callback);
};

// --- Database Functions ---

export const savePortfolioToCloud = async (userId: string, data: PortfolioState) => {
  if (!isConfigured || !userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(userRef, { portfolio: cleanData }, { merge: true });
    console.log("Cloud sync successful for user:", userId);
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.error("Permission denied. Security rules are blocking save!", error);
      alert("⚠️ 資料同步失敗：權限不足。");
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
    if (error.code === 'permission-denied') {
      console.error("Load failed: Permission denied.");
    }
    console.error("Load from cloud failed", error);
    return null;
  }
};

export const resetCloudPortfolio = async (userId: string) => {
  if (!isConfigured || !userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { portfolio: null }, { merge: true });
    console.log("Cloud portfolio reset successful");
  } catch (error: any) {
    console.error("Reset cloud portfolio failed", error);
    throw error;
  }
};

/**
 * Audit Logs
 */
export const logAdminAction = async (action: string, targetId: string, details: string, actorEmail: string = "system") => {
  try {
    const colRef = collection(db, 'audit_logs');
    await addDoc(colRef, {
      timestamp: Date.now(),
      action,
      targetId,
      details,
      actorEmail,
      actorUid: auth.currentUser?.uid || 'unknown'
    });
  } catch (e) {
    console.error("Failed to write audit log", e);
  }
};

export const getAuditLogs = async (limitCount: number = 50): Promise<AuditLog[]> => {
  try {
    const colRef = collection(db, 'audit_logs');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        timestamp: data.timestamp,
        action: data.action,
        actorEmail: data.actorEmail,
        targetId: data.targetId,
        details: data.details
      } as AuditLog;
    });
  } catch (e) {
    console.error("Failed to fetch audit logs", e);
    return [];
  }
};

// --- Public Portfolio (Martingale) Sync ---

type PublicMartingaleData = {
  categories: PositionCategory[];
  transactions: TransactionRecord[];
  lastUpdated: number;
}

export const updatePublicMartingale = async (categories: PositionCategory[], transactions: TransactionRecord[]) => {
  if (!isConfigured) return;
  try {
    const docRef = doc(db, 'public_portfolios', 'martingale');
    const martingaleTxs = transactions.filter(t => t.isMartingale === true);
    const cleanCategories = JSON.parse(JSON.stringify(categories));
    const cleanTransactions = JSON.parse(JSON.stringify(martingaleTxs));

    const payload: PublicMartingaleData = {
      categories: cleanCategories,
      transactions: cleanTransactions,
      lastUpdated: Date.now()
    };

    await setDoc(docRef, payload, { merge: true });
  } catch (e) {
    console.error("[Firebase] Failed to update public martingale:", e);
  }
};

export const subscribeToPublicMartingale = (callback: (data: { categories: PositionCategory[], transactions: TransactionRecord[] } | null) => void) => {
  if (!isConfigured) return () => { };
  const docRef = doc(db, 'public_portfolios', 'martingale');

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        categories: (data.categories || []) as PositionCategory[],
        transactions: (data.transactions || []) as TransactionRecord[]
      });
    } else {
      callback(null);
    }
  }, (error) => {
    if (error.code === 'permission-denied') {
      console.error("⚠️ PERMISSION DENIED: Public Martingale.");
    }
  });
};

// --- User Directory & Roles ---

// REPLACE WITH YOUR EMAIL TO BECOME ADMIN
const SUPER_ADMIN_EMAILS = [
  "1033023@ntsu.edu.tw",
  "libao.finance@gmail.com"
];

export const syncUserProfile = async (user: User): Promise<UserRole> => {
  if (!isConfigured || !user) return 'viewer';
  const userDirRef = doc(db, 'user_directory', user.uid);

  try {
    const docSnap = await getDoc(userDirRef);
    let currentRole: UserRole = 'viewer';
    const isSuperAdmin = user.email && SUPER_ADMIN_EMAILS.includes(user.email);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      currentRole = data.role;
      if (isSuperAdmin && currentRole !== 'admin') {
        currentRole = 'admin';
      }
    } else {
      currentRole = isSuperAdmin ? 'admin' : 'viewer';
    }

    const userData: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || '',
      role: currentRole,
      lastActive: Date.now(),
      createdAt: docSnap.exists() ? (docSnap.data().createdAt || Date.now()) : Date.now()
    };

    await setDoc(userDirRef, userData, { merge: true });
    return currentRole;
  } catch (e) {
    console.error("Sync user profile failed", e);
    return 'viewer';
  }
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  if (!isConfigured) return [];
  try {
    const usersRef = collection(db, 'user_directory');
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  } catch (e) {
    console.error("Failed to get all users", e);
    return [];
  }
};

export const subscribeToUserRole = (userId: string, callback: (role: UserRole) => void) => {
  if (!isConfigured || !userId) return () => { };
  const userDirRef = doc(db, 'user_directory', userId);
  return onSnapshot(userDirRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      callback(data.role);
    }
  });
};

// --- Section Permission Logic (Tier-Based) ---

export const getSectionMinTier = async (sectionKey: string): Promise<AccessTier> => {
  if (!isConfigured) return AccessTier.GUEST;
  try {
    const configRef = doc(db, 'config', 'permissions');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const val = snap.data()[sectionKey];
      if (typeof val === 'number') return val as AccessTier;
    }
  } catch (e) { }

  if (sectionKey === 'market_insider') return AccessTier.ADMIN;
  if (sectionKey === 'ai_picks') return AccessTier.STANDARD;
  if (sectionKey === 'martingale') return AccessTier.STANDARD;
  return AccessTier.GUEST;
};

export const updateSectionMinTier = async (sectionKey: string, tier: AccessTier) => {
  if (!isConfigured) return;
  const configRef = doc(db, 'config', 'permissions');
  await setDoc(configRef, { [sectionKey]: tier }, { merge: true });
};

export const getAllSectionMinTiers = async (): Promise<Record<string, AccessTier>> => {
  if (!isConfigured) return {};
  try {
    const configRef = doc(db, 'config', 'permissions');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data();
      const tiers: Record<string, AccessTier> = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'number') tiers[k] = v as AccessTier;
      }
      return tiers;
    }
    return {
      'market_insider': AccessTier.ADMIN,
      'ai_picks': AccessTier.STANDARD,
      'martingale': AccessTier.STANDARD
    };
  } catch (e) {
    return {
      'market_insider': AccessTier.ADMIN,
      'ai_picks': AccessTier.STANDARD,
      'martingale': AccessTier.STANDARD
    };
  }
};

export const getRestrictedContent = async (sectionKey: string): Promise<any> => {
  if (!isConfigured) return null;
  const docRef = doc(db, 'sections', sectionKey, 'private', 'content');
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data();
    return null;
  } catch (e: any) {
    throw e;
  }
};

export const updateUserRole = async (targetUid: string, newRole: UserRole) => {
  if (!isConfigured) return;
  try {
    const userRef = doc(db, 'user_directory', targetUid);
    await updateDoc(userRef, { role: newRole });
  } catch (e) {
    console.error("Update role failed", e);
    throw e;
  }
};

export const getUserRole = async (uid: string): Promise<UserRole> => {
  if (!isConfigured) return 'viewer';
  try {
    const userRef = doc(db, 'user_directory', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) return (snap.data() as UserProfile).role;
    return 'viewer';
  } catch (e) {
    return 'viewer';
  }
}

// --- AI Picks Functions ---

export const addAIPick = async (pick: Omit<AIPick, 'id'>) => {
  if (!isConfigured) return;
  try {
    const colRef = collection(db, 'ai_picks');
    await addDoc(colRef, pick);
  } catch (e) {
    throw e;
  }
};

export const getAIPicks = async (limitCount: number = 20): Promise<AIPick[]> => {
  if (!isConfigured) return [];
  try {
    const colRef = collection(db, 'ai_picks');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIPick));
  } catch (e) {
    return [];
  }
};

export const deleteAIPick = async (id: string) => {
  if (!isConfigured) return;
  try {
    await deleteDoc(doc(db, 'ai_picks', id));
  } catch (e) {
    throw e;
  }
};

export const getStrategyStats = async (): Promise<StrategyStats | null> => {
  if (!isConfigured) return null;
  try {
    const docRef = doc(db, 'config', 'ai_picks_stats');
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data() as StrategyStats;
    return null;
  } catch (e) {
    return null;
  }
};

export const updateStrategyStats = async (stats: StrategyStats) => {
  if (!isConfigured) return;
  try {
    const docRef = doc(db, 'config', 'ai_picks_stats');
    await setDoc(docRef, stats, { merge: true });
  } catch (e) {
    throw e;
  }
};

export const updateAIPick = async (pick: AIPick) => {
  if (!isConfigured) return;
  try {
    const docRef = doc(db, 'ai_picks', pick.id);
    await setDoc(docRef, pick, { merge: true });
  } catch (e) {
    throw e;
  }
};
