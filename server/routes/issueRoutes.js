import User from '../models/User.js';
import allowRoles from '../middleware/roleMiddleware.js';
import VerificationJob from '../models/VerificationJob.js';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import Issue from '../models/Issue.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { verifyIssueImage } from '../services/geminiService.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Ensure 'uploads' directory exists
const uploadDir = 'uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Set up disk storage for local image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },

  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});


router.post(
  '/',
  authMiddleware,
  upload.single('image'),
  async (req, res) => {
    let savedIssue;

    try {
      const {
        title,
        description,
        category,
        severity,
        address,
        latitude,
        longitude,
      } = req.body;

      const issueCategory =
        category || 'Road Damage / Potholes';

      const departmentMap = {
        'Road Damage / Potholes': 'Roads Department',
        'Streetlight Fault': 'Streetlight Department',
        'Garbage Overflow': 'Sanitation Department',
        'Water Supply Issue': 'Water Supply Department',
      };

      const department =
        departmentMap[issueCategory] || 'General Department';

      const issueData = {
        title,
        description,
        category: issueCategory,

        severity: ['Low', 'Medium', 'High', 'Critical'].includes(
          severity
        )
          ? severity
          : 'Medium',

        department,
        reportedBy: req.user.userId,

        location: {
          address: address || 'Near Main Gate, Hyderabad',
          coordinates: [
            Number(latitude) || 17.3850,
            Number(longitude) || 78.4867,
          ],
        },

        imageUrl: req.file
? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`          : '',
      };

      if (req.file) {
        issueData.imageVerificationStatus = 'Pending Verification';
        issueData.imageVerificationReason =
          'AI verification is waiting in the background queue.';
      } else {
        issueData.imageVerificationStatus = 'Not Checked';
        issueData.imageVerificationReason =
          'No image was uploaded.';
      }

      // Save the complaint first.
      savedIssue = await new Issue(issueData).save();

      // Persist the verification job before returning success.
      if (req.file) {
        try {
          await VerificationJob.create({
            issueId: savedIssue._id,
            imagePath: req.file.path,
            category: issueCategory,
          });
        } catch (jobError) {
          // Avoid leaving a complaint stuck without a queued job.
          await Issue.findByIdAndDelete(savedIssue._id);
          savedIssue = null;
          throw jobError;
        }
      }

      return res.status(201).json(savedIssue);
    } catch (error) {
      console.error('Issue submission failed:', error.message);

      // Remove the uploaded file if submission failed.
      if (req.file && !savedIssue) {
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (fileError) {
          console.error(
            'Could not remove uploaded file:',
            fileError.message
          );
        }
      }

      return res.status(500).json({
        error: 'Could not submit the issue. Please try again.',
      });
    }
  }
);

/* GET /api/issues/my-reports
   Return only complaints submitted by the logged-in citizen.
*/
router.get('/my-reports', authMiddleware, async (req, res) => {
  try {
    const issues = await Issue.find({
      reportedBy: req.user.userId,
    })
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json(issues);
  } catch (error) {
    console.error('Failed to fetch citizen reports:', error.message);

    res.status(500).json({
      error: 'Failed to fetch your reports.',
    });
  }
});


// GET /api/issues -> list all issues

/* GET /api/issues/my-reports
   Return only complaints submitted by the logged-in user.
*/



router.get('/', async (req, res) => {
  try {
    const issues = await Issue.find()
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(issues);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// PATCH /api/issues/:id/upvote -> upvote an issue
// PATCH /api/issues/:id/upvote -> one upvote per citizen
router.patch('/:id/upvote', authMiddleware, async (req, res) => {
  try {
    const updatedIssue = await Issue.findOneAndUpdate(
      {
        _id: req.params.id,
        upvotedBy: { $ne: req.user.userId },
      },
      {
        $addToSet: { upvotedBy: req.user.userId },
        $inc: { upvotes: 1 },
      },
      {
        new: true,
      }
    ).populate('reportedBy', 'name email');

    if (updatedIssue) {
      return res.status(200).json(updatedIssue);
    }

    const issueExists = await Issue.exists({
      _id: req.params.id,
    });

    if (!issueExists) {
      return res.status(404).json({
        error: 'Issue not found',
      });
    }

    return res.status(409).json({
      error: 'You have already upvoted this issue',
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid issue ID',
      });
    }

    return res.status(500).json({
      error: error.message,
    });
  }
});

// Get complaints assigned to the logged-in department
// Update complaint status — department staff or admin only

router.patch(
  '/:id/status',
  authMiddleware,
  allowRoles('department', 'admin'),
  upload.single('repairImage'),
  async (req, res) => {
    let uploadedFile;

    try {
      uploadedFile = req.file;

      const { status, note = '' } = req.body;
      const allowedStatuses = ['Reported', 'In Progress', 'Resolved'];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid complaint status' });
      }

      const cleanNote = String(note).trim().slice(0, 500);

      if (status === 'Resolved') {
        if (!cleanNote) {
          return res.status(400).json({
            error: 'A resolution note is required.',
          });
        }

        if (!uploadedFile) {
          return res.status(400).json({
            error: 'Upload an after-repair photo before resolving this complaint.',
          });
        }
      }

      const user = await User.findById(req.user.userId);

      if (!user || !['department', 'admin'].includes(user.role)) {
        return res.status(403).json({
          error: 'Department staff or admin access required',
        });
      }

      const issue = await Issue.findById(req.params.id);

      if (!issue) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      if (
        user.role === 'department' &&
        (!user.department || user.department !== issue.department)
      ) {
        return res.status(403).json({
          error: 'You cannot update complaints assigned to another department',
        });
      }

      // Prevent changing a resolved complaint back to an active status.
      if (issue.status === 'Resolved' && status !== 'Resolved') {
        return res.status(409).json({
          error: 'Resolved complaints cannot be reopened through this endpoint.',
        });
      }
const previousStatus = issue.status;
      const now = new Date();

      if (status === 'Resolved') {
issue.repairImageUrl =
  `${req.protocol}://${req.get('host')}/uploads/${uploadedFile.filename}`;        issue.resolvedAt = now;
        issue.resolvedBy = user._id;
      }

      issue.status = status;

      issue.statusHistory.push({
        status,
        updatedBy: user._id,
        note: cleanNote,
        changedAt: now,
      });


await issue.save();

// Notify the citizen only when the complaint status actually changes.
if (previousStatus !== status && issue.reportedBy) {
  try {
    await Notification.create({
      recipient: issue.reportedBy,
      issue: issue._id,
      title: 'Complaint status updated',
      message: `Your complaint "${issue.title}" has changed from "${previousStatus}" to "${status}".`,
      status,
    });
  } catch (notificationError) {
    // A notification failure must not undo a successful status update.
    console.error('Notification creation error:', notificationError.message);
  }
}

return res.json({
  message: 'Complaint status updated successfully',
  issue,
});

    } catch (error) {
      console.error('Status update error:', error.message);

      return res.status(500).json({
        error: 'Failed to update complaint status',
      });
    } finally {
      // Keep a successfully saved repair photo. Remove it if the request failed.
      if (uploadedFile && res.statusCode >= 400) {
        try {
          if (fs.existsSync(uploadedFile.path)) {
            fs.unlinkSync(uploadedFile.path);
          }
        } catch (fileError) {
          console.error('Could not remove repair photo:', fileError.message);
        }
      }
    }
  }
);

router.get(
  '/department',
  authMiddleware,
  allowRoles('department', 'admin'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);

      if (!user || !['department', 'admin'].includes(user.role)) {
        return res.status(403).json({
          error: 'Department staff or admin access required',
        });
      }

      const filter =
        user.role === 'admin'
          ? {}
          : { department: user.department };

      if (user.role === 'department' && !user.department) {
        return res.status(403).json({
          error: 'No department assigned to this account',
        });
      }

      const issues = await Issue.find(filter)
        .populate('reportedBy', 'name email')
        .sort({ createdAt: -1 });

      res.json(issues);
    } catch (error) {
      console.error('Department complaints error:', error.message);

      res.status(500).json({
        error: 'Failed to fetch department complaints',
      });
    }
  }
);
export default router;