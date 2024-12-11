// controllers/index.js
const DBService = require("./services");

// Handler index
module.exports.index = async (req, res) => {
  try {
    const dbService = new DBService(req.db);

    // Get all data concurrently
    const [dhtData, inaData, soilData] = await Promise.all([dbService.getLatestDHT(), dbService.getLatestINA(), dbService.getLatestSoilMoisture()]);

    res.render("index", { dhtData, inaData, soilData });
  } catch (err) {
    console.error("Error retrieving data:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// Handler untuk halaman power consumption
module.exports.powerConsumption = async (req, res) => {
  try {
    const dbService = new DBService(req.db);
    const powerData = await dbService.getPowerConsumption();
    res.render("powerConsumption", { powerData });
  } catch (err) {
    console.error("Error retrieving power consumption data:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// Handler untuk halaman delay
module.exports.delay = async (req, res) => {
  try {
    const dbService = new DBService(req.db);
    const delayData = await dbService.getDelay();
    res.render("delay", { delayData });
  } catch (err) {
    console.error("Error retrieving delay data:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// Handler untuk halaman throughput
module.exports.throughput = async (req, res) => {
  try {
    const dbService = new DBService(req.db);
    const throughputData = await dbService.getThroughput();
    res.render("throughput", { throughputData });
  } catch (err) {
    console.error("Error retrieving throughput data:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// Controller untuk payload_size
module.exports.payloadSize = async (req, res) => {
  try {
    const dbService = new DBService(req.db);
    const payloadData = await dbService.getPayloadSize();
    res.render("payloadSize", { payloadData });
  } catch (err) {
    console.error("Error retrieving payload size data:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// Controller untuk log data
exports.getLogData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const dbService = new DBService(req.db);
    const result = await dbService.getLogs(page, limit);

    // Transform data for display
    const logs = result.data.map((log, index) => {
      const sensorData = [];

      // Add DHT data if exists
      if (log.dht) {
        if (log.dht.temperature !== null) sensorData.push(`Suhu: ${log.dht.temperature.toFixed(2)}°C`);
        if (log.dht.humidity !== null) sensorData.push(`Kelembaban Udara: ${log.dht.humidity.toFixed(2)}%`);
      }

      // Add soil moisture data if exists
      if (log.soil_moisture && log.soil_moisture.length > 0) {
        const soilReadings = log.soil_moisture.map((s) => `Pot ${s.sensor_order}: ${s.moisture.toFixed(2)}%`).join(", ");
        if (soilReadings) sensorData.push(soilReadings);
      }

      // Format INA data
      const inaData = log.ina
        ? [
            log.ina.current ? `Arus: ${log.ina.current.toFixed(2)}A` : null,
            log.ina.voltage ? `Tegangan: ${log.ina.voltage.toFixed(2)}V` : null,
            log.ina.power ? `Daya: ${log.ina.power.toFixed(2)}W` : null,
            log.ina.power_consumption ? `Konsumsi Daya: ${log.ina.power_consumption.toFixed(2)}Wh` : null,
          ]
            .filter(Boolean)
            .join(", ") || "-"
        : "-";

      const date = new Date(log.start_date);
      const formattedDate = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
        2,
        "0"
      )}:${String(date.getSeconds()).padStart(2, "0")}`;

      return {
        no: (page - 1) * limit + index + 1,
        nama: `Node ${log.nama}`,
        data_sensor: sensorData.length > 0 ? sensorData.join(", ") : "-",
        ina_data: inaData,
        delay: log.delay || "-",
        ukuran_paket: log.ukuran_paket || "-",
        throughput: log.throughput || "-",
        start_date: formattedDate,
      };
    });

    res.render("logs", {
      logs,
      pagination: result.pagination,
      query: {
        page,
        limit,
      },
    });
  } catch (err) {
    console.error("Error retrieving log data:", err);
    res.status(500).json({
      error: "Terjadi kesalahan saat mengambil data log",
    });
  }
};
