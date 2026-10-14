
import VerificationJob from '../models/VerificationJob.js';
import Issue from '../models/Issue.js';
import { verifyIssueImage } from './geminiService.js';

const MAX_JOB_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 3000;
const STALE_JOB_MS = 5 * 60 * 1000;

let workerRunning = false;

async function processOneJob() {
  const now = new Date();

  // Recover jobs interrupted by a server restart.
  await VerificationJob.updateMany(
    {
      status: 'processing',
      lockedAt: { $lt: new Date(now.getTime() - STALE_JOB_MS) },
    },
    {
      $set: {
        status: 'pending',
        lockedAt: null,
        nextAttemptAt: now,
      },
    }
  );

  // Atomically claim one available job.
  const job = await VerificationJob.findOneAndUpdate(
    {
      status: 'pending',
      nextAttemptAt: { $lte: now },
    },
    {
      $set: {
        status: 'processing',
        lockedAt: now,
      },
      $inc: { attempts: 1 },
    },
    {
  returnDocument: 'after',
  sort: { createdAt: 1 },
}
  );

  if (!job) return;

  try {
    const result = await verifyIssueImage(
      job.imagePath,
      job.category
    );

    const statusMap = {
      likely_relevant: 'Likely Relevant',
      mismatch: 'Mismatch',
      needs_review: 'Needs Review',
    };

    const verificationStatus =
      statusMap[result.result] || 'Needs Review';

    await Issue.findByIdAndUpdate(job.issueId, {
      $set: {
        imageVerificationStatus: verificationStatus,
        imageVerificationReason: String(
          result.reason || 'No explanation provided.'
        ).slice(0, 500),
      },
    });

    await VerificationJob.findByIdAndUpdate(job._id, {
      $set: {
        status: 'completed',
        lockedAt: null,
        lastError: '',
      },
    });

    console.log(`Image verification completed for issue ${job.issueId}`);
  } catch (error) {
    console.error(
      `Verification attempt ${job.attempts} failed:`,
      error.message
    );

    if (job.attempts < MAX_JOB_ATTEMPTS) {
      const delayMs = 30 * 1000 * 2 ** (job.attempts - 1);

      await VerificationJob.findByIdAndUpdate(job._id, {
        $set: {
          status: 'pending',
          lockedAt: null,
          nextAttemptAt: new Date(Date.now() + delayMs),
          lastError: error.message.slice(0, 500),
        },
      });
    } else {
      await VerificationJob.findByIdAndUpdate(job._id, {
        $set: {
          status: 'failed',
          lockedAt: null,
          lastError: error.message.slice(0, 500),
        },
      });

      await Issue.findByIdAndUpdate(job.issueId, {
        $set: {
          imageVerificationStatus: 'Pending Verification',
          imageVerificationReason:
            'Automatic verification failed after multiple attempts. Manual review is required.',
        },
      });
    }
  }
}

export function startVerificationWorker() {
  if (workerRunning) return;

  workerRunning = true;
  console.log('Background image verification worker started.');

  const poll = async () => {
    try {
      await processOneJob();
    } catch (error) {
      console.error('Verification worker error:', error.message);
    } finally {
      if (workerRunning) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
  };

  void poll();
}
