import { sql } from "drizzle-orm";

import { fbCredential } from "@/db/schema";
import { db } from "@/lib/db";

// The long-lived Page token is a high-value secret (ADR-022/ADR-008/ADR-016). It is stored
// pgcrypto-encrypted (bytea via pgp_sym_encrypt) under FACEBOOK_TOKEN_KEY, mirroring the IC-number
// pattern — never plaintext, never in .env. The MOCK outbound path never reads this value and never
// networks it; building the encrypted store now makes turn-on a config change, not a code change.
const encryptionKey = (): string => {
  const key = process.env.FACEBOOK_TOKEN_KEY;
  if (!key) throw new Error("FACEBOOK_TOKEN_KEY is required to store the Facebook Page token");
  return key;
};

export const storePageCredential = async (input: {
  pageId: string;
  pageToken: string;
}): Promise<{ id: string }> => {
  const key = encryptionKey();
  const [row] = await db
    .insert(fbCredential)
    .values({
      pageId: input.pageId,
      pageTokenEncrypted: sql`pgp_sym_encrypt(${input.pageToken}, ${key})`,
    })
    .returning({ id: fbCredential.id });
  return row;
};

export const readPageCredential = async (): Promise<{
  pageId: string | null;
  pageToken: string;
} | null> => {
  const key = encryptionKey();
  const [row] = await db
    .select({
      pageId: fbCredential.pageId,
      pageToken: sql<string>`pgp_sym_decrypt(${fbCredential.pageTokenEncrypted}, ${key})`,
    })
    .from(fbCredential)
    .orderBy(sql`${fbCredential.updatedAt} desc`)
    .limit(1);
  if (!row) return null;
  return row;
};
