// services/dbService.js
class DBService {
  constructor(db) {
    this.db = db;
  }

  async getLatestDHT() {
    const [rows] = await this.db.query(`
        SELECT * FROM dht 
        WHERE temperature IS NOT NULL AND humidity IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      `);
    return rows[0] || null;
  }

  async getLatestINA() {
    const [rows] = await this.db.query(`
        SELECT n.node_id, n.created_at, i.current, i.voltage, i.power, i.power_consumption
        FROM node_send_logs n
        INNER JOIN (
            SELECT node_id, MAX(created_at) AS latest
            FROM node_send_logs
            WHERE node_id IS NOT NULL
            GROUP BY node_id
        ) latest_logs ON n.node_id = latest_logs.node_id AND n.created_at = latest_logs.latest
        LEFT JOIN ina i ON n.id = i.log_id
      `);
    return rows;
  }

  async getLatestSoilMoisture() {
    const [rows] = await this.db.query(`
        SELECT s.id, s.log_id, s.sensor_order, s.moisture, s.created_at
        FROM soil_moisture s
        INNER JOIN (
            SELECT sensor_order, MAX(created_at) AS latest
            FROM soil_moisture
            GROUP BY sensor_order
        ) latest_logs ON s.sensor_order = latest_logs.sensor_order AND s.created_at = latest_logs.latest
        ORDER BY s.sensor_order
      `);
    return rows;
  }

  async getPowerConsumption() {
    const [rows] = await this.db.query(`
        SELECT n.node_id, n.created_at, i.power_consumption 
        FROM node_send_logs n 
        INNER JOIN ina i ON n.id = i.log_id 
        WHERE n.node_id IN (1,2,3,4,5,6)
        AND i.power_consumption IS NOT NULL 
        ORDER BY n.created_at ASC
      `);
    return rows;
  }

  async getDelay() {
    const [rows] = await this.db.query(`
        SELECT node_id, created_at, delay
        FROM node_send_logs 
        WHERE node_id IN (1,2,3,4,5,6)
        AND delay IS NOT NULL
        ORDER BY created_at ASC
      `);
    return rows;
  }

  async getThroughput() {
    const [rows] = await this.db.query(`
        SELECT node_id, created_at, throughput
        FROM node_send_logs 
        WHERE node_id IN (1,2,3,4,5,6)
        AND throughput IS NOT NULL
        ORDER BY created_at ASC
      `);
    return rows;
  }

  async getPayloadSize() {
    const [rows] = await this.db.query(`
        SELECT node_id, created_at, payload_size 
        FROM node_send_logs 
        WHERE node_id IN (1,2,3,4,5,6) 
        AND payload_size IS NOT NULL 
        ORDER BY created_at ASC
      `);
    return rows;
  }

  async getLogs(page = 1, limit = 10) {
    try {
      // Get total count for pagination
      const [countResult] = await this.db.query(`
            SELECT COUNT(id) as total
            FROM node_send_logs
        `);
      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / limit);
      const offset = (page - 1) * limit;

      // Get paginated data
      const [nodes] = await this.db.query(
        `
            SELECT 
                id,
                node_id as nama,
                created_at as start_date,
                delay,
                payload_size as ukuran_paket,
                throughput
            FROM node_send_logs
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
        [limit, offset]
      );

      // Get related data for each node
      const processedRows = await Promise.all(
        nodes.map(async (node) => {
          // Get INA data
          const [inaData] = await this.db.query(
            `
                SELECT current, voltage, power, power_consumption
                FROM ina WHERE log_id = ?
            `,
            [node.id]
          );

          // Get DHT data
          const [dhtData] = await this.db.query(
            `
                SELECT temperature, humidity
                FROM dht WHERE log_id = ?
            `,
            [node.id]
          );

          // Get Soil Moisture data
          const [soilData] = await this.db.query(
            `
                SELECT sensor_order, moisture
                FROM soil_moisture 
                WHERE log_id = ?
                ORDER BY sensor_order ASC
            `,
            [node.id]
          );

          return {
            ...node,
            ina: inaData[0] || null,
            dht: dhtData[0] || null,
            soil_moisture: soilData || [],
          };
        })
      );

      return {
        data: processedRows,
        pagination: {
          total: totalItems,
          totalPages,
          currentPage: page,
          limit,
        },
      };
    } catch (error) {
      console.error("Database error:", error);
      throw error;
    }
  }
}

module.exports = DBService;
