// A lightweight RFC4122 v4-shaped id — used only as client_uuid for
// idempotent visit/order submission (lets a retried request be recognized
// as "the same one" by the server), not as a security token. Math.random is
// an acceptable source of randomness for that purpose; if this project ever
// needs cryptographically strong ids client-side, use expo-crypto instead.
export function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
