"use server";
import { connectToDataBase } from "@/database/mongoose";
import { CreateBook, TextSegment } from "@/types";
import {
  escapeRegex,
  generateSlug,
  isBookGreeting,
  serializeData,
} from "../utils";
import Book from "@/database/model/book.model";
import bookSegment from "@/database/model/book-segment.model";
import mongoose from "mongoose";
import { createEmbedding, createEmbeddings } from "@/lib/embeddings";

export const getAllBooks = async () => {
  try {
    await connectToDataBase();
    const books = await Book.find().sort({ createdAt: -1 }).lean();
    return {
      success: true,
      data: serializeData(books),
    };
  } catch (e) {
    console.error("Error connecting to database ", e);
    return {
      success: false,
      error: e,
    };
  }
};

export const getBookBySlug = async (slug: string) => {
  try {
    await connectToDataBase();
    const book = await Book.findOne({ slug }).lean();

    if (!book) {
      return {
        success: false,
        data: null,
      };
    }

    return {
      success: true,
      data: serializeData(book),
    };
  } catch (e) {
    console.error("Error fetching book", e);
    return {
      success: false,
      data: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
};

export const cheakBookExists = async (title: string) => {
  try {
    await connectToDataBase();
    const slug = generateSlug(title);
    const existingBook = await Book.findOne({ slug }).lean();
    if (existingBook) {
      return {
        exists: true,
        data: serializeData(existingBook),
      };
    }
  } catch (e) {
    console.error("Book is Already Exist", e);
    return {
      exists: false,
      error: e,
    };
  }
};

export const createBook = async (data: CreateBook) => {
  try {
    await connectToDataBase();

    const slug = generateSlug(data.title);

    const existingBook = await Book.findOne({ slug }).lean();

    if (existingBook) {
      return {
        success: true,
        data: serializeData(existingBook),
        alreadyExists: true,
      };
    }

    const book = await Book.create({
      ...data,
      slug,
      totalSegments: 0,
    });

    return {
      success: true,
      data: serializeData(book),
      alreadyExists: false,
    };
  } catch (e) {
    console.error("Error Creating Book:", e);

    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
};

export const saveBookSegments = async (
  bookId: string,
  clerkId: string,
  segments: TextSegment[],
) => {
  try {
    await connectToDataBase();
    let embeddings: number[][] = [];
    try {
      embeddings = await createEmbeddings(segments.map(({ text }) => text));
    } catch (error) {
      console.warn(
        "[BookUpload] Embeddings unavailable; saving segments for lexical retrieval.",
        { message: error instanceof Error ? error.message : String(error) },
      );
    }
    const segmentsToInsert = segments.map(
      ({ text, segmentIndex, pageNumber, wordCount }, index) => ({
        clerkId,
        bookId,
        content: text,
        segmentIndex,
        pageNumber,
        wordCount,
        embedding: embeddings[index] || undefined,
      }),
    );
    await bookSegment.insertMany(segmentsToInsert);
    return {
      success: true,
      data: { segmentCreated: segments.length },
    };
  } catch (e) {
    console.error("Error saving book segments", e);
    await bookSegment.deleteMany({ bookId });
    await bookSegment.findByIdAndDelete(bookId);
    console.log("Deleted Book Segment Due to faliure ");
    return {
      success: false,
      error: e,
    };
  }
};

const SEARCH_STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "does",
  "explain",
  "for",
  "give",
  "how",
  "is",
  "it",
  "me",
  "of",
  "please",
  "tell",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "why",
  "with",
  "you",
  "some",
  "completely",
  "nonexistent",
  "topic",
  "book",
]);

const isFrontMatter = (content: string) => {
  const hasFrontMatterMarker =
    /copyright|all rights reserved|table of contents?|preface|acknowledgements?|about the author/i.test(
      content,
    );
  return hasFrontMatterMarker && !/\banswer\s*:/i.test(content);
};

let bookSegmentIndexesPromise: Promise<void> | null = null;

const ensureBookSegmentIndexes = async () => {
  if (!bookSegmentIndexesPromise) {
    bookSegmentIndexesPromise = bookSegment
      .createIndexes()
      .then(() => undefined);
  }
  return bookSegmentIndexesPromise;
};

export const searchBookSegments = async (
  bookId: string,
  query: string,
  limit: number = 5,
) => {
  const trimmedQuery = query.trim();
  const safeLimit = Math.min(Math.max(limit, 1), 5);
  const keywords = trimmedQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((keyword) => keyword.length > 2 && !SEARCH_STOP_WORDS.has(keyword));

  if (
    !mongoose.isValidObjectId(bookId) ||
    !trimmedQuery ||
    isBookGreeting(trimmedQuery)
  ) {
    console.log(
      `[BookSearch] bookId: ${bookId}, query: ${trimmedQuery}, normalizedQuery: ${keywords.join(" ")}, textSearchUsed: false, keywordFallbackUsed: false, candidateCount: 0, returnedCount: 0, found: false`,
    );
    return { success: true, found: false, data: [] };
  }

  try {
    await connectToDataBase();
    await ensureBookSegmentIndexes();
    const bookObjectId = new mongoose.Types.ObjectId(bookId);
    const normalizedQuery = keywords.join(" ");
    const projection = "_id bookId content segmentIndex pageNumber wordCount";
    let segments: Record<string, unknown>[] = [];
    let candidateCount = 0;
    let textSearchUsed = false;
    let keywordFallbackUsed = false;

    try {
      const queryEmbedding = await createEmbedding(trimmedQuery);
      if (queryEmbedding.length) {
        const vectorResults = await bookSegment.aggregate([
          {
            $vectorSearch: {
              index: process.env.MONGODB_VECTOR_INDEX || "book_segments_vector",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: Math.max(safeLimit * 10, 20),
              limit: safeLimit,
              filter: { bookId: bookObjectId },
            },
          },
          {
            $project: {
              _id: 1,
              bookId: 1,
              content: 1,
              segmentIndex: 1,
              pageNumber: 1,
              wordCount: 1,
              score: { $meta: "vectorSearchScore" },
            },
          },
        ]);
        const substantiveVectorResults = vectorResults.filter(
          (segment) => !isFrontMatter(String(segment.content || "")),
        );
        if (substantiveVectorResults.length) {
          const maxCharacters = 4000;
          let characterCount = 0;
          const focusedVectorResults = substantiveVectorResults.filter(
            (segment) => {
              const content = String(segment.content || "");
              if (
                characterCount + content.length > maxCharacters &&
                characterCount > 0
              )
                return false;
              characterCount += Math.min(
                content.length,
                maxCharacters - characterCount,
              );
              return true;
            },
          );
          console.log(
            `[BookSearch] bookId: ${bookId}, vectorSearchUsed: true, returnedCount: ${focusedVectorResults.length}`,
          );
          return {
            success: true,
            found: focusedVectorResults.length > 0,
            data: serializeData(focusedVectorResults),
          };
        }
      }
    } catch (error) {
      console.warn(
        "[BookSearch] Vector search unavailable; using text search.",
        {
          message: error instanceof Error ? error.message : String(error),
        },
      );
    }

    if (keywords.length === 0) {
      return { success: true, found: false, data: [] };
    }

    try {
      candidateCount = await bookSegment.countDocuments({
        bookId: bookObjectId,
        $text: { $search: normalizedQuery },
      });
      segments = await bookSegment
        .find({ bookId: bookObjectId, $text: { $search: normalizedQuery } })
        .select(projection)
        .sort({ score: { $meta: "textScore" } })
        .limit(safeLimit * 2)
        .lean();
      const substantiveTextSegments = segments.filter(
        (segment) => !isFrontMatter(String(segment.content || "")),
      );
      segments = substantiveTextSegments;
      textSearchUsed = segments.length > 0;
    } catch {
      segments = [];
    }

    if (segments.length === 0) {
      keywordFallbackUsed = true;
      const pattern = keywords
        .map(
          (keyword) =>
            `(?:^|[^\\p{L}\\p{N}])${escapeRegex(keyword)}(?:$|[^\\p{L}\\p{N}])`,
        )
        .join("|");
      const filter = {
        bookId: bookObjectId,
        content: { $regex: pattern, $options: "i" },
      };
      candidateCount = await bookSegment.countDocuments(filter);
      const candidates = await bookSegment
        .find(filter)
        .select(projection)
        .limit(50)
        .lean();
      const substantiveCandidates = candidates.filter(
        (segment) => !isFrontMatter(String(segment.content || "")),
      );
      const candidatesToRank = substantiveCandidates.length
        ? substantiveCandidates
        : [];
      const rankedCandidates = candidatesToRank.map((segment) => {
        const content = String(segment.content || "").toLowerCase();
        const score = keywords.reduce((total, keyword) => {
          const matches = content.match(new RegExp(escapeRegex(keyword), "g"));
          return total + (matches?.length || 0);
        }, 0);
        return { segment, score };
      });
      segments = rankedCandidates
        .filter(({ score }) => score > 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            Number(left.segment.segmentIndex) -
              Number(right.segment.segmentIndex),
        )
        .slice(0, safeLimit * 2)
        .map(({ segment }) => segment);
    }

    const seenContent = new Set<string>();
    const boundedSegments = segments
      .filter((segment) => {
        const content =
          typeof segment.content === "string" ? segment.content.trim() : "";
        if (!content || seenContent.has(content)) return false;
        seenContent.add(content);
        return true;
      })
      .slice(0, safeLimit);

    const maxCharacters = 4000;
    let characterCount = 0;
    const focusedSegments = boundedSegments.filter((segment) => {
      const content = String(segment.content);
      if (characterCount + content.length > maxCharacters && characterCount > 0)
        return false;
      characterCount += content.length;
      return true;
    });

    console.log(
      `[BookSearch] bookId: ${bookId}, query: ${trimmedQuery}, normalizedQuery: ${keywords.join(" ")}, textSearchUsed: ${textSearchUsed}, keywordFallbackUsed: ${keywordFallbackUsed}, candidateCount: ${candidateCount}, returnedCount: ${focusedSegments.length}, found: ${focusedSegments.length > 0}`,
    );
    return {
      success: true,
      found: focusedSegments.length > 0,
      data: serializeData(focusedSegments),
    };
  } catch (error) {
    console.error("Error searching segments:", error);
    return {
      success: false,
      found: false,
      error: (error as Error).message,
      data: [],
    };
  }
};
