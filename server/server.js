import express from 'express';
import issueRoutes from './routes/issueRoutes.js';
import authRoutes from './routes/authRoutes.js';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/issues', issueRoutes);
app.use('/api/auth', authRoutes);
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Civic Pulse backend API is running.' });
});

// MongoDB Atlas Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/civic_pulse';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas successfully');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });