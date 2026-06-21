import { google } from "@ai-sdk/google";

export const GENERATION_MODEL_ID = "gemini-2.5-flash";

export const generationModel = google(GENERATION_MODEL_ID);
