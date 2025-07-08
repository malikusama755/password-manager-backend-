const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");
const cors = require("cors");

// Load environment variables
dotenv.config();

const uri = process.env.MONGO_URI;
const dbname = "password_manager";
const port = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(cors());

let collection; // Global variable for collection access

// Connect to MongoDB
async function startServer() {
  try {
    const client = new MongoClient(uri);

    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db(dbname);
    collection = db.collection("passwords");

    // Start the server after DB connects
    app.listen(port, () => {
      console.log(`🚀 Server listening on port ${port}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1); // Stop the app if DB fails
  }
}

startServer();

// GET all passwords
app.get("/", async (req, res) => {
  try {
    const passwords = await collection.find({}).toArray();
    res.json(passwords);
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// POST: Add new password
app.post("/", async (req, res) => {
  try {
    const passwordData = req.body;
    const result = await collection.insertOne(passwordData);
    res.send({ success: true, result });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// DELETE: Remove password by _id
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
