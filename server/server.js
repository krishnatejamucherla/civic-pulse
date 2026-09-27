import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import issueRoutes from './routes/issueRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/issues', issueRoutes);

// Health check route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Civic Pulse API is working!' });
});

// Connect to MongoDB Atlas and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(' Connected to MongoDB Atlas successfully');
    app.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(' Database connection failed:', err.message);
  });