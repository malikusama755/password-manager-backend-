const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dns").setServers(["8.8.8.8"]);

dotenv.config();

const uri = process.env.MONGO_URI;
const dbname = "Passwordmanager";
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
app.use(bodyParser.json());

const allowedOrigins = [
  "http://localhost:3000",
  "https://password-manager-frontend-ochre.vercel.app",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy does not allow access from origin: ${origin}`), false);
    }
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

let usersCollection;
let passwordCollection;

// JWT Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: "Access token missing" });

  const token = authHeader.split(" ")[1]; // Bearer <token>
  if (!token) return res.status(401).json({ success: false, message: "Access token missing" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: "Invalid token" });
    req.user = user;
    next();
  });
}

// Import and setup auth routes
const { router: authRouter, setupAuthRoutes } = require("./authRoutes");

async function startServer() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db(dbname);
    usersCollection = db.collection("users");
    passwordCollection = db.collection("passwords");

    // Setup auth routes with the connected client
    await setupAuthRoutes(client);
    app.use("/auth", authRouter);

    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server is live on http://localhost:${port}`);
    });

  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

startServer();

// Health Check
app.get("/health", (req, res) => {
  res.send("✅ Backend is live!");
});

// ======= PASSWORD ROUTES (Protected) =======

// Get passwords
app.get("/", authenticateToken, async (req, res) => {
  try {
    const passwords = await passwordCollection.find({ userId: req.user.id }).toArray();
    res.json(passwords);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add new password
app.post("/", authenticateToken, async (req, res) => {
  try {
    const passwordData = { ...req.body, userId: req.user.id };
    const result = await passwordCollection.insertOne(passwordData);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete password
app.delete("/", authenticateToken, async (req, res) => {
  const { _id } = req.body;

  if (!_id) return res.status(400).json({ success: false, message: "Missing _id" });

  try {
    const result = await passwordCollection.deleteOne({ _id: new ObjectId(_id), userId: req.user.id });

    if (result.deletedCount === 1) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Password not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
