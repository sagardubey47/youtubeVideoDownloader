const express = require("express");
const router = express.Router();

const youtubeDownloadController = require("../controller/youtubeDownload");

router.post("/youtube-downloader", youtubeDownloadController.downloads);

router.post(
  "/available-formats",
  youtubeDownloadController.getAvailableFormats
);

module.exports = router;
