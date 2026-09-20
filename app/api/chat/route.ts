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
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let streamedToken = false;
          const result = await answerBookQuestion({
            bookId,
            bookName,
            query,
            onToken: (token) => {
              streamedToken = true;
              controller.enqueue(encoder.encode(token));
            },
          });
          if (!streamedToken) {
            controller.enqueue(encoder.encode(result.answer));
          }
          controller.close();
        } catch (error) {
          console.error("Chat stream error:", error);
          controller.enqueue(
            encoder.encode(
              "Sorry, I couldn't generate an answer right now. Please try again.",
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Book-Id": String(book._id),
        "X-Book-Name": bookName,
      },
    });
  } catch (error) {
    console.error("Chat search error:", error);
    return NextResponse.json(
      { error: "Unable to search this book right now." },
      { status: 500 },
    );
  }
}
