import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "crypto";

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns "<iv_hex>:<ciphertext_hex>:<auth_tag_hex>"
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), encrypted.toString("hex"), tag.toString("hex")].join(":");
}

/**
 * Decrypt a string produced by `encrypt`.
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted text format");
  const [ivHex, encHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  );
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  // Different lengths are never equal; still run comparison to avoid
  // leaking length via short-circuit timing.
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Dummy comparison to keep runtime roughly constant
    timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
