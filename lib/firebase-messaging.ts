"use client";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, app } from "./firebase";

export async function requestAndSaveToken(uid: string): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    // Register (or reuse) the dynamically-served FCM worker on its own scope so it
    // doesn't collide with the PWA service worker registered at "/".
    const registration = await navigator.serviceWorker.register("/api/firebase-messaging-sw", {
      scope: "/firebase-cloud-messaging-push-scope",
    });
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      const tokenId = token.slice(-24);
      await setDoc(doc(db, `users/${uid}/fcm_tokens`, tokenId), {
        token,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent.slice(0, 200),
      });
    }

    return token ?? null;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
}

export async function removeToken(uid: string, token: string): Promise<void> {
  try {
    const { getMessaging, deleteToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    await deleteToken(messaging);
    const tokenId = token.slice(-24);
    await deleteDoc(doc(db, `users/${uid}/fcm_tokens`, tokenId));
  } catch (err) {
    console.error("FCM remove token error:", err);
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/api/firebase-messaging-sw", {
      scope: "/firebase-cloud-messaging-push-scope",
    });
    return reg;
  } catch (err) {
    console.error("SW registration error:", err);
    return null;
  }
}
