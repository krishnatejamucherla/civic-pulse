
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is missing from server/.env');
}

const ai = new GoogleGenAI({ apiKey });

const MODEL = 'gemini-3.5-flash-lite';
const MAX_ATTEMPTS = 3;

function isTemporaryError(error) {
  const status =
    error?.status ??
    error?.error?.code ??
    error?.code;

  const message = String(error?.message ?? error);

  return (
    [429, 500, 502, 503, 504].includes(Number(status)) ||
    /UNAVAILABLE|high demand|temporarily unavailable|overloaded|RESOURCE_EXHAUSTED/i.test(
      message
    )
  );
}

const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function verifyIssueImage(imagePath, category) {
  const fs = await import('node:fs/promises');

  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };

  const extension = imagePath
    .slice(imagePath.lastIndexOf('.'))
    .toLowerCase();

  const mimeType = mimeTypes[extension];

  if (!mimeType) {
    throw new Error('Unsupported image type');
  }

  const prompt = `You are checking a citizen's civic issue photo.
Selected category: "${category}".

Decide whether the image visibly supports this category.
Return JSON only with:
{
  "result": "likely_relevant" or "mismatch" or "needs_review",
  "reason": "short explanation"
}

Use "mismatch" only when the image is clearly unrelated.
Use "needs_review" when uncertain.
Do not claim you can prove the photo is genuine or unedited.`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              result: {
                type: 'STRING',
                enum: [
                  'likely_relevant',
                  'mismatch',
                  'needs_review',
                ],
              },
              reason: { type: 'STRING' },
            },
            required: ['result', 'reason'],
          },
        },
      });

      return JSON.parse(response.text);
    } catch (error) {
      if (
        !isTemporaryError(error) ||
        attempt === MAX_ATTEMPTS
      ) {
        console.error(
          `Image verification failed after ${attempt} attempt(s):`,
          error.message ?? error
        );

        throw error;
      }

      const delay = 1500 * 2 ** (attempt - 1);

      console.warn(
        `Gemini temporarily unavailable. ` +
        `Retrying in ${delay / 1000}s ` +
        `(attempt ${attempt + 1}/${MAX_ATTEMPTS}).`
      );

      await wait(delay);
    }
  }

  throw new Error('Image verification could not be completed');
}
