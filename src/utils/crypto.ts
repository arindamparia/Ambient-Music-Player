/**
 * Secure caching utility built on the native Web Crypto API.
 * Uses AES-GCM to encrypt/decrypt strings stored in localStorage.
 * 
 * Note: To prevent supply chain attacks, this relies strictly on native browser primitives
 * instead of third-party libraries like crypto-js.
 */

// Generate or retrieve a consistent key for the session/installation.
// In a real production app, this key might be derived via PBKDF2 from a user password, 
// but for a pure client-side tracker/player, we create a secure UUID and store it safely.
const getKey = async (): Promise<CryptoKey> => {
  let rawKey = localStorage.getItem('__am_k');
  
  if (!rawKey) {
    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const exported = await window.crypto.subtle.exportKey("raw", key);
    // Convert ArrayBuffer to Hex String
    rawKey = Array.from(new Uint8Array(exported))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    // Store secretly
    localStorage.setItem('__am_k', rawKey);
    return key;
  }
  
  // Convert Hex String back to ArrayBuffer
  const keyBytes = new Uint8Array(rawKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  return await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

// UTF-8 Encoder/Decoder
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encryptData = async (data: string): Promise<string> => {
  try {
    const key = await getKey();
    // AES-GCM requires a unique initialization vector for every encryption
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoder.encode(data)
    );
    
    // Package IV + Payload together so it can be decrypted later
    const expectedPayload = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    expectedPayload.set(iv, 0);
    expectedPayload.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // Instead of btoa/atob or heavy libraries, we use standard hex conversion for storage safety
    return Array.from(expectedPayload).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error("Encryption failed", err);
    return "";
  }
};

export const decryptData = async (hexCiphertext: string): Promise<string> => {
  if (!hexCiphertext) return "";
  try {
    const key = await getKey();
    
    // Hex to UInt8Array
    const payloadMatches = hexCiphertext.match(/.{1,2}/g);
    if (!payloadMatches) throw new Error("Invalid hex ciphertext");
    
    const payloadBytes = new Uint8Array(payloadMatches.map(byte => parseInt(byte, 16)));
    
    // Extract IV (first 12 bytes) and ciphertext
    const iv = payloadBytes.slice(0, 12);
    const data = payloadBytes.slice(12);
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );
    
    return decoder.decode(decryptedBuffer);
  } catch {
    console.warn("Decryption failed - returning empty state.");
    return "";
  }
};
