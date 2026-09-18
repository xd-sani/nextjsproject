import { Schema, models, model } from "mongoose";
import { IBook } from "@/types";
const BookSchema = new Schema<IBook>(
  {
    clerkId: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    author: {
      type: String,
      required: true,
    },

    persona: {
      type: String,
    },

    fileURL: {
      type: String,
      required: true,
    },

    fileBlobKey: {
      type: String,
    },

    coverURL: {
      type: String,
    },

    coverBlobKey: {
      type: String,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    totalSegments: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);
const book = models.Book || model<IBook>("Book", BookSchema);
export default book;
