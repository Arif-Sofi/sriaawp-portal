import type { FacebookClient } from "./client";
import { MockFacebookClient } from "./mock-client";
import { RealFacebookClient } from "./real-client";

export type {
  FacebookClient,
  FacebookClientHealth,
  FacebookPost,
  PublishPostInput,
  PublishPostResult,
} from "./client";
export { MockFacebookClient } from "./mock-client";
export { RealFacebookClient } from "./real-client";

/**
 * getFacebookClient selects the implementation by the FACEBOOK_CLIENT env var.
 * Default is "mock" (mock-first per ADR-022): development and CI never call the real
 * Graph API, and "real" is a production turn-on step that fails loudly until the
 * RealFacebookClient stub is fleshed out behind the school's owned Meta app.
 */
export const getFacebookClient = (): FacebookClient => {
  const selected = process.env.FACEBOOK_CLIENT ?? "mock";
  if (selected === "real") return new RealFacebookClient();
  return new MockFacebookClient();
};
