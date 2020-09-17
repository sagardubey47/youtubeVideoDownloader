console.log("hello");

const express = require("express");
const app = express();

// my addition

const path = require('path');
app.use(express.static(path.join(__dirname, 'build')));

app.get("/", function(req, res) {
     
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});




const bodyParser = require("body-parser");
const routes = require("./config/routes");

let PORT = process.env.PORT;

if(PORT == null || PORT == "") {
   PORT = 5050;
}

const ytCOntroller = require("./controller/youtubeDownload");

app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use("/", routes);

const server = app.listen(PORT);
const io = require("./socket").init(server);

app.set("socketio", io);

io.on("connection", (socket) => {
  socket.on("connect_failed", (err) => {
    console.log("here");
  });

  socket.on("disconnect", function (socket) {
    console.log("here disconnet");
  });
});
