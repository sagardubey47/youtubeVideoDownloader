const fs = require("fs");
const path = require("path");
const desktopPath = `${process.env["HOME"]}/Desktop/`;
const videoFolder = path.join(desktopPath, `/videos`);
const ytdl = require("ytdl-core");
const cp = require("child_process");
const ffmpeg = require("ffmpeg-static");
const readline = require("readline");

exports.getAvailableFormats = async (req, res) => {
  const url = req.body.link;
  const id = url.split("v=")[1];
  let info = await ytdl.getInfo(id);

  let formatHash = {};

  info.formats.forEach((element) => {
    if (
      element &&
      element.hasVideo &&
      element.quality &&
      element.container == "mp4"
    ) {
      formatHash[element.quality] = {
        qualityLabel: element.qualityLabel,
        quality: element.qualityLabel,
        container: element.container,
        itag: element.itag,
      };
    }
  });

  let availableFormats = Object.values(formatHash);
  console.log(availableFormats);
  return res.json({ availableFormats });
};

exports.downloads = async (req, res) => {
  const url = req.body.link;
  const quality = req.body.quality;
  const id = url.split("v=")[1];
  let download = false;

  const output = path.join(
    videoFolder,
    `${id}-${quality.qualityLabel || "auto"}.mp4`
  );

  if (fs.existsSync(output) && !download) {
    return res.json({ error: "File Already Exists" });
  } else {
    if (!fs.existsSync(videoFolder)) {
      fs.mkdirSync(videoFolder);
    }
    let io = require("../socket").getIO();

    const tracker = {
      start: Date.now(),
      audio: { downloaded: 0, total: Infinity },
      video: { downloaded: 0, total: Infinity },
      merged: { frame: 0, speed: "0x", fps: 0 },
    };

    let stream = ytdl(url, { quality: quality.itag });
    stream.on("progress", (_, downloaded, total) => {
      download = true;
      tracker.video = { downloaded, total };
    });

    let title;
    stream.on("info", (info) => {
      download = true;
      title = info.videoDetails.title;
    });

    let audio = ytdl(url, { filter: "audioonly" });
    audio.on("progress", (_, downloaded, total) => {
      tracker.audio = { downloaded, total };
    });

    let payload = {
      title,
      downloaded: 0,
      total: 0,
    };

    const progressbar = setInterval(() => {
      download = true;
      readline.cursorTo(process.stdout, 0);
      const toMB = (i) => (i / 1024 / 1024).toFixed(2);

      process.stdout.write(
        `Audio  | ${(
          (tracker.audio.downloaded / tracker.audio.total) *
          100
        ).toFixed(2)}% processed `
      );
      process.stdout.write(
        `(${toMB(tracker.audio.downloaded)}MB of ${toMB(
          tracker.audio.total
        )}MB).${" ".repeat(10)}\n`
      );

      process.stdout.write(
        `Video  | ${(
          (tracker.video.downloaded / tracker.video.total) *
          100
        ).toFixed(2)}% processed `
      );
      process.stdout.write(
        `(${toMB(tracker.video.downloaded)}MB of ${toMB(
          tracker.video.total
        )}MB).${" ".repeat(10)}\n`
      );

      process.stdout.write(
        `Merged | processing frame ${tracker.merged.frame} `
      );
      process.stdout.write(
        `(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${" ".repeat(
          10
        )}\n`
      );

      process.stdout.write(
        `running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(
          2
        )} Minutes.`
      );
      readline.moveCursor(process.stdout, 0, -3);

      if (tracker.audio.total != Infinity && tracker.video.total != Infinity) {
        let audioPercentage =
          (tracker.audio.downloaded / tracker.audio.total) * 100;
        let videoPercentage =
          (tracker.video.downloaded / tracker.video.total) * 100;
        let totalPercentage = audioPercentage + videoPercentage;
        payload.total = 200;
        payload.downloaded = totalPercentage;
        io.emit("downloadStatus", payload);
      }
    }, 1000);

    const ffmpegProcess = cp.spawn(
      ffmpeg,
      [
        // Remove ffmpeg's console spamming
        "-loglevel",
        "0",
        "-hide_banner",
        // Redirect/enable progress messages
        "-progress",
        "pipe:3",
        // 0.1 second audio offset
        "-itsoffset",
        "0.1",
        "-i",
        "pipe:4",
        "-i",
        "pipe:5",
        // Rescale the video
        "-vf",
        "scale=320:240",
        // Choose some fancy codes
        "-c:v",
        "libx265",
        "-x265-params",
        "log-level=0",
        "-c:a",
        "flac",
        // Define output container
        "-f",
        "matroska",
        "pipe:6",
      ],
      {
        windowsHide: true,
        stdio: [
          /* Standard: stdin, stdout, stderr */
          "inherit",
          "inherit",
          "inherit",
          /* Custom: pipe:3, pipe:4, pipe:5, pipe:6 */
          "pipe",
          "pipe",
          "pipe",
          "pipe",
        ],
      }
    );

    ffmpegProcess.stdio[3].on("data", (chunk) => {
      // Parse the param=value list returned by ffmpeg
      const lines = chunk.toString().trim().split("\n");
      const args = {};
      for (const l of lines) {
        const [key, value] = l.trim().split("=");
        args[key] = value;
      }

      tracker.merged = args;
    });

    audio.pipe(ffmpegProcess.stdio[5]);
    stream.pipe(ffmpegProcess.stdio[4]);

    ffmpegProcess.stdio[6].pipe(fs.createWriteStream(output));

    ffmpegProcess.on("close", () => {
      process.stdout.write("\n\n\n\n");
      clearInterval(progressbar);
      console.log("done");
      return res.json({
        status: "Success",
        message: "Video Downloaded",
      });
    });

    /* Spit-out information when recieved */

    // stream.on("progress", (_, downloaded, total) => {
    //   const payload = {
    //     title,
    //     downloaded: downloaded,
    //     total: total,
    //   };
    //   io.emit("downloadStatus", payload);
    //   return downloaded;
    // });

    // stream.on("end", () => {
    //   return res.json({
    //     status: "Success",
    //     message: "Video Downloaded",
    //   });
    // });
  }
};
