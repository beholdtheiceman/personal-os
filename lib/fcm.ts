"use client";
import { getApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

export async function registerForPushNotifications(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const registration = await navigator.serviceWorker.register(
      "/api/firebase-messaging-sw",
      { scope: "/" }
    );

    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token ?? null;
  } catch (err) {
    console.error("FCM registration error:", err);
    return null;
  }
}

export async function getExistingToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const reg = registrations.find((r) => r.active?.scriptURL.includes("firebase-messaging-sw"));
    if (!reg) return null;

    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    return token ?? null;
  } catch {
    return null;
  }
}
