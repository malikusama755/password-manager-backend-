require("dns").setServers(["8.8.8.8"]);
const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");
const cors = require("cors");

// Load environment variables
dotenv.config();

const uri = process.env.MONGO_URI;
const dbname = "Passwordmanager";
const port = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());

// Allow CORS from your frontend deployed on Vercel and localhost for testing
const allowedOrigins = [
  "http://localhost:3000",
  "https://password-manager-frontend.vercel.app" // Replace with your actual frontend domain if different
];

// Middleware for CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests like Postman
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy does not allow access from origin ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

let collection;

// Connect to MongoDB and start server
async function startServer() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db(dbname);
    collection = db.collection("passwords");

    app.listen(port, () => {
      console.log(`🚀 Server listening on port ${port}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

startServer();

// Health check endpoint
app.get("/health", (req, res) => {
  res.send("✅ Backend is live!");
});

// Get all passwords
app.get("/", async (req, res) => {
  try {
    const passwords = await collection.find({}).toArray();
    res.json(passwords);
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// Add new password
app.post("/", async (req, res) => {
  try {
    const passwordData = req.body;
    const result = await collection.insertOne(passwordData);
    res.send({ success: true, result });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// Delete password by _id
app.delete("/", async (req, res) => {
  const { _id } = req.body;

  if (!_id) {
    return res.status(400).send({ success: false, message: "Missing _id" });
  }

  try {
    const result = await collection.deleteOne({ _id: new ObjectId(_id) });

    if (result.deletedCount === 1) {
      res.send({ success: true, result });
    } else {
      res.status(404).send({ success: false, message: "Password not found" });
    }
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});
