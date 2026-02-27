
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
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
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
  getDocs,
  where
} from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage, deleteToken } from 'firebase/messaging';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
// Firebase 設定 (使用環境變數以提高安全性)
// ==========================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // 使用 Vercel 網域作為 authDomain (配合 vercel.json 代理)
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app;
export let auth: any;
export let db: any;
export let functions: any;
let isConfigured = true;

try {
  app = initializeApp(firebaseConfig);

  if (typeof window !== 'undefined') {
    // App Check 初始化 (包含 iOS PWA 容錯)
    try {
      const isStandalone = (window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;

      // 開發環境可啟動 Debug Token
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        console.log("[AppCheck] Debug mode enabled for localhost.");
      }

      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
      console.log("[AppCheck] App Check 初始化成功。");
    } catch (acError) {
      console.error("[AppCheck] App Check 初始化失敗:", acError);
    }
  }

  auth = getAuth(app);

  // Explicitly set persistence to LOCAL (default for web, but ensures PWA stability)
  setPersistence(auth, browserLocalPersistence)
    .then(() => console.log("[Auth] Persistence set to LOCAL"))
    .catch((error) => console.error("[Auth] Failed to set persistence:", error));

  db = getFirestore(app);
  functions = getFunctions(app);
  console.log("Firebase initialized successfully.");

  // 初始化 Messaging
  isSupported().then(supported => {
    if (supported) {
      console.log("Firebase Messaging Support Check Passed");
    }
  });

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
// Email/Password Login
// ==========================================

export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  if (!auth) throw new Error("Firebase auth not initialized");
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    throw error;
  }
};

export const registerWithEmail = async (email: string, password: string): Promise<User> => {
  if (!auth) throw new Error("Firebase auth not initialized");
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    throw error;
  }
};

export const resetPassword = async (email: string) => {
  if (!auth) throw new Error("Firebase auth not initialized");
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    throw error;
  }
};

// ==========================================
// Email Link (Passwordless) Login - DEPRECATED
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


/**
 * 同步使用者資料並取得角色權限
 * 從 Firestore 的 user_directory 集合中讀取使用者的 role 欄位
 */
export const syncUserProfile = async (user: User): Promise<UserRole> => {
  if (!isConfigured || !user) return 'viewer';
  const userDirRef = doc(db, 'user_directory', user.uid);

  try {
    const docSnap = await getDoc(userDirRef);
    let currentRole: UserRole = 'viewer';

    // 如果資料庫中已有該使用者文件，則讀取其角色，否則預設為 viewer
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      currentRole = data.role || 'viewer';
    } else {
      currentRole = 'viewer';
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

    // 將最新的使用者資訊存回資料庫
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

// --- Push Notification Functions ---
export const subscribeToPushNotifications = async (uid: string | null): Promise<boolean> => {
  if (!isConfigured) return false;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("This browser does not support Firebase Cloud Messaging.");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("Notification permission was not granted.");
      return false;
    }

    // 將設定注入到 Service Worker 讓他能直接呼叫 firebase API
    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      const swUrl = `/firebase-messaging-sw.js?apiKey=${firebaseConfig.apiKey}&projectId=${firebaseConfig.projectId}&messagingSenderId=${firebaseConfig.messagingSenderId}&appId=${firebaseConfig.appId}&storageBucket=${firebaseConfig.storageBucket}&authDomain=${firebaseConfig.authDomain}`;
      try {
        // 強制指定 scope 為 '/'，防止進入救援模式的 sub-scope
        registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
        console.log('Firebase Messaging SW registered at root scope', registration.scope);
      } catch (err) {
        console.error('Service Worker registration failed:', err);
      }
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration // 這行是解決「只有紅點、沒有推播」的關鍵
    });

    if (token) {
      console.log('Got FCM device token');

      // 判斷裝置與 OS 資訊
      const userAgent = navigator.userAgent;
      const deviceOs = /android/i.test(userAgent) ? 'Android' : /iPad|iPhone|iPod/.test(userAgent) ? 'iOS' : 'Desktop';
      const topics = uid ? ["all", `user_${uid}`] : ["all"];

      // 將 token 存入獨立 collection
      const tokenRef = doc(db, 'fcm_tokens', token);
      await setDoc(tokenRef, {
        token,
        uid: uid || null,
        deviceOs,
        topics,
        lastActive: Date.now(),
        status: 'active'
      }, { merge: true });

      console.log('FCM Token successfully saved to Firestore');

      // --- 階段二：呼叫後端訂閱 Topics ---
      try {
        const subscribeFn = httpsCallable(functions, 'subscribeToTopic');
        const subscribeResult = await subscribeFn({ token });
        console.log('[Push] Backend subscription result:', subscribeResult.data);
      } catch (subError) {
        console.error('[Push] Backend subscription failed:', subError);
        // 注意：即便訂閱 Topic 失敗，Token 已存入 Firestore，單點推播仍有效
      }

      return true;
    } else {
      console.warn("Failed to get FCM token.");
      return false;
    }
  } catch (err) {
    console.error("An error occurred while retrieving token. ", err);
    return false;
  }
};

