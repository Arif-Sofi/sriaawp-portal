interface SendMagicLinkArgs {
  url: string;
  identifier: string;
  apiKey: string;
  from: string;
}

const SUBJECT = "Pautan Log Masuk Portal SRIAAWP / SRIAAWP Portal Sign-in Link";

function buildBody(url: string): string {
  return [
    `Klik pautan ini untuk log masuk: ${url}`,
    "",
    `Click this link to sign in: ${url}`,
    "",
    "Pautan akan tamat dalam 24 jam. / Link expires in 24 hours.",
  ].join("\n");
}

export async function sendMagicLink({
  url,
  identifier,
  apiKey,
  from,
}: SendMagicLinkArgs): Promise<void> {
  const liveKey = process.env.AUTH_RESEND_KEY;
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment || !liveKey) {
    console.log(`\n[auth] magic link for ${identifier} (dev fallback):\n${url}\n`);
    return;
  }

  const { Resend } = await import("resend");
  const client = new Resend(apiKey);
  const { error } = await client.emails.send({
    from,
    to: identifier,
    subject: SUBJECT,
    text: buildBody(url),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
