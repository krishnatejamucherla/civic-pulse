import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// 1. Load the secret MONGO_URI from the .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 2. Allow our server to accept JSON data
app.use(express.json());

// 3. A quick test route to check if server responds
app.get('/api/test', (req, res) => {
  res.json({ message: 'Civic Pulse API is working!' });
});

// 4. Connect to MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(' Connected to MongoDB Atlas successfully');
    
    // Only start the server AFTER the database connects successfully
    app.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(' Database connection failed:', err.message);
  });