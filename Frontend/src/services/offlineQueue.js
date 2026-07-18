import { idbPut, idbDelete, idbGetAll } from "./db";

// A generic "do this when we're back online" queue, backed by IndexedDB so
// queued actions survive a full app restart, not just a network blip.
//
// This app is currently a front-end demo with no real backend — nothing
// calls `enqueue()` yet, because there's no real network request whose
// failure would need queuing. This module exists so that the moment you
// wire up real API calls (send money, link a bank, etc.), you have a
// tested, ready-to-use "queue it if offline, replay it when back" utility
// instead of needing to build one under deadline pressure.
//
// Usage once you have a real API:
//   import { enqueue, flushQueue, onQueueChange } from "./services/offlineQueue";
//
//   async function sendMoney(payload) {
//     if (!navigator.onLine) {
//       await enqueue({ type: "send-money", payload });
//       return { queued: true };
//     }
//     return api.sendMoney(payload);
//   }
//
//   // register the handler that knows how to replay each action type
//   registerHandler("send-money", (payload) => api.sendMoney(payload));
//
// Security note: IndexedDB is unencrypted, on-device storage. Queued
// payloads sit there in plaintext until successfully flushed, which is
// fine for things like "send $50 to Alex" but not for secrets — never
// queue a PIN, OTP, or Secure ID itself; queue the already-authenticated
// request instead (e.g. a short-lived session token the backend issued
// after that PIN/OTP was verified, not the PIN/OTP).

const handlers = new Map();
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function registerHandler(type, fn) {
  handlers.set(type, fn);
}

export async function enqueue(action) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    ...action,
  };
  await idbPut("offlineQueue", record);
  notify();
  return record;
}

export async function getQueue() {
  const all = await idbGetAll("offlineQueue");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

let flushInFlight = null;

export async function flushQueue() {
  // Coalesce concurrent calls (e.g. the network flapping on/off quickly)
  // into a single in-flight run, so an action never gets replayed twice
  // just because two flushes overlapped.
  if (flushInFlight) return flushInFlight;
  flushInFlight = runFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function runFlush() {
  if (!navigator.onLine) return { flushed: 0, remaining: (await getQueue()).length };
  const queue = await getQueue();
  let flushed = 0;
  for (const action of queue) {
    const handler = handlers.get(action.type);
    if (!handler) continue; // no handler registered yet — leave it queued
    try {
      await handler(action.payload, action);
      await idbDelete("offlineQueue", action.id);
      flushed += 1;
    } catch {
      // stop on first failure so actions replay in order and we don't
      // silently drop something that still can't go through
      break;
    }
  }
  notify();
  const remaining = (await getQueue()).length;
  return { flushed, remaining };
}

export function onQueueChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue().catch(() => {});
  });
}
