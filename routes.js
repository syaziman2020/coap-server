const express = require("express");
const router = express.Router();
const viewController = require("./viewController");

// Route untuk mendapatkan data
router.get("/", viewController.index);

// Route untuk halaman powerConsumption
router.get("/powerConsumption", viewController.powerConsumption);

// Route untuk halaman delay
router.get("/delay", viewController.delay);

// Route untuk halaman throughput
router.get("/throughput", viewController.throughput);

// Route untuk halaman payload_size
router.get("/payloadSize", viewController.payloadSize);

// Route untuk halaman log
router.get("/logs", viewController.getLogData);

module.exports = router;
