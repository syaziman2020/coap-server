const coap = require("coap");
const mysql = require("mysql2/promise");
const express = require("express");
const routes = require("./routes");
const app = express();

// MySQL database connection
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "5916",
  database: "grape_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// db.connect((err) => {
//   if (err) {
//     console.error("Database connection error:", err);
//     return;
//   }
//   console.log("Connected to MySQL database");
// });

// Middleware untuk akses db di req
app.use((req, res, next) => {
  req.db = db;
  next();
});
app.use(express.static("assets"));
// Set view engine to EJS
app.set("view engine", "ejs");

// Gunakan routes untuk mengatur endpoint
app.use("/", routes);
app.set("views", "./views");

// Buat server HTTP
const httpPort = 3000;
app.listen(httpPort, () => {
  console.log(`HTTP server is running on http://localhost:${httpPort}`);
});

// Create CoAP server
const server = coap.createServer();

// Handler for node send logs endpoint
async function handleNodeSendLogs(req, res, body) {
  try {
    const data = JSON.parse(body);
    console.log(body);
    const { n: node_id, s: sequence, d: delay, p: payload_size, t: throughput } = data;

    if (!node_id || !sequence) {
      res.code = "4.00";
      res.end();
      return null;
    }

    // Insert new log entry
    const [result] = await db.query("INSERT INTO node_send_logs (node_id, sequence, delay, payload_size, throughput, created_at) VALUES (?, ?, NULL, NULL, NULL, NOW())", [node_id, sequence]);

    // Update previous entry if metrics exist
    if (delay !== undefined && payload_size !== undefined && throughput !== undefined) {
      await db.query(
        `UPDATE node_send_logs 
         SET delay = ?, payload_size = ?, throughput = ? 
         WHERE node_id = ? AND sequence = ? 
         AND delay IS NULL AND payload_size IS NULL AND throughput IS NULL`,
        [delay, payload_size, throughput, node_id, sequence - 1]
      );
    }

    res.code = "2.01";
    res.end();
    return result.insertId;
  } catch (error) {
    console.error("Error:", error);
    res.code = "5.00";
    res.end();
    return null;
  }
}

// Handler for INA sensor endpoint
async function handleINASensor(req, res, body) {
  try {
    const data = JSON.parse(body);
    console.log(body);
    const { n: node_id, s: sequence, c: current, v: voltage, p: power, w: power_consumption } = data;

    if (!node_id || !sequence) {
      res.code = "4.00";
      res.end();
      return;
    }

    const [logRows] = await db.query("SELECT id FROM node_send_logs WHERE node_id = ? AND sequence = ? ORDER BY created_at DESC LIMIT 1", [node_id, sequence]);

    if (logRows.length === 0) {
      res.code = "4.04";
      res.end();
      return;
    }

    await db.query("INSERT INTO ina (log_id, current, voltage, power, power_consumption,sequence, created_at) VALUES (?, ?, ?,?, ?, ?, NOW())", [logRows[0].id, current, voltage, power, power_consumption, sequence]);

    res.code = "2.01";
    res.end();
  } catch (error) {
    console.error("Error:", error);
    res.code = "5.00";
    res.end();
  }
}

// Handler for DHT sensor endpoint
async function handleDHTSensor(req, res, body) {
  try {
    const data = JSON.parse(body);
    const { n: node_id, s: sequence, t: temperature, h: humidity } = data;

    if (!node_id || !sequence) {
      res.code = "4.00";
      res.end();
      return;
    }

    const [logRows] = await db.query("SELECT id FROM node_send_logs WHERE node_id = ? AND sequence = ? ORDER BY created_at DESC LIMIT 1", [node_id, sequence]);

    if (logRows.length === 0) {
      res.code = "4.04";
      res.end();
      return;
    }

    await db.query("INSERT INTO dht (log_id, temperature, humidity,sequence, created_at) VALUES (?, ?, ?,?, NOW())", [logRows[0].id, temperature, humidity, sequence]);

    res.code = "2.01";
    res.end();
  } catch (error) {
    console.error("Error:", error);
    res.code = "5.00";
    res.end();
  }
}

// Handler for soil moisture sensor endpoint
async function handleSoilMoisture(req, res, body) {
  try {
    const data = JSON.parse(body);
    const { n: node_id, s: sequence, m: moisture_data } = data;

    if (!node_id || !sequence) {
      res.code = "4.00";
      res.end();
      return;
    }

    const [logRows] = await db.query("SELECT id FROM node_send_logs WHERE node_id = ? AND sequence = ? ORDER BY created_at DESC LIMIT 1", [node_id, sequence]);

    if (logRows.length === 0) {
      res.code = "4.04";
      res.end();
      return;
    }

    if (Array.isArray(moisture_data)) {
      for (const data of moisture_data) {
        const { o: order, v: value } = data;
        await db.query("INSERT INTO soil_moisture (log_id, sensor_order, moisture,sequence, created_at) VALUES (?, ?, ?,?, NOW())", [logRows[0].id, order, value, sequence]);
      }
    }

    res.code = "2.01";
    res.end();
  } catch (error) {
    console.error("Error:", error);
    res.code = "5.00";
    res.end();
  }
}

// Handle incoming CoAP requests
server.on("request", (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      switch (req.url) {
        case "/sensor/log":
          await handleNodeSendLogs(req, res, body);
          break;
        case "/sensor/ina":
          await handleINASensor(req, res, body);
          break;
        case "/sensor/dht":
          await handleDHTSensor(req, res, body);
          break;
        case "/sensor/moisture":
          await handleSoilMoisture(req, res, body);
          break;
        default:
          res.code = "4.04";
          res.end();
      }
    } catch (error) {
      console.error("Error:", error);
      res.code = "5.00";
      res.end();
    }
  });
});

server.listen(5683, () => console.log("CoAP server running"));
