const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.text()); // Add text parser for plain text data

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// MongoDB connection
// Direct MongoDB URI instead of using environment variables
const MONGODB_URI = "mongodb+srv://ghulammohiuddin7986_db_user:j72M70BodpBi2XLC@cluster0.v0cmbbf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// MongoDB connection with retry logic
const connectWithRetry = () => {
  console.log('Attempting MongoDB connection...');
  
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    w: "majority"
  })
    .then(() => {
      console.log("✅ MongoDB Connected");
    })
    .catch(err => {
      console.log("❌ MongoDB Connection Error:", err);
      console.log("🔄 Server will continue running, retrying connection in 5 seconds...");
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

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

// In-memory storage as fallback when MongoDB is unavailable
const inMemoryLogs = [];

// Handler function for device data
async function handleDeviceData(req, res) {
  try {
    let logData;
    
    // Check if the request is plain text or JSON
    if (typeof req.body === 'string') {
      console.log("📥 Received plain text data from device");
      console.log("Raw data:", req.body);
      
      // Process tab-delimited text data
      const rows = req.body.trim().split('\n');
      const processedData = [];
      
      for (const row of rows) {
        console.log("Processing row:", row);
        // Split by tabs or multiple spaces and trim each field
        const fields = row.split(/[\t]+|\s{2,}/).map(field => field.trim()).filter(f => f);
        console.log("Fields extracted:", fields);
        
        // Only process rows with enough data
        if (fields.length >= 3) {
          const entry = {
            PIN: fields[0],                // User ID
            DateTime: fields[1],           // Timestamp
            Status: parseInt(fields[2]),   // Check-in/Check-out status
            Verified: parseInt(fields[3]), // Verification type
            RawText: row
          };
          
          processedData.push(entry);
          
          // Create log entry for each row
          logData = {
            SN: "ZKTeco-Device",
            PIN: entry.PIN,
            Verified: entry.Verified,
            Status: entry.Status,
            DateTime: entry.DateTime,
            RawData: entry
          };
          
          // Save each entry to memory (don't pass res to avoid multiple responses)
          await saveLogData(logData);
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `Processed ${processedData.length} records from plain text data` 
      });
    } else {
      // Handle JSON data (original implementation)
      const data = req.body;
      console.log("📥 Received JSON data from device:", data);

      // Map ZKTeco SpeedFace V5L[P] JSON to schema
      logData = {
        SN: data.SN || data.SerialNumber || "Unknown-Device",
        PIN: data.PIN || data.UserID || "Unknown-User",
        Verified: data.Verified !== undefined ? data.Verified : data.VerifyMode || 0,
        Status: data.Status !== undefined ? data.Status : 0,
        DateTime: data.DateTime || data.Timestamp || new Date().toISOString(),
        RawData: data
      };
    }
    
    // For JSON data, save it directly
    if (typeof req.body !== 'string') {
      return await saveLogData(logData, res);
    }
} catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
}

// Helper function to save log data to MongoDB or memory
async function saveLogData(logData, res = null) {
  try {
    if (mongoose.connection.readyState === 1) {
      const log = new Log(logData);
      const savedLog = await log.save();
      console.log("✅ Data saved to MongoDB:", savedLog._id);
      
      if (res) {
        return res.status(200).json({ success: true, message: "Data saved to MongoDB", id: savedLog._id });
      }
      return { success: true, id: savedLog._id };
    } else {
      // Fallback to in-memory storage
      const memoryId = Date.now().toString();
      logData._id = memoryId;
      inMemoryLogs.push(logData);
      console.log("📝 Data saved to memory storage:", memoryId);
      
      if (res) {
        return res.status(200).json({ success: true, message: "Data saved to memory storage", id: memoryId });
      }
      return { success: true, id: memoryId };
    }
  } catch (err) {
    // Handle all errors (including MongoDB errors)
    console.error("⚠️ Error in saveLogData:", err.message);
    
    // Fallback to in-memory storage on any error
    const memoryId = Date.now().toString();
    try {
      logData._id = memoryId;
      inMemoryLogs.push(logData);
      console.log("📝 Data saved to memory storage:", memoryId);
      
      if (res) {
        return res.status(200).json({ success: true, message: "Data saved to memory storage", id: memoryId });
      }
      return { success: true, id: memoryId };
    } catch (fallbackErr) {
      console.error("❌ Critical error - even fallback failed:", fallbackErr.message);
      if (res) {
        return res.status(500).json({ error: "Server Error", message: err.message });
      }
      return { success: false, error: err.message };
    }
  }
}

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Multiple endpoints for ZKTeco device compatibility
app.post('/api/zkpush', handleDeviceData);
app.post('/', handleDeviceData);
app.post('/push', handleDeviceData);
app.post('/device', handleDeviceData);

const PORT = 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API endpoint available at http://zkapi.render.com/api/zkpush`);
  console.log(`💡 Configure your ZKTeco device to send data to this endpoint`);
});

// Properly handle shutdown signals for deployment platforms
const gracefulShutdown = (signal) => {
  console.log(`${signal} signal received: closing HTTP server`);
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
  
  // Force close if graceful shutdown fails
  setTimeout(() => {
    console.log('Forcing process exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon restarts