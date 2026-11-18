// Free text that staff type (task and matter titles, timeline messages,
// document titles, notifications, report titles) can name clients, so it is
// stored encrypted with the firm's key. Rows written before encryption keep
// their clear text until `ops encrypt-free-text` moves it; reads fall back to
// it meanwhile.
import { decryptJson, encryptJson } from './privacy.service';

/** Encrypt the fields for storage. */
export function seal(fields: Record<string, string>): Promise<string> {
  return encryptJson(fields);
}

/** The stored fields: decrypted when encrypted, otherwise the legacy clear text. */
export async function unseal<T extends Record<string, string>>(
  encrypted: string | null | undefined,
  legacy: T,
): Promise<T> {
  if (!encrypted) {
    return legacy;
  }
  const fields = await decryptJson<Partial<T>>(encrypted);
  return { ...legacy, ...(fields ?? {}) };
}
