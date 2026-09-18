import { NextResponse } from "next/server";
import mongoose from "mongoose";

import Book from "@/database/model/book.model";
import { connectToDataBase } from "@/database/mongoose";
import { answerBookQuestion } from "@/lib/ai";
import { isBookGreeting } from "@/lib/utils";

type SearchArguments = {
  bookId?: unknown;
  book_name?: unknown;
  bookName?: unknown;
  query?: unknown;
};

function parseArguments(value: unknown): SearchArguments {
  if (typeof value === "string") {
    try {
      return parseArguments(JSON.parse(value));
    } catch {
      return {};
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const object = value as Record<string, unknown>;
  const nested = ["parameters", "arguments", "input", "data", "body"]
    .map((key) => object[key])
    .find((candidate) => candidate !== undefined);

  if (nested !== undefined) {
    return parseArguments(nested);
  }

  return object;
}

async function searchBook(
  bookId: unknown,
  bookNameParam: unknown,
  query: unknown,
) {
  if (bookId == null || query == null) {
    return { result: "Missing bookId or query" };
  }

  const bookIdValue = String(bookId).trim();
  const queryValue = String(query).trim();

  if (!bookIdValue || !queryValue || !mongoose.isValidObjectId(bookIdValue)) {
    return { result: "Missing bookId or query" };
  }

  if (isBookGreeting(queryValue)) {
    return {
      result: "Hi! Ask me anything about this book.",
      found: false,
    };
  }

  let bookName = typeof bookNameParam === "string" ? bookNameParam.trim() : "";
  if (!bookName) {
    try {
      await connectToDataBase();
      const book = await Book.findById(bookIdValue).select("title").lean();
      if (book?.title) {
        bookName = book.title;
      }
    } catch {
      bookName = "Selected Book";
    }
  }

  const result = await answerBookQuestion({
    bookId: bookIdValue,
    bookName: bookName || "Selected Book",
    query: queryValue,
  });

  return {
    result: result.answer,
    found: result.found,
  };
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const args = parseArguments(body);
    const bookName = args.book_name ?? args.bookName;
    const result = await searchBook(args.bookId, bookName, args.query);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Dograh search-book error:", error);
    return NextResponse.json(
      { result: "Error processing request" },
      { status: 500 },
    );
  }
}
