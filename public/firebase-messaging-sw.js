importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// 透過註冊 SW 時傳入的 Query String 動態取得 Firebase 設定
// 避免將環境變數直接硬編碼在 Public 目錄下
const params = new URL(location).searchParams;
const firebaseConfig = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    storageBucket: params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
};

// 只有當參數存在時才初始化，避免預設安裝時報錯
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // 背景推播接收處理
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        // 如果有自訂的 title 與 body 則顯示
        const notificationTitle = payload.notification?.title || '新的系統通知';
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: payload.notification?.image || '/vite.svg', // 可換成您的 icon
            data: payload.data || {} // 夾帶傳過來的 deep link url 等資訊
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
}

// 處理點擊推播通知
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // 嘗試從推播的 data 中取得深層連結 (Deep link)
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // 尋找是否已經有開啟我們網站的 Tab (PWA 實例 或 普通 Browser)
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url.indexOf(self.registration.scope) >= 0 && 'focus' in client) {
                    // 已經開啟的話，喚醒該畫面並嘗試透過前端路由導航
                    client.focus();
                    // 若要觸發 SPA 導航，也可以用 client.postMessage 要求前端轉址
                    return client.navigate(targetUrl);
                }
            }
            // 如果完全沒有開啟，則開新視窗/PWA 實例
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
