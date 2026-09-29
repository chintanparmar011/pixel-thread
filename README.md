# PixelThread (Version 1.0)
**Full-Stack MERN Social Media Platform**

PixelThread combines photo-sharing and micro-blogging discussions with real-time private messaging and an administrative control panel. Built according to the PixelThread SRS Version 1.0 specification.

---

## 📁 Monorepo Structure

```text
pixel-thread/
├── backend/                  # Node.js + Express.js + MongoDB + Socket.io API
│   ├── config/               # Database and Cloudinary configuration
│   ├── controllers/          # Express route controllers
│   ├── middleware/           # Auth, error handling, Multer upload
│   ├── models/               # Mongoose schemas (User, Post, Like, Comment, Follow, Message, AdminActionLog)
│   ├── routes/               # API endpoint definitions
│   ├── scripts/              # Initial seeding scripts (Admin account)
│   ├── sockets/              # Socket.io real-time chat & presence engine
│   ├── test_e2e_suite.js     # Automated end-to-end test suite
│   ├── server.js             # Server entrypoint
│   └── package.json
│
├── frontend/                 # React 18 + Vite SPA
│   ├── public/               # Public assets
│   ├── src/
│   │   ├── components/       # Navbar, CreatePost, Feed card
│   │   ├── context/          # AuthContext, SocketContext
│   │   ├── pages/            # FeedPage, ProfilePage, SearchPage, ChatPage, AdminPage, LoginPage, SignupPage
│   │   ├── services/         # Axios API clients, Socket client
│   │   ├── App.jsx           # React Router route declarations & guards
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── .gitignore
├── package.json              # Monorepo task runner
└── README.md
```

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, React Router v6, Axios, Lucide React, Socket.io Client
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), JWT, Bcrypt, Multer, Cloudinary, Socket.io
- **Real-Time**: WebSockets for 1-on-1 private messaging, typing indicators, and live presence status

---

## 🚀 Quick Setup & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- MongoDB Atlas account or local MongoDB instance
- Cloudinary account for media hosting

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Initial Admin Seeding
SEED_ADMIN_NAME=Admin
SEED_ADMIN_USERNAME=ogadmin
SEED_ADMIN_EMAIL=admin@pixelthread.com
SEED_ADMIN_PASSWORD=your_admin_password
```

Seed the initial administrator account:
```bash
npm run seed:admin
```

Start the backend development server:
```bash
npm run dev
```
*(The backend runs on `http://localhost:5000`)*

### 3. Frontend Setup

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```
*(The frontend runs on `http://localhost:5173`)*

---

## 🧪 Automated Testing

An automated end-to-end integration test is included that verifies all 14 core SRS features (Auth, Device Image Upload, Feeds, Likes, Comments, Follows, Search, Real-Time WebSockets, and Admin Moderation):

```bash
cd backend
npm run test:e2e
```

Or from the monorepo root:
```bash
npm run test:backend
```

---

