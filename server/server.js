import { startVerificationWorker } from './services/verificationWorker.js';
import express from 'express';
import issueRoutes from './routes/issueRoutes.js';
import authRoutes from './routes/authRoutes.js';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import notificationRoutes from './routes/notificationRoutes.js';


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
app.use('/api/notifications', notificationRoutes);
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Civic Pulse backend API is running.' });
});

// Convert map coordinates into a readable address
app.get('/api/geocoding/reverse', async (req, res) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        message: 'Valid latitude and longitude are required.',
      });
    }

    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      addressdetails: '1',
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: {
          'User-Agent': 'CivicPulse/1.0 (student project)',
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        message: 'Address lookup is temporarily unavailable.',
      });
    }

    const result = await response.json();

    res.json({
      address: result.display_name || null,
    });
  } catch (error) {
    console.error('Reverse geocoding failed:', error.message);

    res.status(502).json({
      message: 'Unable to retrieve the address.',
    });
  }
});


// MongoDB Atlas Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/civic_pulse';

mongoose
  .connect(MONGO_URI)
  .then(() => {
  console.log('Connected to MongoDB Atlas successfully');

  startVerificationWorker();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });