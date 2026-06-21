import type { ImageLink } from "@/lib/ai/envelope";

/**
 * Synthetic stand-in for the Mode 3 "how-to-use-this-system" manual.
 *
 * The real manual is PM-owned and does not exist yet (ADR-020 open dependency,
 * P0-Q18). This stand-in is a few short portal how-to sections used by spike #13
 * to retire the pgvector + Gemini retrieval risk against a tens-of-chunks corpus
 * WITHOUT waiting on the real manual. Each section is one task so it chunks
 * cleanly (one section -> one chunk -> one embedding). Image links are section
 * METADATA returned alongside the grounded text (ADR-006/020); they are never
 * embedded. The placeholder storage host stands in for the undecided image
 * bucket (ADR-020 open dependency).
 */

export type ManualSection = {
  sectionId: string;
  heading: string;
  body: string;
  imageLinks: ImageLink[];
};

const IMAGE_HOST = "https://storage.example/manual";

function screenshot(sectionId: string, file: string, caption: string): ImageLink {
  return { url: `${IMAGE_HOST}/${sectionId}/${file}`, caption, sectionId };
}

export const STAND_IN_MANUAL: ManualSection[] = [
  {
    sectionId: "parent-reads-news",
    heading: "How a parent reads news",
    body: "Sign in and open the parent dashboard. The News tab lists the latest school announcements you are allowed to see, newest first. Tap an article to read the full announcement; if it carries a photo or attachment, it appears inside the article. Use the search box at the top of the News tab to find an older announcement by keyword.",
    imageLinks: [
      screenshot("parent-reads-news", "news-tab.png", "The News tab on the parent dashboard"),
    ],
  },
  {
    sectionId: "parent-asks-question",
    heading: "How a parent asks a question about an announcement",
    body: "Open the announcement you have a question about and scroll to the comment box below it. Type your question and submit it; the teacher who owns that announcement is notified. You will get a notification when the teacher replies, and the reply appears directly under your question so the conversation stays with the announcement it belongs to.",
    imageLinks: [
      screenshot(
        "parent-asks-question",
        "comment-box.png",
        "The comment box below an announcement",
      ),
    ],
  },
  {
    sectionId: "teacher-answers-comment",
    heading: "How a teacher answers a parent comment",
    body: "When a parent comments on one of your announcements you receive a notification. Open the announcement, find the parent question in the comment thread, and post a reply. Your reply is shown as the answer to that question and the parent is notified. If a comment is inappropriate, use the moderation control to hide it; hidden comments stay on record but are no longer shown to readers.",
    imageLinks: [
      screenshot("teacher-answers-comment", "reply-control.png", "Replying to a parent comment"),
    ],
  },
  {
    sectionId: "admin-links-family",
    heading: "How an admin links a family",
    body: "Open the User Management screen and choose Link family. Enter the parent account and the student it should be connected to, or upload a CSV at the start of the school year to link many families at once. Once linked, the parent's dashboard shows that student's information. Only an admin can create or change a family link.",
    imageLinks: [
      screenshot(
        "admin-links-family",
        "link-family.png",
        "The Link family screen in User Management",
      ),
    ],
  },
  {
    sectionId: "ask-the-assistant",
    heading: "How to ask the portal assistant",
    body: "Open the assistant from the dashboard. You can ask it to explain the article you are reading, ask it to find recent news for you, or ask how to use a part of the portal. The assistant only answers from school information you are allowed to see and from this how-to manual; it will say it cannot help when a question falls outside that.",
    imageLinks: [screenshot("ask-the-assistant", "assistant.png", "The portal assistant panel")],
  },
];
