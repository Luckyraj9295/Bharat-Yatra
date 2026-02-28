require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const destinationRoutes = require('./routes/destinations');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');
const contactRoutes = require("./routes/contact");
const paymentRoutes = require('./routes/payment');

const app = express();

const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://bharat-yatra.netlify.app",
  "https://www.bharat-yatra.netlify.app",
  "https://bharat-yaatra.netlify.app",
  "https://www.bharat-yaatra.netlify.app"
];

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https:\/\/[a-z0-9-]+--bharat-yatra\.netlify\.app$/i.test(origin) ||
        /^https:\/\/[a-z0-9-]+--bharat-yaatra\.netlify\.app$/i.test(origin);

      if (isAllowed) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);
app.options('*', cors());

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use("/api/contact", contactRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/', (req, res) =>
  res.json({ status: 'Bharat Yatra API running successfully' })
);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server error" });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () =>
      console.log(`Server listening on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error('Mongo connection error:', err.message);
    process.exit(1);
  });