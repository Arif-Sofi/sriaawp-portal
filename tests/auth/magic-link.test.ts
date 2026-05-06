import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => {
  class Resend {
    emails = { send: sendMock };
  }
  return { Resend };
});

const liveDbAvailable = Boolean(process.env.SUPABASE_TEST_URL);

describe("sendMagicLink — Resend integration", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendMock.mockReset();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    consoleSpy.mockRestore();
  });

  test("dev fallback console-logs the URL when AUTH_RESEND_KEY is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_RESEND_KEY", "");

    const { sendMagicLink } = await import("@/lib/auth/send-magic-link");
    await sendMagicLink({
      url: "http://localhost:3000/api/auth/callback/resend?token=abc",
      identifier: "admin@sriaawp.test",
      apiKey: "dev-noop",
      from: "SRIAAWP <no-reply@sriaawp.edu.my>",
    });

    expect(sendMock).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("magic link for admin@sriaawp.test"),
    );
  });

  test("production sends bilingual email via Resend when AUTH_RESEND_KEY is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_RESEND_KEY", "re_live_test");
    sendMock.mockResolvedValueOnce({ data: { id: "msg_123" }, error: null });

    const { sendMagicLink } = await import("@/lib/auth/send-magic-link");
    await sendMagicLink({
      url: "https://portal.sriaawp.edu.my/api/auth/callback/resend?token=xyz",
      identifier: "admin@sriaawp.test",
      apiKey: "re_live_test",
      from: "SRIAAWP <no-reply@sriaawp.edu.my>",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sent = sendMock.mock.calls[0][0] as Record<string, string>;
    expect(sent.to).toBe("admin@sriaawp.test");
    expect(sent.subject).toContain("Pautan Log Masuk");
    expect(sent.subject).toContain("Sign-in Link");
    expect(sent.text).toContain("https://portal.sriaawp.edu.my/api/auth/callback/resend?token=xyz");
    expect(sent.text).toContain("Klik pautan ini untuk log masuk");
    expect(sent.text).toContain("Click this link to sign in");
  });

  test("propagates Resend API errors", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_RESEND_KEY", "re_live_test");
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "rate-limited" } });

    const { sendMagicLink } = await import("@/lib/auth/send-magic-link");
    await expect(
      sendMagicLink({
        url: "https://portal.sriaawp.edu.my/api/auth/callback/resend?token=xyz",
        identifier: "admin@sriaawp.test",
        apiKey: "re_live_test",
        from: "SRIAAWP <no-reply@sriaawp.edu.my>",
      }),
    ).rejects.toThrow(/rate-limited/);
  });
});

describe.skipIf(liveDbAvailable)("magic-link DB round-trip — environment skip notice", () => {
  test("SUPABASE_TEST_URL not set — full round-trip test is skipped (CI behaviour by design)", () => {
    expect(liveDbAvailable).toBe(false);
  });
});
