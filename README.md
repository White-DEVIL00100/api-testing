# ZKTeco API Server

A Node.js server for receiving and storing attendance data from ZKTeco biometric devices.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with your MongoDB connection string:
   ```
   MONGODB_URI=your_mongodb_connection_string
   PORT=3000
   ```

3. Start the server:
   ```
   npm start
   ```

## Deployment on Render

1. Push this repository to GitHub
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Add the environment variable `MONGODB_URI` with your MongoDB connection string
5. Deploy the service

## API Endpoints

The server accepts POST requests with attendance data at the following endpoints:
- `/api/zkpush`
- `/`
- `/push`
- `/device`

## Data Format

The API accepts JSON data with the following fields:
```json
{
  "SN": "DeviceSerialNumber",
  "PIN": "UserID",
  "Verified": 1,
  "Status": 0,
  "DateTime": "2023-10-25T14:30:00Z"
}
```