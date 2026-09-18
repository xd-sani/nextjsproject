import { NextResponse } from "next/server";
import mongoose from "mongoose";

import Book from "@/database/model/book.model";
import { connectToDataBase } from "@/database/mongoose";
import { answerBookQuestion } from "@/lib/ai";
import { isBookGreeting } from "@/lib/utils";

type ChatRequest = {
  bookId?: unknown;
  query?: unknown;
};

export async function POST(request: Request) {
  try {
    await connectToDataBase();
    const body = (await request.json()) as ChatRequest;
    const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!bookId || !mongoose.isValidObjectId(bookId)) {
      return NextResponse.json(
        { error: "A valid book is required." },
        { status: 400 },
      );
    }
    if (!query) {
      return NextResponse.json(
        { error: "Ask a question about this book." },
        { status: 400 },
      );
    }

    if (isBookGreeting(query)) {
      return NextResponse.json({
        success: true,
        found: false,
        answer: "Hi! Ask me anything about this book.",
        bookId,
      });
    }

    const book = await Book.findById(bookId).select("_id title").lean();
    if (!book) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    const bookName = book.title || "Selected Book";
    const result = await answerBookQuestion({
      bookId,
      bookName,
      query,
    });

    return NextResponse.json({
      success: true,
      found: result.found,
      answer: result.answer,
      bookId: String(book._id),
      bookName,
    });
  } catch (error) {
    console.error("Chat search error:", error);
    return NextResponse.json(
      { error: "Unable to search this book right now." },
      { status: 500 },
    );
  }
}
