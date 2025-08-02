// authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient } = require("mongodb");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

let usersCollection;

// Connect users collection (from your existing DB)
async function setupAuthRoutes(client) {
  const db = client.db("Passwordmanager");
  usersCollection = db.collection("users");
}

// Signup
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const existing = await usersCollection.findOne({ email });
  if (existing) return res.status(400).json({ message: "Email already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await usersCollection.insertOne({ email, password: hashedPassword });
  res.send({ success: true, userId: result.insertedId });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await usersCollection.findOne({ email });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "2h" });
  res.send({ success: true, token });
});

module.exports = { router, setupAuthRoutes };
