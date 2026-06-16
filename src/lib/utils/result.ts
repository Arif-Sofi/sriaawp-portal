export type FieldErrors = Record<string, string>;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  options?: { code?: string; fieldErrors?: FieldErrors },
): ActionResult<never> {
  return { ok: false, error, code: options?.code, fieldErrors: options?.fieldErrors };
}
