"use client";
import { getApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

export async function registerForPushNotifications(): Promise<{ token: string } | { error: string }> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return { error: "Push notifications not supported in this browser" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "Notification permission denied — enable it in Chrome site settings" };
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/api/firebase-messaging-sw",
      { scope: "/" }
    );
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(getApp());
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return { error: "VAPID key not configured" };

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { error: "FCM returned empty token — check Firebase Cloud Messaging is enabled" };
    return { token };
  } catch (err) {
    console.error("FCM registration error:", err);
    return { error: err instanceof Error ? err.message : String(err) };
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
