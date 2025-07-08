const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb'); // ✅ Add ObjectId
const bodyParser = require('body-parser');
const cors = require('cors');

dotenv.config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbname = 'password_manager';
const app = express();
const port = 3000;

client.connect();
app.use(bodyParser.json());
app.use(cors());

//  GET all passwords
app.get('/', async (req, res) => {
  const db = client.db(dbname);
  const collection = db.collection('passwords');
  const passwords = await collection.find({}).toArray();
  res.json(passwords);
});

//  POST: Add new password
app.post('/', async (req, res) => {
  const db = client.db(dbname);
  const collection = db.collection('passwords');
  const passwordData = req.body;
  const result = await collection.insertOne(passwordData);
  res.send({ success: true, result });
});

// DELETE: Remove password by _id
app.delete('/', async (req, res) => {
  const db = client.db(dbname);
  const collection = db.collection('passwords');
  const { _id } = req.body;

  if (!_id) {
    return res.status(400).send({ success: false, message: 'Missing _id' });
  }

  try {
    const result = await collection.deleteOne({ _id: new ObjectId(_id) });
    if (result.deletedCount === 1) {
      res.send({ success: true, result });
    } else {
      res.status(404).send({ success: false, message: 'Password not found' });
    }
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
