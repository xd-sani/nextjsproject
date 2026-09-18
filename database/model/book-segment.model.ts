import { Schema, models, model } from "mongoose";
import { IBookSegment } from "@/types";

const BookSegmentSchema = new Schema<IBookSegment>(
  {
    clerkId: {
      type: String,
      required: true,
    },

    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
    },

    segmentIndex: {
      type: Number,
      required: true,
      index: true,
    },

    pageNumber: {
      type: Number,
    },

    wordCount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

BookSegmentSchema.index({ bookId: 1, segmentIndex: 1 });
BookSegmentSchema.index({ bookId: 1, pageNumber: 1 });
BookSegmentSchema.index({ content: "text" });

const bookSegment =
  models.BookSegment || model<IBookSegment>("BookSegment", BookSegmentSchema);

export default bookSegment;
