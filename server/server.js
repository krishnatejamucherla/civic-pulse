import express from 'express';

const app = express();
const PORT = 5000;

// Test route
app.get('/', (req, res) => {
  res.send('Civic Pulse API is up and running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});