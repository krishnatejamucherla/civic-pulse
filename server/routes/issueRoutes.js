import express from 'express';
import Issue from '../models/Issue.js';

const router = express.Router();

// 1. Submit a new civic issue
router.post('/', async (req, res) => {
  try {
    const { title, description, category, location } = req.body;

    const newIssue = new Issue({
      title,
      description,
      category,
      location,
    });

    const savedIssue = await newIssue.save();
    res.status(201).json(savedIssue);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2. Fetch all reported issues (newest first)
router.get('/', async (req, res) => {
  try {
    const issues = await Issue.find().sort({ createdAt: -1 });
    res.status(200).json(issues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;