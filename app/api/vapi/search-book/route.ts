import { NextResponse } from "next/server";

import { answerBookQuestion } from "@/lib/ai";
import { isBookGreeting } from "@/lib/utils";
import mongoose from "mongoose";

// Helper function to process book search logic
async function processBookSearch(bookId: unknown, query: unknown) {
  // Validate inputs before conversion to prevent null/undefined becoming "null"/"undefined" strings
  if (bookId == null || query == null || query === "") {
    return { result: "Missing bookId or query" };
  }

  // Convert bookId to string
  const bookIdStr = String(bookId);
  const queryStr = String(query).trim();

  // Additional validation after conversion
  if (
    !bookIdStr ||
    bookIdStr === "null" ||
    bookIdStr === "undefined" ||
    !queryStr ||
    !mongoose.isValidObjectId(bookIdStr)
  ) {
    return { result: "Missing bookId or query" };
  }

  if (isBookGreeting(queryStr)) {
    return {
      result: "Hi! Ask me anything about this book.",
      found: false,
      results: [],
    };
  }

  const result = await answerBookQuestion({
    bookId: bookIdStr,
    bookName: "Selected Book",
    query: queryStr,
  });

  return { result: result.answer, found: result.found, results: result.results || [] };
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

// Parse tool arguments that may arrive as a JSON string or an object
function parseArgs(args: unknown): Record<string, unknown> {
  if (!args) return {};
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
  return args as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support multiple Vapi formats
    const functionCall = body?.message?.functionCall;
    const toolCallList =
      body?.message?.toolCallList || body?.message?.toolCalls;

    // Handle single functionCall format
    if (functionCall) {
      const { name, parameters } = functionCall;
      const parsed = parseArgs(parameters);

      if (name === "searchBook") {
        const result = await processBookSearch(parsed.bookId, parsed.query);
        return NextResponse.json(result);
      }

      return NextResponse.json({ result: `Unknown function: ${name}` });
    }

    // Handle toolCallList format (array of calls)
    if (!toolCallList || toolCallList.length === 0) {
      return NextResponse.json({
        results: [{ result: "No tool calls found" }],
      });
    }

    const results = [];

    for (const toolCall of toolCallList) {
      const { id, function: func } = toolCall;
      const name = func?.name;
      const args = parseArgs(func?.arguments);

      if (name === "searchBook") {
        const searchResult = await processBookSearch(args.bookId, args.query);
        results.push({ toolCallId: id, ...searchResult });
      } else {
        results.push({ toolCallId: id, result: `Unknown function: ${name}` });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Vapi search-book error:", error);
    return NextResponse.json({
      results: [{ result: "Error processing request" }],
    });
  }
}