/**
 * 監聽前台推播訊息 (Foreground Messaging)
 * 當 App 正在開啟狀態時，接收到推播會觸發此回調
 */
export const setupForegroundMessaging = (onMessageReceived: (payload: any) => void) => {
  if (!app) return () => { };
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log('[Push] Foreground message received:', payload);
      onMessageReceived(payload);
    });
  } catch (e) {
    console.error("[Push] Failed to setup foreground listener", e);
    return () => { };
  }
};

/**
 * 取得推播診斷資訊
 */
export const getPushDiagnostic = async () => {
  const info: any = {
    permission: 'unknown',
    supported: false,
    token: null,
    swState: 'none',
    vapidKeySet: !!import.meta.env.VITE_FIREBASE_VAPID_KEY
  };

  try {
    info.supported = await isSupported();
    info.permission = (window as any).Notification?.permission || 'unsupported';

    if (info.supported) {
      const messaging = getMessaging(app);
      try {
        info.token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
      } catch (e) {
        info.tokenError = (e as Error).message;
      }
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      info.swCount = registrations.length;
      info.swList = registrations.map(r => r.scope);
    }
  } catch (e) {
    info.error = (e as Error).message;
  }
  return info;
};

/**
 * 取得特定 UID 的 Token 數量
 */
export const getTokenCount = async (uid: string) => {
  if (!db) return 0;
  try {
    const q = query(collection(db, 'fcm_tokens'), where('uid', '==', uid), where('status', '==', 'active'));
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (e) {
    console.error("Error counting tokens:", e);
    return -1;
  }
};

/**
 * 刪除特定 UID 的所有 Token (清理環境用)
 */
export const deleteAllUserTokens = async (uid: string) => {
  if (!db) return;
  try {
    const q = query(collection(db, 'fcm_tokens'), where('uid', '==', uid));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log(`[Push] Deleted ${snapshot.size} tokens for user ${uid}`);
  } catch (e) {
    console.error("Error deleting tokens:", e);
  }
};

/**
 * 強制重置 Service Worker 與推播註冊
 */
export const forceResetPushSettings = async () => {
  try {
    // 1. 嘗試刪除 Token
    const messaging = getMessaging(app);
    await deleteToken(messaging);
    console.log("[Push] Token deleted.");
  } catch (e) {
    console.warn("[Push] Failed to delete token during reset", e);
  }

  // 2. 註銷所有 Service Workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      // 檢查是否為該死的殭屍 sub-scope
      const isZombie = registration.scope.includes('firebase-cloud-messaging-push-scope');
      await registration.unregister();
      console.log(`[Push] Unregistered ${isZombie ? 'ZOMBIE ' : ''}SW:`, registration.scope);
    }
  }

  // 3. 額外清除可能存在的過期快取
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.includes('firebase-messaging')) {
        await caches.delete(name);
        console.log("[Push] Deleted cache:", name);
      }
    }
  }

  // 3. 清除快取標記
  localStorage.removeItem('libao_push_prompt_dismissed');

  // 4. 強制重新載入
  window.location.reload();
};

// ==========================================
// 推播歷程 API
// ==========================================
export const getNotifications = async (userRole: string, limitCount = 50) => {
  if (!db) throw new Error("Firebase DB not initialized.");
  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const allNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // @ts-ignore
    return allNotifs.filter(n => {
      const validTopics = ['all', `tier_${userRole}`];
      const notif = n as any;
      if (notif.topics && Array.isArray(notif.topics)) {
        return notif.topics.some((t: string) => validTopics.includes(t));
      }
      return validTopics.includes(notif.topic);
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
};

/**
 * 即時監聽通知
 */
export const subscribeToNotifications = (
  userRole: string,
  uid: string | null,
  onUpdate: (notifs: any[]) => void
) => {
  if (!db) return () => { };

  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const allNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 過濾邏輯：
    // 1. topic = all
    // 2. topic = tier_{role}
    // 3. targetUid = {uid} (個人通知)
    const validTopics = ['all', `tier_${userRole}`];

    const filtered = allNotifs.filter((n: any) => {
      if (n.targetUid && uid && n.targetUid === uid) return true;

      const userTopics = ['all', `tier_${userRole}`];
      if (n.topics && Array.isArray(n.topics)) {
        return n.topics.some((t: string) => userTopics.includes(t));
      }
      if (n.topic && userTopics.includes(n.topic)) return true;
      return false;
    });

    onUpdate(filtered);
  }, (error) => {
    console.error("Notifications listener failed:", error);
  });
};

