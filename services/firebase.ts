
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
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import {
  PortfolioState, PositionCategory, AppSettings,
  NewsItem,
  TransactionRecord,
  AIPick,
  StrategyStats,
  AccessTier,
  getTier,
  UserRole,
  UserProfile
} from '../types';

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
    return () => { };
  }
  return onAuthStateChanged(auth, callback);
};

// --- Database Functions ---

export const savePortfolioToCloud = async (userId: string, data: PortfolioState) => {
  if (!isConfigured || !userId) return;
  try {
    const userRef = doc(db, 'users', userId);

    // CRITICAL FIX: Firestore throws an error if any value is `undefined`.
    // We must strip undefined values. JSON.stringify/parse is a fast way to do this 
    // (it removes keys with undefined values entirely).
    const cleanData = JSON.parse(JSON.stringify(data));

    // Merge true ensures we don't overwrite other fields if they exist
    await setDoc(userRef, { portfolio: cleanData }, { merge: true });
    console.log("Cloud sync successful for user:", userId);
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.error("Permission denied. Security rules are blocking save!", error);
      alert("⚠️ 資料同步失敗：權限不足。請確認 Firestore Rules 是否正確部署。");
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
      console.log("Cloud data loaded successfully", data.portfolio ? "Portfolio found" : "Portfolio is empty/null");
      return data.portfolio as PortfolioState;
    } else {
      console.warn("No cloud document found for user:", userId);
      return null;
    }
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.error("Load failed: Permission denied.");
      alert("⚠️ 無法讀取雲端資料：權限不足。");
    }
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

// --- Public Portfolio (Martingale) Sync ---

// --- Public Portfolio (Martingale) Sync ---

// Update Interface to include transactions
type PublicMartingaleData = {
  categories: PositionCategory[];
  transactions: TransactionRecord[];
  lastUpdated: number;
}

export const updatePublicMartingale = async (categories: PositionCategory[], transactions: TransactionRecord[]) => {
  if (!isConfigured) {
    console.warn("[Firebase] Not configured, skipping public update");
    return;
  }
  try {
    const docRef = doc(db, 'public_portfolios', 'martingale');
    // Sanitize: Only keep Martingale transactions
    const martingaleTxs = transactions.filter(t => t.isMartingale === true);

    // Clean data for Firestore (remove undefined)
    const cleanCategories = JSON.parse(JSON.stringify(categories));
    const cleanTransactions = JSON.parse(JSON.stringify(martingaleTxs));

    const payload: PublicMartingaleData = {
      categories: cleanCategories,
      transactions: cleanTransactions,
      lastUpdated: Date.now()
    };

    await setDoc(docRef, payload, { merge: true });
    console.log("[Firebase] Public Martingale (Cats + Txs) updated successfully. Txs count:", martingaleTxs.length);
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
      // Handle legacy data where 'transactions' might be missing
      callback({
        categories: (data.categories || []) as PositionCategory[],
        transactions: (data.transactions || []) as TransactionRecord[]
      });
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Subscribe public martingale failed:", error.code, error.message);
    // Explicitly warn about permission issues for debugging
    if (error.code === 'permission-denied') {
      console.error("⚠️ PERMISSION DENIED: User does not have 'member' or 'admin' role in Firestore rules.");
    }
  });
};

// --- User Directory & Roles (New Feature) ---

import { collection, getDocs } from 'firebase/firestore';

// ⚠️ REPLACE WITH YOUR EMAIL TO BECOME ADMIN ⚠️
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
    console.log(`Syncing user: ${user.email}, isSuperAdmin: ${isSuperAdmin}`);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      currentRole = data.role;
      // Force upgrade if in super admin list
      if (isSuperAdmin && currentRole !== 'admin') {
        console.log("Upgrading user to admin based on SUPER_ADMIN_EMAILS");
        currentRole = 'admin';
      }
    } else {
      // New User
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
    await setDoc(userDirRef, userData, { merge: true });
    console.log(`[Role Sync] User: ${user.email}, DB Role: ${docSnap.exists() ? (docSnap.data() as any).role : 'none'}, Final Role: ${currentRole}`);
    return currentRole;

  } catch (e) {
    console.error("Sync user profile failed", e);
    return 'viewer'; // Fail safe
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
      console.log(`[Role Sync] Real-time update: ${data.role}`);
      callback(data.role);
    }
  }, (error) => {
    console.warn("Role subscription failed/denied", error);
  });
};

