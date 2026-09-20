import OpenAI from "openai";

import { searchBookSegments } from "@/lib/actions/book.actions";
import { isBookGreeting } from "@/lib/utils";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

const GLM_MODEL = "z-ai/glm-5.3-flash";

const getOpenAIClient = () => {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured in server environment.");
  }

  return new OpenAI({
    baseURL: NVIDIA_BASE_URL,
    apiKey,
    timeout: 90_000,
  });
};

const GLM_SYSTEM_PROMPT = `You are Bookified, a book question-answering assistant.

Answer the user's question using ONLY the provided book context.

Rules:
- Give a direct answer.
- Keep the answer concise.
- Usually answer in 2-5 sentences.
- Do not dump the source text.
- Do not mention retrieval, segments, or context.
- If the answer is not present in the context, say you could not find it in this book.`;

export type GenerateBookAnswerParams = {
  question: string;
  context: string;
  bookName: string;

  // Added for streaming Chat responses
  onToken?: (token: string) => void;
};

export type RetrievedSegment = {
  content?: string;
  segmentIndex?: number;
  pageNumber?: number;
};

export function buildBookContext(
  segments: (RetrievedSegment | Record<string, unknown>)[],
  maxCharacters: number = 12000,
): string {
  if (!Array.isArray(segments) || segments.length === 0) {
    return "";
  }

  let totalChars = 0;
  const contextChunks: string[] = [];

  for (const item of segments) {
    const rawContent =
      typeof item === "string"
        ? item
        : typeof item?.content === "string"
          ? item.content
          : "";

    const cleanContent = rawContent.trim();

    if (!cleanContent) continue;

    if (
      totalChars + cleanContent.length > maxCharacters &&
      totalChars > 0
    ) {
      break;
    }

    const remainingCharacters = maxCharacters - totalChars;

    const boundedContent = cleanContent.slice(
      0,
      remainingCharacters,
    );

    contextChunks.push(boundedContent);

    totalChars += boundedContent.length;

    if (totalChars >= maxCharacters) {
      break;
    }
  }

  return contextChunks.join("\n\n---\n\n");
}

export async function generateBookAnswer({
  question,
  context,
  bookName,
  onToken,
}: GenerateBookAnswerParams): Promise<string> {
  const safeBookName = bookName.trim() || "Selected Book";
  const trimmedQuestion = question.trim();
  const trimmedContext = context.trim();

  if (!trimmedContext) {
    return "I couldn't find enough information about that topic in this book.";
  }

  try {
    const client = getOpenAIClient();

    const stream = await client.chat.completions.create({
      model: GLM_MODEL,
      temperature: 0.2,

      messages: [
        {
          role: "system",
          content: GLM_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Book:
${safeBookName}

Retrieved context:
${trimmedContext}

User question:
${trimmedQuestion}`,
        },
      ],

      stream: true,
      max_tokens: 200,

      // NVIDIA/GLM extension
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      reasoning_effort: "low",
    });

    let answer = "";

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;

      if (delta) {
        answer += delta;

        // Send every generated token/chunk to the caller
        onToken?.(delta);
      }
    }

    const finalAnswer = answer.trim();

    if (!finalAnswer) {
      console.warn("[BookAI] GLM-5.3 returned an empty response.");

      return "Sorry, I couldn't generate an answer right now. Please try again.";
    }

    return finalAnswer;
  } catch (error) {
    console.error("[BookAI] Error generating answer with GLM-5.3:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return "Sorry, I couldn't generate an answer right now. Please try again.";
  }
}

export type AnswerBookQuestionParams = {
  bookId: string;
  bookName: string;
  query: string;

  // Added because /api/chat passes onToken
  onToken?: (token: string) => void;
};

export type AnswerBookQuestionResult = {
  found: boolean;
  isGreeting?: boolean;
  answer: string;
  results?: unknown[];
};

export async function answerBookQuestion({
  bookId,
  bookName,
  query,
  onToken,
}: AnswerBookQuestionParams): Promise<AnswerBookQuestionResult> {
  const trimmedQuery = query.trim();

  if (isBookGreeting(trimmedQuery)) {
    return {
      found: false,
      isGreeting: true,
      answer: "Hi! Ask me anything about this book.",
      results: [],
    };
  }

  const searchResult = await searchBookSegments(
    bookId,
    trimmedQuery,
    3,
  );

  if (
    !searchResult.success ||
    !searchResult.found ||
    !searchResult.data?.length
  ) {
    console.log(
      `[BookAI] bookId: ${bookId}, bookName: "${bookName}", query: "${trimmedQuery}", retrievedSegments: 0, contextCharacters: 0, model: "${GLM_MODEL}", answerGenerated: false`,
    );

    return {
      found: false,
      isGreeting: false,
      answer:
        "I couldn't find enough information about that topic in this book.",
      results: [],
    };
  }

  const context = buildBookContext(searchResult.data);

  const answer = await generateBookAnswer({
    question: trimmedQuery,
    context,
    bookName,
    onToken,
  });

  const answerGenerated = Boolean(
    answer &&
      !answer.startsWith("Sorry, I couldn't generate") &&
      !answer.startsWith("I couldn't find enough information"),
  );

  console.log(
    `[BookAI] bookId: ${bookId}, bookName: "${bookName}", query: "${trimmedQuery}", retrievedSegments: ${searchResult.data.length}, contextCharacters: ${context.length}, model: "${GLM_MODEL}", answerGenerated: ${answerGenerated}`,
  );

  return {
    found: true,
    isGreeting: false,
    answer,
    results: searchResult.data,
  };
}