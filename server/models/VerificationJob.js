
import mongoose from 'mongoose';

const verificationJobSchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
      unique: true,
    },

    imagePath: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    nextAttemptAt: {
      type: Date,
      default: Date.now,
    },

    lockedAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

verificationJobSchema.index({ status: 1, nextAttemptAt: 1 });

const VerificationJob = mongoose.model(
  'VerificationJob',
  verificationJobSchema
);

export default VerificationJob;
