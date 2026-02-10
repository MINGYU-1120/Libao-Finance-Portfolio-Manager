import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// This runs only once per cold start, ensuring we don't re-initialize on every request.
if (!admin.apps.length) {
    try {
        // Assume FIREBASE_SERVICE_ACCOUNT is a JSON string in environment variable
        // In ESM, process.env is still available in Vercel/Node environment
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin SDK initialized successfully");
    } catch (error) {
        console.error("Failed to initialize Firebase Admin SDK:", error);
    }
}

const db = admin.firestore();

// --- 1. 定義 Offer ID 與 Role 的對應表 ---
// 請在這裡填入您 Kajabi Offer 的 ID
const OFFER_ROLE_MAP = {
    "2148785678": "member",      // 範例：標準會員 Offer ID
    "2150744912": "vip",         // 範例：VIP頭等艙 Offer ID
    // 您可以繼續新增更多對應...
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { secret } = req.query;
    if (!process.env.KAJABI_SECRET || secret !== process.env.KAJABI_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const body = req.body || {};
        const event = body.event; // 例如: 'offer_granted' 或 'offer_revoked'
        const payload = body.payload || {};

        // 2. 解析 Kajabi 傳來的資訊 (處理可能嵌套的結構)
        const email = (payload.member?.email || body.email || "").toLowerCase().trim();
        const name = payload.member?.name || body.name || "";
        const offerId = String(payload.offer?.id || "");

        // 3. 決定使用的 Role
        // 優先權：URL 參數指定 > 對應表判定
        let role = req.query.role || OFFER_ROLE_MAP[offerId];

        console.log(`[Kajabi Webhook] Event=${event}, OfferID=${offerId}, Email=${email}, SelectedRole=${role}`);

        if (!email) {
            return res.status(400).json({ error: 'Missing email' });
        }

        if (!role) {
            console.warn(`[Kajabi] Offer ID ${offerId} has no mapped role and no role param provided.`);
            return res.status(200).json({ ok: true, message: 'No role action taken' });
        }

        const userRef = db.collection('users').doc(email);

        // 4. 根據事件動作
        // 支援多種「授予權限」的事件名稱
        const isGrantEvent = [
            'offer_granted',
            'offer_purchased',
            'payment_succeeded',
            'cart_purchase'
        ].includes(event) || req.query.action === 'activate';

        if (isGrantEvent) {
            await userRef.set({
                email,
                name: name || '',
                roles: admin.firestore.FieldValue.arrayUnion(role),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                kajabi_last_event: event,
                kajabi_offer_id: offerId
            }, { merge: true });

            console.log(`[Kajabi] Success: Activated '${role}' for ${email}`);
        }
        // 支援「移除權限」的事件
        else if (event === 'offer_revoked' || req.query.action === 'deactivate') {
            await userRef.update({
                roles: admin.firestore.FieldValue.arrayRemove(role),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                kajabi_last_event: event
            });
            console.log(`[Kajabi] Success: Deactivated '${role}' for ${email}`);
        }

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error("Webhook processing error:", error);
        return res.status(500).json({ error: 'Internal error', details: error.message });
    }
}
