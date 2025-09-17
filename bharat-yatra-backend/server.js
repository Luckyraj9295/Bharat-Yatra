require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const destinationRoutes = require('./routes/destinations');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');

const app = express();

// ✅ CORS - Allow frontend origin
app.use(cors({
  origin: 'http://127.0.0.1:5500', // Update this if needed
  credentials: true
}));

// ✅ JSON Parser
app.use(express.json());

// ✅ Static folder to serve uploaded files (profile images, brochures, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// 📥 Brochure download route
app.get('/download/brochure/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', 'brochures', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('Brochure file not found');
  }
});

// ✅ API routes
app.use('/api/auth', authRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);

// 🔍 Health check
app.get('/', (req, res) => res.json({ status: '✅ Bharat Yatra API is running' }));

// 🌐 Connect MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ Mongo connection error:', err.message);
    process.exit(1);
  });
