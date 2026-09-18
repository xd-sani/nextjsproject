import { Schema, models, model } from "mongoose";
import { IVoiceSession } from "@/types";

const VoiceSessionSchema = new Schema<IVoiceSession>(
  {
    clerkId: {
      type: String,
      required: true,
    },

    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    endedAt: {
      type: Date,
    },

    durationSeconds: {
      type: Number,
      required: true,
    },

    billingPeriodStart: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);
VoiceSessionSchema.index({ clerkId: 1, billingPerioidStart: 1 });
const voiceSession =
  models.VoiceSession ||
  model<IVoiceSession>("VoiceSession", VoiceSessionSchema);

export default voiceSession;
