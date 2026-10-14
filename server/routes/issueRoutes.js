import VerificationJob from '../models/VerificationJob.js';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import Issue from '../models/Issue.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { verifyIssueImage } from '../services/geminiService.js';

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
          ? `http://localhost:5000/uploads/${req.file.filename}`
          : '',
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


// GET /api/issues -> list all issues
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

export default router;