// --- Section Permission Logic (Tier-Based) ---

export const getSectionMinTier = async (sectionKey: string): Promise<AccessTier> => {
  if (!isConfigured) return AccessTier.GUEST;

  try {
    // Legacy: Was 'permissions', New: 'permissions' (unified)
    const configRef = doc(db, 'config', 'permissions');
    const snap = await getDoc(configRef);

    if (snap.exists()) {
      const val = snap.data()[sectionKey];
      // Check if it's a number (Tier)
      if (typeof val === 'number') {
        return val as AccessTier;
      }
      // If array (Legacy Role List), map to Tier?
      // For MVP, we ignore legacy arrays and fallback to defaults if no Tier number found.
    }
  } catch (e) {
    console.warn("Failed to fetch access config", e);
  }

  // Defaults
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

    // Return defaults if empty
    return {
      'market_insider': AccessTier.ADMIN,
      'ai_picks': AccessTier.STANDARD,
      'martingale': AccessTier.STANDARD
    };
  } catch (e) {
    console.error("Failed to load access matrix", e);
    return {};
  }
};

export const getRestrictedContent = async (sectionKey: string): Promise<any> => {
  if (!isConfigured) return null;
  // This path MUST be protected by Firestore Rules
  const docRef = doc(db, 'sections', sectionKey, 'private', 'content');
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    } else {
      // If doc doesn't exist, maybe it needs seeding?
      // Auto-seed for demo if user has permission but data is missing
      await setDoc(docRef, {
        title: "🚀 Market Insider: 2024 Q3 Outlook",
        body: "This is exclusive content fetched from the secure backend. If you can see this, you have the required role privileges.",
        timestamp: Date.now()
      });
      return {
        title: "🚀 Market Insider: 2024 Q3 Outlook",
        body: "This is exclusive content fetched from the secure backend. If you can see this, you have the required role privileges."
      };
    }
  } catch (e: any) {
    // If permission denied, Firestore throws error
    console.warn(`Access to restricted section '${sectionKey}' blocked:`, e.code);
    throw e; // Propagate error to caller
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
    if (snap.exists()) {
      return (snap.data() as UserProfile).role;
    }
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
    console.error("Add AI Pick failed", e);
    throw e;
  }
};

export const getAIPicks = async (limitCount: number = 20): Promise<AIPick[]> => {
  if (!isConfigured) return [];
  try {
    const colRef = collection(db, 'ai_picks');
    // Simplified query to avoid need for composite index
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIPick));
  } catch (e) {
    console.error("Get AI Picks failed", e);
    return [];
  }
};

export const deleteAIPick = async (id: string) => {
  if (!isConfigured) return;
  try {
    await deleteDoc(doc(db, 'ai_picks', id));
  } catch (e) {
    console.error("Delete AI Pick failed", e);
    throw e;
  }
};

export const getStrategyStats = async (): Promise<StrategyStats | null> => {
  if (!isConfigured) return null;
  try {
    const docRef = doc(db, 'config', 'ai_picks_stats');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as StrategyStats;
    }
    return null;
  } catch (e) {
    console.error("Get Strategy Stats failed", e);
    return null;
  }
};

export const updateStrategyStats = async (stats: StrategyStats) => {
  if (!isConfigured) return;
  try {
    const docRef = doc(db, 'config', 'ai_picks_stats');
    await setDoc(docRef, stats, { merge: true });
  } catch (e) {
    console.error("Update Strategy Stats failed", e);
    throw e;
  }
};

export const updateAIPick = async (pick: AIPick) => {
  if (!isConfigured) return;
  try {
    const docRef = doc(db, 'ai_picks', pick.id);
    await setDoc(docRef, pick, { merge: true });
  } catch (e) {
    console.error("Update AI Pick failed", e);
    throw e;
  }
};
