# 🌏 Bharat Yatra  
![Node.js](https://img.shields.io/badge/Node.js-18.x-green)
![Express](https://img.shields.io/badge/Express.js-Backend-black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![Render](https://img.shields.io/badge/Deploy-Render-blue)
![Netlify](https://img.shields.io/badge/Frontend-Netlify-purple)
![Repo Size](https://img.shields.io/github/repo-size/Luckyraj9295/Bharat-Yatra)
### Smart Travel Booking Web Application  

Bharat Yatra is a full-stack travel booking web application that allows users to explore destinations, make bookings, manage travel history, and download invoices.  

It includes secure authentication and an admin dashboard for managing destinations and bookings.

---

## 🚀 Features

### 👤 User Features
- User Registration & Login (JWT Authentication)
- Browse Travel Destinations
- Dynamic Booking System
- Booking History Page
- Invoice PDF Download
- Special Request Option
- Review & Rating System

### 🛠 Admin Features
- Add / Edit / Delete Destinations
- Upload Brochures
- Hide or Show Destinations
- View All Users
- Manage Bookings
- Role-Based Access Control

---

## 🧠 Tech Stack

### Frontend
- HTML5  
- CSS3  
- JavaScript  

### Backend
- Node.js  
- Express.js  

### Database
- MongoDB Atlas  

### Deployment
- Render (Backend Hosting)  
- Netlify (Frontend Hosting)  

---

## 🏗 System Architecture

```
User → Netlify (Frontend)
      ↓
Render (Backend API)
      ↓
MongoDB Atlas (Database)
```

The frontend communicates with the backend using REST APIs.  
JWT is used for authentication and protected routes.

---

## 🔐 Security Features

- JWT Authentication
- Password Hashing
- Protected API Routes
- Role-Based Authorization
- Environment Variables for Sensitive Data
- CORS Configuration

---

## 📂 Project Structure

```
Bharat-Yatra/
│
├── bharat-yatra-backend/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   ├── uploads/
│   ├── server.js
│   └── package.json
│
├── index.html
├── profile.html
├── BookHist.html
├── script.js
├── style.css
└── README.md
```

---

## ⚙ Installation & Local Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/Luckyraj9295/Bharat-Yatra.git
cd Bharat-Yatra
```

### 2️⃣ Install Backend Dependencies

```bash
cd bharat-yatra-backend
npm install
```

### 3️⃣ Create Environment File

Inside `bharat-yatra-backend` create a `.env` file:

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

### 4️⃣ Run Backend Server

```bash
npm start
```

Server will run at:

```
http://localhost:5000
```

Open `index.html` in your browser to access frontend locally.

---

## 🌍 Deployment

- Backend deployed on Render
- Frontend deployed on Netlify
- Database hosted on MongoDB Atlas
- Environment variables configured securely on hosting platform

---

## 🔮 Future Enhancements

- Payment Gateway Integration
- AI-Based Travel Recommendation System
- Real-Time Notifications
- Mobile App Version
- Multi-Language Support

---

## 👨‍💻 Author

Lucky
Computer Science Engineering Student  
Full Stack Web Developer  

---

⭐ If you like this project, consider giving it a star on GitHub.
