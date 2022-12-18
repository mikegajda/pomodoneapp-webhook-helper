"use strict";
const express = require("express");
const serverless = require("serverless-http");
const app = express();
const cors = require("cors");
let request_manager = require("./request_manager");

let allowedDomains = [
  "https://mikegajda.com",
  "https://michaelgajda.com",
  /\.mikegajda\.com$/,
  /\.michaelgajda\.com$/,
  /\.mikegajda\.netlify\.app$/,
];
app.use(express.json());
app.use(
  cors({
    origin: allowedDomains,
  })
);

const router = express.Router();
router.post("/startTimer", async (req, res) => {
  let response = await request_manager.startTimer(req.body);
  let body = await response.json();
  res.status(response.status).send(body);
});

router.post("/receiveWebhook", async (req, res) => {
  console.log("webhook body=", JSON.stringify(req.body));
  res.status(200).send("Success");
});

router.get("/stopCurrentTimer", async (req, res) => {
  let response = await request_manager.stopCurrentTimer();
  let body = await response.json();
  res.status(response.status).send(body);
});
// point the base route at the router
app.use("/", router);

// special for netlify functions, point /.netlify/functions at the router
app.use("/.netlify/functions/app", router); // route to netlify lambda

module.exports = app;
module.exports.handler = serverless(app);
