# 🌏 Bharat Yatra  

![Node.js](https://img.shields.io/badge/Node.js-18.x-green)
![Express](https://img.shields.io/badge/Express.js-Backend-black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media-blue)
![Razorpay](https://img.shields.io/badge/Payment-Razorpay-orange)
![JWT](https://img.shields.io/badge/Auth-JWT-yellow)
![Render](https://img.shields.io/badge/Backend-Render-blue)
![Netlify](https://img.shields.io/badge/Frontend-Netlify-purple)

### Full-Stack Travel Booking Platform with Payment & Refund Governance

Bharat Yatra is a production-grade full-stack travel booking platform demonstrating complete financial transaction management—from payment processing to admin-controlled refund governance with real-time analytics.

---

# 🏗 System Design Summary

The system follows a **3-layer architecture**:

### 1️⃣ Transaction Layer  
Handles bookings, payments, and refunds with secure Razorpay integration and verification.

### 2️⃣ Governance Layer  
Implements admin-controlled refund approvals, role-based authorization, audit tracking, and double-refund prevention.

### 3️⃣ Intelligence Layer  
Provides cancellation analytics, refund metrics, and business insights via interactive dashboards.

### Architecture Flow

User (Browser - Netlify)  
↓  
Frontend (HTML, JS, Tailwind)  
↓ REST API  
Backend (Node.js + Express - Render)  
↓  
MongoDB Atlas (Database)  
↓  
External Services (Razorpay, Cloudinary, Resend Email)

---

# 🌐 Live Application

Frontend:  
https://bharat-yaatra.netlify.app  

Backend API:  
https://bharat-yatra.onrender.com  

---

# 🚀 Core Features

## 👤 User Features
- JWT Authentication (User / Admin roles)
- Browse travel destinations
- Multi-step booking system
- Razorpay secure payments (UPI, Card, Net Banking, Wallet)
- Booking history with refund tracking
- Invoice PDF download
- Profile image upload (Cloudinary)
- Contact form with email confirmation
- AI Chatbot (Dialogflow integration)

---

## 💳 Payment & Refund Engine

- Backend-based Razorpay order creation  
- Secure HMAC SHA-256 signature verification  
- Payment ID & method tracking  
- Time-based refund calculation  

### Refund Policy

| Days Before Travel | Refund |
|-------------------|--------|
| ≥ 14 days         | 100%   |
| 7–14 days         | 50%    |
| < 7 days          | 0%     |

### Refund Workflow

1. User requests cancellation  
2. Refund marked **Pending Approval**  
3. Admin reviews request  
4. Razorpay refund executed (if approved)  

### Security Controls

- Admin-only refund approval endpoint  
- Double refund prevention  
- Payment status validation before refund  
- Audit trail (who approved, when, and why)  

---

## 🛠 Admin Dashboard

- Destination management  
- User & booking management  
- Refund approval interface  
- Audit tracking system  
- Cancellation analytics dashboard  

### 📊 Analytics Includes

- Total cancellations  
- Total refunded amount  
- Refund rate  
- Pending approvals  
- Refund distribution charts  
- Cancellation timing analysis  
- Date range filtering  

---

# 📊 API Overview

### Bookings
```bash
POST   /api/bookings
GET    /api/bookings/me
GET    /api/bookings/:id
DELETE /api/bookings/:id
PATCH  /api/bookings/:id
```

### Payments
```bash
POST /api/payments/create-order
POST /api/payments/verify-payment
GET  /api/payments/payment-details
```

### Refunds
```bash
POST /api/payments/refund
POST /api/payments/admin/refund-approval
```

---

# 🔐 Security Implementation

- JWT Authentication  
- Password hashing (bcrypt)  
- Role-based access control  
- Secure CORS configuration  
- Environment variable protection  
- Payment signature verification  
- Refund idempotency protection  
- Admin audit logging  

---

# 🧠 Technology Stack

### Frontend  
HTML5, Tailwind CSS, JavaScript  

### Backend  
Node.js, Express.js, MongoDB Atlas  

### External Services  
Razorpay (Payments)  
Cloudinary (Media Storage)  
Resend (Email API)  
Dialogflow (AI Chatbot)

### Deployment  
Netlify (Frontend)  
Render (Backend)

---

# 🎯 Project Highlights

- Complete booking lifecycle management  
- Financial integrity with admin-controlled refunds  
- Secure payment verification system  
- Business analytics dashboard  
- Production deployment with cloud services  

---

# 👨‍💻 Developed By

Lucky  
Computer Science Engineering Student  
Full Stack Developer  

---

⭐ If you found this project useful, consider giving it a star on GitHub.