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

export default async function handler(req, res) {
    // 1. Verify Request Method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Secret Verification (Security)
    // Check if 'secret' query param matches environment variable
    const { secret } = req.query;
    if (!process.env.KAJABI_SECRET || secret !== process.env.KAJABI_SECRET) {
        console.warn("Unauthorized webhook attempt. Invalid or missing secret.");
        // Intentionally vague error to avoid leaking secret existence
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // 3. Parse Request Body & Query
        // Vercel automatically parses JSON bodies.
        // If it's x-www-form-urlencoded, req.body works too.
        const body = req.body || {};

        // Kajabi fields (payload usually contains these)
        // Note: Kajabi might nest data differently depending on the event, 
        // but typically 'email', 'name', 'external_user_id' are at root or inside 'payload'
        // We will look at root first.
        const { email, name, external_user_id } = body;

        // Query parameters dictate the action and role
        const { action, role } = req.query;

        console.log(`Received Webhook: Action=${action}, Role=${role}, Email=${email}`);

        if (!email || !action || !role) {
            return res.status(400).json({ error: 'Missing required fields (email, action, or role)' });
        }

        const userEmail = email.toLowerCase().trim();
        const userRef = db.collection('users').doc(userEmail);

        // 4. Perform Firestore Update
        if (action === 'activate') {
            await userRef.set({
                email: userEmail,
                name: name || '', // Optional update if name exists
                roles: admin.firestore.FieldValue.arrayUnion(role),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                kajabiId: external_user_id || null // Optional sync
            }, { merge: true }); // Merge ensures we don't overwrite existing fields like 'createdAt'

            console.log(`Activated role '${role}' for user '${userEmail}'`);

        } else if (action === 'deactivate') {
            // Check if user exists before trying to remove role (optional, but good practice)
            const doc = await userRef.get();
            if (doc.exists) {
                await userRef.update({
                    roles: admin.firestore.FieldValue.arrayRemove(role),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Deactivated role '${role}' for user '${userEmail}'`);
            } else {
                console.log(`User '${userEmail}' not found, skipping deactivation.`);
            }

        } else {
            return res.status(400).json({ error: 'Invalid action. Must be activate or deactivate.' });
        }

        // 5. Success Response
        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error("Webhook processing error:", error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
