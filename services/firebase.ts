
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  OAuthProvider,
  AuthError,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
// import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } from 'firebase/app-check'; // 完全移除 App Check import
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
  // 使用 Vercel 網域作為 authDomain (配合 vercel.json 代理)
  authDomain: "libao-finance-portfolio-manager.vercel.app",
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
    // App Check 已停用 (reCAPTCHA 導致 iOS PWA 等環境登入問題)
    console.log("[AppCheck] App Check 初始化已停用。");
  }

  auth = getAuth(app);

  // Explicitly set persistence to LOCAL (default for web, but ensures PWA stability)
  setPersistence(auth, browserLocalPersistence)
    .then(() => console.log("[Auth] Persistence set to LOCAL"))
    .catch((error) => console.error("[Auth] Failed to set persistence:", error));

  db = getFirestore(app);
  console.log("Firebase initialized successfully.");
} catch (e) {
  console.error("Firebase initialization error:", e);
  isConfigured = false;
}

export const isFirebaseReady = () => isConfigured;


export const loginWithGoogle = async () => {
  if (!auth) {
    alert("系統啟動中或 Firebase 配置錯誤,請稍後再試或重新整理。");
    return null;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const ua = navigator.userAgent;
  const isStandalone = (window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;


  // 使用 Custom Auth Domain 後，Google 會信任 PWA 內的 Redirect
  if (isStandalone) {
    console.log("[Auth] PWA Standalone detected. Using Custom Auth Domain Redirect...");
    try {
      await signInWithRedirect(auth, provider);
      return null;
    } catch (error: any) {
      throw error;
    }
  }

  // 其他環境優先嘗試 Popup
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, provider);
      return null;
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
    // 增加一點延遲，確保 Firebase 內部狀態在 PWA 從重導向回來後已就緒
    await new Promise(resolve => setTimeout(resolve, 500));

    const result = await getRedirectResult(auth);

    if (result) {
      console.log("[Auth] ✅ 成功從重導向取得使用者:", result.user.email);
      return result.user;
    }

    console.log("[Auth] ℹ️ getRedirectResult 回傳為空 (可能非跳轉回來或是資訊已過期)");
    return null;
  } catch (error: any) {
    console.error("[Auth] ❌ getRedirectResult 發生異常錯誤:", error);
    console.error("[Auth] 錯誤代碼:", error.code);
    console.error("[Auth] 錯誤訊息:", error.message);

    if (error.code === 'auth/unauthorized-domain') {
      alert(`網域未授權: ${window.location.hostname}`);
    }

    return null;
  }
};

// ==========================================
// Email Link (Passwordless) Login
// ==========================================

export const sendMagicLink = async (email: string) => {
  if (!auth) throw new Error("Firebase auth not initialized");

  const actionCodeSettings = {
    // 重導向回來的 URL。必須在 Firebase Console 加入此網域。
    url: window.location.href,
    handleCodeInApp: true
  };

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // 儲存 Email 以便使用者點擊連結回來時驗證 (避免再次詢問)
    window.localStorage.setItem('emailForSignIn', email);
    return true;
  } catch (error) {
    console.error("Error sending email link:", error);
    throw error;
  }
};

export const checkAndFinishEmailLogin = async (manualEmail?: string): Promise<{ user: User | null, needsEmail?: boolean }> => {
  if (!auth) return { user: null };

  // 檢查當前 URL 是否為 Email Link 登入連結
  if (isSignInWithEmailLink(auth, window.location.href)) {
    console.log("[Auth] Detected Email Link sign-in flow");

    // 1. 優先使用手動輸入的 Email (如果有的話)
    // 2. 其次是 LocalStorage 記住的 Email
    let email = manualEmail || window.localStorage.getItem('emailForSignIn');

    // 若完全沒有 Email (不同瀏覽器/裝置)，回傳 needsEmail 標記，通知前端顯示輸入框
    if (!email) {
      return { user: null, needsEmail: true };
    }

    // 若有 Email，嘗試完成登入
    try {
      const result = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      console.log("[Auth] Email Link login successful:", result.user.email);
      // Clean URL & Redirect to App
      if (window.history && window.history.replaceState) {
        // Force replace to /app if user requested, or just clean search params
        const newUrl = window.location.origin + window.location.pathname; // Clean search params
        window.history.replaceState({}, document.title, newUrl);
      }
      return { user: result.user };
    } catch (error: any) {
      console.error("[Auth] Email Link login failed:", error);
      // 如果 email 不對 (auth/invalid-email) 或連結失效 (auth/invalid-action-code)
      throw error;
    }
  }
  return { user: null };
};

// Helper to clean URL and redirect to app view
export const redirectToApp = () => {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    // If query params exist (like mode=signIn), clean them
    if (url.search) {
      url.search = '';
      window.history.replaceState({}, document.title, url.toString());
    }
  }
};

/**
 * Advanced: Handle Account Linking
 * 如果使用者用 Google 登入，但該 Email 已有帳號 (例如 Email/Password) 且未自動連結，
 * 或是反過來，會拋出 `auth/account-exists-with-different-credential`。
 */
export const handleAccountConflict = async (error: any) => {
  if (error.code === 'auth/account-exists-with-different-credential') {
    const email = error.customData.email;
    const pendingCred = GoogleAuthProvider.credentialFromError(error); // 取得 Google 的憑證
    // 或是 OAuthProvider.credentialFromError(error) 通用

    if (!email || !pendingCred) return;

    // 1. 查詢該 Email 已經存在的登入方式
    const methods = await fetchSignInMethodsForEmail(auth, email);

    // 2. 假設 methods 包含 'emailLink' 或 'password'
    // 這裡回傳資訊讓前端決策：提示使用者改用 [methods[0]] 登入，
    // 登入後再用 linkWithCredential(user, pendingCred) 把 Google 綁上去。
    return {
      isConflict: true,
      email,
      existingMethods: methods,
      pendingCredential: pendingCred
    };
  }
  return null;
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
  totalCapital: number;
  lastUpdated: number;
}

export const updatePublicMartingale = async (categories: PositionCategory[], transactions: TransactionRecord[], totalCapital: number) => {
  if (!isConfigured) return;
  try {
    const docRef = doc(db, 'public_portfolios', 'martingale');
    const martingaleTxs = transactions.filter(t => t.isMartingale === true);
    const cleanCategories = JSON.parse(JSON.stringify(categories));
    const cleanTransactions = JSON.parse(JSON.stringify(martingaleTxs));

    const payload: PublicMartingaleData = {
      categories: cleanCategories,
      transactions: cleanTransactions,
      totalCapital,
      lastUpdated: Date.now()
    };

    await setDoc(docRef, payload, { merge: true });
  } catch (e) {
    console.error("[Firebase] Failed to update public martingale:", e);
  }
};

export const subscribeToPublicMartingale = (callback: (data: { categories: PositionCategory[], transactions: TransactionRecord[], totalCapital: number } | null) => void) => {
  if (!isConfigured) return () => { };
  const docRef = doc(db, 'public_portfolios', 'martingale');

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        categories: (data.categories || []) as PositionCategory[],
        transactions: (data.transactions || []) as TransactionRecord[],
        totalCapital: data.totalCapital || 0
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
