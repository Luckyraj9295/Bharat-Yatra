# 🌏 Bharat Yatra  

![Node.js](https://img.shields.io/badge/Node.js-18.x-green)
![Express](https://img.shields.io/badge/Express.js-Backend-black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media-blue)
![Razorpay](https://img.shields.io/badge/Payment-Razorpay-orange)
![JWT](https://img.shields.io/badge/Auth-JWT-yellow)
![Render](https://img.shields.io/badge/Backend-Render-blue)
![Netlify](https://img.shields.io/badge/Frontend-Netlify-purple)
![Repo Size](https://img.shields.io/github/repo-size/Luckyraj9295/Bharat-Yatra)
![GitHub stars](https://img.shields.io/github/stars/Luckyraj9295/Bharat-Yatra?style=social)

### Smart Full-Stack Travel Booking Platform

Bharat Yatra is a production-ready full-stack travel booking web application where users can explore destinations, book trips, make secure payments, upload profile images, download brochures, leave reviews, and contact support.  

The system includes secure authentication, a complete admin dashboard, AI chatbot integration, cloud storage, email notifications, and online payment processing.

---

# 🌐 Live Application

Frontend (Netlify):  
https://bharat-yaatra.netlify.app  

Backend API (Render):  
https://bharat-yatra.onrender.com  

---

# 🚀 Complete Feature Set

• User Registration & Login (JWT Authentication)  
• Role-Based Access (User / Admin)  
• Profile Image Upload (Cloudinary)  
• Browse Dynamic Travel Destinations  
• Multi-Step Booking System  
• Special Travel Request Option  
• Razorpay Payment Integration (UPI / Cards / Net Banking)  
• Secure Payment Order Creation & Verification  
• Booking History Page  
• Invoice PDF Download  
• Review & Star Rating System  
• Dynamic Testimonial Slider  
• AI Chatbot (BharatBuddy using Dialogflow)  
• Contact Form with Email Confirmation  
• Admin Email Notifications (Resend API)  
• Destination Image Upload (Cloudinary)  
• Brochure PDF Upload (Cloudinary)  
• Hide / Show Destinations  
• User & Booking Management Panel  

---

# 💳 Payment Integration

The platform integrates Razorpay for secure online payments.

• Backend-based order creation  
• Razorpay checkout popup  
• Test mode supported  
• Secure transaction verification  
• Supports UPI, credit/debit cards, and net banking  

---

# 📩 Email & Enquiry System

• Contact form connected to backend API  
• Enquiry stored in MongoDB  
• Admin receives notification email  
• Automatic confirmation email sent to user  
• Powered by Resend email API  

---

# 🧠 Technology Stack

Frontend  
HTML5  
Tailwind CSS  
JavaScript  
Razorpay Checkout  
Dialogflow AI Chatbot  

Backend  
Node.js  
Express.js  
MongoDB Atlas  
JWT Authentication  
Cloudinary (Images & PDFs)  
Razorpay API  
Resend Email API  

Deployment  
Frontend hosted on Netlify  
Backend hosted on Render  
Database on MongoDB Atlas  
Media storage on Cloudinary  

---

# 🏗 System Architecture

User → Netlify (Frontend)  
↓  
Render (Backend API)  
↓  
MongoDB Atlas (Database)  
↓  
Cloudinary (Media Storage)  
↓  
Razorpay (Payments)  
↓  
Resend (Email Service)  

Frontend communicates with backend via REST APIs.  
JWT protects secure routes.  
Environment variables protect sensitive credentials.  

---

# 🔐 Security Implementation

• JWT Authentication  
• Password Hashing (bcrypt)  
• Protected API Routes  
• Role-Based Authorization  
• Secure File Upload Validation  
• Production CORS Configuration  
• Environment Variable Protection  
• Payment Verification Logic  

---

# 📂 Project Structure

Bharat-Yatra/  
│  
├── bharat-yatra-backend/  
│   ├── routes/  
│   ├── models/  
│   ├── middleware/  
│   ├── config/  
│   ├── server.js  
│   └── package.json  
│  
├── index.html  
├── profile.html  
├── BookHist.html  
├── ContUs.html  
├── script.js  
├── style.css  
└── README.md  

---

# ⚙ Local Installation

1. Clone repository

git clone https://github.com/Luckyraj9295/Bharat-Yatra.git  
cd Bharat-Yatra  

2. Install backend dependencies

cd bharat-yatra-backend  
npm install  

3. Create a `.env` file inside backend folder

MONGO_URI=your_mongodb_connection_string  
JWT_SECRET=your_secret_key  
CLOUDINARY_CLOUD_NAME=your_cloud_name  
CLOUDINARY_API_KEY=your_api_key  
CLOUDINARY_API_SECRET=your_api_secret  
RAZORPAY_KEY_ID=your_key_id  
RAZORPAY_KEY_SECRET=your_key_secret  
RESEND_API_KEY=your_resend_key  
EMAIL_USER=your_email  

4. Run backend server

npm start  

Backend runs at:  
http://localhost:5000  

Open `index.html` in your browser to access frontend locally.

---

# 🌍 Deployment

• Backend deployed on Render  
• Frontend deployed on Netlify  
• Database hosted on MongoDB Atlas  
• Media stored on Cloudinary  
• Payment handled via Razorpay  
• Email handled via Resend  

All environment variables are securely configured on hosting platforms.

---

# 🔮 Future Enhancements

• Booking Cancellation & Refund Flow  
• Admin Analytics Dashboard  
• Email Template Branding  
• Tailwind Production Build Optimization  
• Multi-Language Support  
• Mobile Application Version  

---

# 👨‍💻 Developed By

Lucky  
Computer Science Engineering Student  
Full Stack Web Developer  

---

⭐ If you found this project useful, consider giving it a star on GitHub.
