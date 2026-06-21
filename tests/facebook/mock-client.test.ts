import { afterEach, describe, expect, test } from "vitest";

import { getFacebookClient, MockFacebookClient, RealFacebookClient } from "@/lib/facebook";

const samplePost = {
  message: "Sports day this Saturday",
  link: "https://portal.sriaawp.edu.my/news/sports-day",
};

describe("MockFacebookClient", () => {
  test("publishPost returns a deterministic objectId for a fixed call sequence", async () => {
    const first = await new MockFacebookClient().publishPost(samplePost);
    const second = await new MockFacebookClient().publishPost(samplePost);
    expect(first.objectId).toBe(second.objectId);
    expect(first.objectId).toMatch(/^mock_[0-9a-f]{8}_1$/);
  });

  test("the same content at a different call position yields a different objectId", async () => {
    const client = new MockFacebookClient();
    const first = await client.publishPost(samplePost);
    const second = await client.publishPost(samplePost);
    expect(first.objectId).not.toBe(second.objectId);
  });

  test("records each publish call in order for #85 assertions", async () => {
    const client = new MockFacebookClient();
    await client.publishPost(samplePost);
    await client.publishPost({ ...samplePost, message: "Updated" });
    const calls = client.recordedCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].sequence).toBe(1);
    expect(calls[1].input.message).toBe("Updated");
  });

  test("getPost returns the persisted post and null for an unknown id", async () => {
    const client = new MockFacebookClient();
    const { objectId } = await client.publishPost(samplePost);
    expect(await client.getPost(objectId)).toMatchObject({ objectId, imageUrl: null });
    expect(await client.getPost("missing")).toBeNull();
  });

  test("failOnPublish simulates a failure so #85 can exercise retry/outbox", async () => {
    const client = new MockFacebookClient({ failOnPublish: true });
    await expect(client.publishPost(samplePost)).rejects.toThrow(/simulated publish failure/);
  });
});

describe("getFacebookClient factory", () => {
  const original = process.env.FACEBOOK_CLIENT;

  afterEach(() => {
    if (original === undefined) delete process.env.FACEBOOK_CLIENT;
    else process.env.FACEBOOK_CLIENT = original;
  });

  test("defaults to the mock client when FACEBOOK_CLIENT is unset", () => {
    delete process.env.FACEBOOK_CLIENT;
    expect(getFacebookClient()).toBeInstanceOf(MockFacebookClient);
  });

  test("returns the mock client under FACEBOOK_CLIENT=mock", () => {
    process.env.FACEBOOK_CLIENT = "mock";
    expect(getFacebookClient()).toBeInstanceOf(MockFacebookClient);
  });

  test("returns the real stub under FACEBOOK_CLIENT=real and it throws on publish", async () => {
    process.env.FACEBOOK_CLIENT = "real";
    const client = getFacebookClient();
    expect(client).toBeInstanceOf(RealFacebookClient);
    await expect(client.publishPost(samplePost)).rejects.toThrow(/production turn-on step/);
  });
});
