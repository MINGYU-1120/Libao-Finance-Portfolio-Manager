import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * 輔助函式：檢查是否為管理員
 */
async function checkIsAdmin(uid: string): Promise<boolean> {
    const userDoc = await admin.firestore().collection('user_directory').doc(uid).get();
    return userDoc.exists && userDoc.data()?.role === 'admin';
}

/**
 * [Callable] 訂閱推播主題
 * 當前端取得 Token 後呼叫，確保 Token 與當前權限等級對齊
 */
export const subscribeToTopic = functions.https.onCall(async (data, context) => {
    // 1. 安全檢查：App Check (防止非授權客戶端惡意呼叫)
    if (!context.app) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "這項要求未通過 App Check 驗證，拒絕執行。"
        );
    }

    // 2. 身份檢查
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "用戶必須登入才能訂閱通知。");
    }

    const { token } = data;
    if (!token) throw new functions.https.HttpsError("invalid-argument", "缺少 FCM Token。");

    const uid = context.auth.uid;
    const userDoc = await admin.firestore().collection('user_directory').doc(uid).get();
    const role = userDoc.data()?.role || 'viewer';

    try {
        // 訂閱全體廣播主題
        await admin.messaging().subscribeToTopic(token, "all");

        // 訂閱角色專屬主題 (例如 tier_admin, tier_member)
        const topicName = `tier_${role}`;
        await admin.messaging().subscribeToTopic(token, topicName);

        console.log(`[Push] User ${uid} subscribed to ${topicName}`);
        return { success: true, subscribedTopic: topicName };
    } catch (error) {
        console.error("[Push] Subscription error:", error);
        throw new functions.https.HttpsError("internal", "訂閱過程中發生錯誤");
    }
});

/**
 * [Callable] 管理員群發推播
 * 只有 role === 'admin' 的人才可執行
 */
export const sendBroadcast = functions.https.onCall(async (data, context) => {
    // 1. 安全檢查：App Check
    if (!context.app) {
        throw new functions.https.HttpsError("failed-precondition", "App Check 驗證失敗。");
    }

    // 2. 權限檢查 (RBAC)
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "請先登入。");

    const isAdmin = await checkIsAdmin(context.auth.uid);
    if (!isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "您沒有發送廣播推播的權限。");
    }

    const { title, body, topic = "all", url = "/" } = data;
    if (!title || !body) throw new functions.https.HttpsError("invalid-argument", "標題與內容為必填。");

    const message = {
        notification: { title, body },
        data: { url },
        topic: topic,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log(`[Push] Broadcast sent by ${context.auth.uid}, messageId: ${response}`);

        // 寫入廣播歷程到資料庫
        await admin.firestore().collection('notifications').add({
            title,
            body,
            topic,
            url,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            senderUid: context.auth.uid,
            type: 'system_broadcast'
        });

        return { success: true, messageId: response };
    } catch (error) {
        console.error("[Push] Send error:", error);
        throw new functions.https.HttpsError("internal", "發送推播失敗");
    }
});
