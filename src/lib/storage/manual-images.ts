import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ImageLink } from "@/lib/ai/envelope";

/**
 * Mode-3 manual image resolver (issue #81, Q19/#89 resolved to Supabase Storage).
 *
 * Bucket split (ADR-020/ADR-019-consistent):
 *   - PUBLIC bucket (MANUAL_PUBLIC_BUCKET): public-safe screenshots, anonymously
 *     fetchable via a stable public URL. Default path in v1 — the manual is a
 *     single uniformly-visible corpus, so every section image goes here.
 *   - INTERNAL bucket (MANUAL_INTERNAL_BUCKET): admin/staff-workflow screenshots,
 *     private. Served via a SHORT-LIVED SIGNED URL minted only after an app-layer
 *     visibility check passes. Built now so a future split corpus is a content
 *     re-tag, not a code change.
 *
 * Storage path convention: image_urls entries are EITHER an already-resolvable
 * absolute URL (the stand-in uses these) OR a "<bucket>:<object-path>" reference
 * the real manual ingest can write once the buckets exist. Absolute URLs pass
 * through unchanged; bucket references resolve through Supabase Storage.
 *
 * TURN-ON wiring (no SQL migration — buckets are a Storage API/dashboard action):
 *   1. Create bucket `manual-images-public` as PUBLIC.
 *   2. Create bucket `manual-images-internal` as PRIVATE.
 *   3. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (already in
 *      .env.example). The service-role key signs internal URLs server-side only.
 */

export const MANUAL_PUBLIC_BUCKET = "manual-images-public";
export const MANUAL_INTERNAL_BUCKET = "manual-images-internal";

const SIGNED_URL_TTL_SECONDS = 60;
const BUCKET_REF_SEPARATOR = ":";

export type ResolvedImage = {
  url: string;
  caption: string | null;
  sectionId: string;
};

type BucketReference = {
  bucket: string;
  objectPath: string;
};

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to resolve manual images`);
  return value;
}

let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  serviceClient = createClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  return serviceClient;
}

function parseBucketReference(value: string): BucketReference | null {
  if (value.startsWith("http")) return null;
  const separatorIndex = value.indexOf(BUCKET_REF_SEPARATOR);
  if (separatorIndex < 0) return null;
  return {
    bucket: value.slice(0, separatorIndex),
    objectPath: value.slice(separatorIndex + 1),
  };
}

function publicUrlFor(reference: BucketReference): string {
  const { data } = getServiceClient()
    .storage.from(reference.bucket)
    .getPublicUrl(reference.objectPath);
  return data.publicUrl;
}

async function signedUrlFor(reference: BucketReference): Promise<string> {
  const { data, error } = await getServiceClient()
    .storage.from(reference.bucket)
    .createSignedUrl(reference.objectPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error(`manual image sign failed for ${reference.objectPath}`);
  return data.signedUrl;
}

async function resolveOne(link: ImageLink, canSeeInternal: boolean): Promise<ResolvedImage | null> {
  const reference = parseBucketReference(link.url);
  if (!reference) return { url: link.url, caption: link.caption, sectionId: link.sectionId };

  if (reference.bucket === MANUAL_INTERNAL_BUCKET) {
    if (!canSeeInternal) return null;
    const signed = await signedUrlFor(reference);
    return { url: signed, caption: link.caption, sectionId: link.sectionId };
  }

  return { url: publicUrlFor(reference), caption: link.caption, sectionId: link.sectionId };
}

/**
 * Resolve a chunk's image links to fetchable URLs. Public/absolute links pass
 * through or get a public URL; internal-bucket links are dropped unless the
 * caller passes the app-layer visibility check, in which case a short-lived
 * signed URL is minted. v1 callers pass canSeeInternal=false (uniform corpus).
 */
export async function resolveManualImages(
  links: ImageLink[],
  canSeeInternal = false,
): Promise<ResolvedImage[]> {
  const resolved = await Promise.all(links.map((link) => resolveOne(link, canSeeInternal)));
  return resolved.filter((image): image is ResolvedImage => image !== null);
}
