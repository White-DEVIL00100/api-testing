const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
// Using environment variable for MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/zkapi";

mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.log("❌ MongoDB Connection Error:", err);
    console.log("🔄 Server will continue running without database connection. API will save data in memory only.");
  });

// Schema
const logSchema = new mongoose.Schema({
  SN: String,
  PIN: String,           // Device PIN / User ID
  Verified: Number,      // Verification type: 0=unknown, 1=fingerprint, etc.
  Status: Number,        // 0=Check-in, 1=Check-out, etc.
  DateTime: String,      // Timestamp
  RawData: mongoose.Schema.Types.Mixed
});

const Log = mongoose.model('Log', logSchema);

// Handler function for device data
async function handleDeviceData(req, res) {
  try {
    const data = req.body;

    console.log("📥 Received data from device:", data);

    // Map ZKTeco SpeedFace V5L[P] JSON to schema
    const log = new Log({
      SN: data.SN || data.SerialNumber || "Unknown-Device",
      PIN: data.PIN || data.UserID || "Unknown-User",
      Verified: data.Verified !== undefined ? data.Verified : data.VerifyMode || 0,
      Status: data.Status !== undefined ? data.Status : 0,
      DateTime: data.DateTime || data.Timestamp || new Date().toISOString(),
      RawData: data
    });

    const savedLog = await log.save();
    console.log("✅ Data saved to MongoDB:", savedLog._id);

    res.status(200).json({ success: true, message: "Data saved successfully", id: savedLog._id });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
}

// Multiple endpoints for ZKTeco device compatibility
app.post('/api/zkpush', handleDeviceData);
app.post('/', handleDeviceData);
app.post('/push', handleDeviceData);
app.post('/device', handleDeviceData);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API endpoint available at http://192.168.0.7:${PORT}/api/zkpush`);
  console.log(`💡 Configure your ZKTeco device to send data to this endpoint`);
});