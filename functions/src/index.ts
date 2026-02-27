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

    const { title, body, topics = ["all"], url = "/" } = data;
    if (!title || !body) throw new functions.https.HttpsError("invalid-argument", "標題與內容為必填。");

    try {
        let response;
        if (topics.length === 1) {
            // 單一主題發送
            const message = {
                notification: { title, body },
                data: { url },
                topic: topics[0],
            };
            response = await admin.messaging().send(message);
        } else {
            // 多主題發送 (使用 Condition 邏輯)
            // 格式: "'topic1' in topics || 'topic2' in topics"
            const condition = topics.map((t: string) => `'${t}' in topics`).join(' || ');
            const message = {
                notification: { title, body },
                data: { url },
                condition: condition,
            };
            response = await admin.messaging().send(message);
        }

        console.log(`[Push] Multicast/Broadcast sent by ${context.auth.uid}, messageId: ${response}`);

        // 寫入廣播歷程到資料庫 (存入 topics 陣列方便前端過濾)
        await admin.firestore().collection('notifications').add({
            title,
            body,
            topics: topics, // 存入陣列
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

/**
 * [Callable] 發送個人推播 (Direct Message)
 * 針對特定 UID 進行精準通知，並清理失效 Token
 */
export const sendDirectMessage = functions.https.onCall(async (data, context) => {
    // 1. 安全與權限檢查
    if (!context.app) throw new functions.https.HttpsError("failed-precondition", "App Check 失敗");
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "未登入");

    const isAdmin = await checkIsAdmin(context.auth.uid);
    if (!isAdmin) throw new functions.https.HttpsError("permission-denied", "權限不足");

    const { targetUid, title, body, url = "/" } = data;
    if (!targetUid || !title || !body) throw new functions.https.HttpsError("invalid-argument", "參數缺失");

    // 2. 找出目標用戶的所有有效 Tokens
    const tokensSnapshot = await admin.firestore()
        .collection('fcm_tokens')
        .where('uid', '==', targetUid)
        .where('status', '==', 'active')
        .get();

    if (tokensSnapshot.empty) {
        return { success: false, reason: "該用戶沒有已登記的有效 Token" };
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.id);

    // 3. 逐一發送 (或是 Multicast)
    // 使用 sendEachForMulticast 可以一次發給多個 Token
    const message = {
        notification: { title, body },
        data: { url },
        tokens: tokens,
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);

        // 4. 清理無效 Token (Maintenance) 與 錯誤診斷
        const errors: string[] = [];
        if (response.failureCount > 0) {
            const cleanupPromises: Promise<any>[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error as any;
                    errors.push(`Token[${idx}]: ${error?.code || 'unknown'} - ${error?.message || ''}`);

                    if (error?.code === 'messaging/registration-token-not-registered' ||
                        error?.code === 'messaging/invalid-registration-token' ||
                        error?.code === 'messaging/mismatched-sender-id') {
                        const invalidToken = tokens[idx];
                        console.log(`[Push] Cleaning up invalid token: ${invalidToken} due to ${error.code}`);
                        cleanupPromises.push(admin.firestore().collection('fcm_tokens').doc(invalidToken).delete());
                    }
                }
            });
            await Promise.all(cleanupPromises);
        }

        // 5. 紀錄到通知歷程
        await admin.firestore().collection('notifications').add({
            title,
            body,
            url,
            targetUid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            senderUid: context.auth.uid,
            type: 'direct_message'
        });

        console.log(`[Push] Direct message sent to ${targetUid}, successes: ${response.successCount}, failures: ${response.failureCount}`);

        return {
            success: response.successCount > 0,
            successCount: response.successCount,
            failureCount: response.failureCount,
            errors: errors // 回傳給前端看
        };
    } catch (error: any) {
        console.error("[Push] Direct Send error:", error);
        throw new functions.https.HttpsError("internal", error.message || "發送個人推播時發生錯誤");
    }
});

