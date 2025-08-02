const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
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
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from origin: ${origin}`), false);
  }
}));

let usersCollection;
let passwordCollection;

// JWT Middleware
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>
  if (!token) return res.status(401).json({ success: false, message: "Access token missing" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: "Invalid token" });
    req.user = user;
    next();
  });
}

async function startServer() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db(dbname);
    usersCollection = db.collection("users");
    passwordCollection = db.collection("passwords");

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

// ======= AUTH ROUTES =======

// Register
app.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await usersCollection.findOne({ email });
  if (existing) return res.status(400).json({ success: false, message: "Email already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  await usersCollection.insertOne({ name, email, password: hashedPassword });

  res.status(201).json({ success: true, message: "User created" });
});

// Login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await usersCollection.findOne({ email });
  if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });

  const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "2h" });

  res.json({ success: true, token, user: { id: user._id, email: user.email, name: user.name } });
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
