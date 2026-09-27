import express from 'express';
import multer from 'multer';
import fs from 'fs';
import Issue from '../models/Issue.js';
import authMiddleware from '../middleware/authMiddleware.js';

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

// POST /api/issues -> create issue with image
// Authentication required
router.post(
  '/',
  authMiddleware,
  upload.single('image'),
  async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        address,
        latitude,
        longitude,
      } = req.body;

      const issueData = {
        title,
        description,
        category: category || 'Road Damage / Potholes',

        // Citizen who submitted the issue
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

      const newIssue = new Issue(issueData);
      const savedIssue = await newIssue.save();

      res.status(201).json(savedIssue);
    } catch (error) {
      res.status(400).json({
        error: error.message,
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
router.patch('/:id/upvote', async (req, res) => {
  try {
    const updatedIssue = await Issue.findByIdAndUpdate(
      req.params.id,
      { $inc: { upvotes: 1 } },
      { returnDocument: 'after' }
    );

    if (!updatedIssue) {
      return res.status(404).json({
        error: 'Issue not found',
      });
    }

    res.status(200).json(updatedIssue);
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
});

export default router;