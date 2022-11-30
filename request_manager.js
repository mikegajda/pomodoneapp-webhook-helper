const fetch = require("node-fetch");

async function startTimer(body) {
  let now = new Date();
  let duration = -Math.floor(now / 1000);
  let start = now.toISOString().split(".")[0] + "Z";
  let body = JSON.stringify({
    created_with: "pomodoneapp-webhook-helper",
    description: body.description,
    pid: 183274766,
    tags: ["Work"],
    billable: false,
    workspace_id: 6502875,
    duration,
    start,
    stop: null,
  });
  console.log("body", body);
  return await fetch(
    "https://api.track.toggl.com/api/v9/workspaces/6502875/time_entries",
    {
      method: "POST",
      headers: {
        Authorization: process.env.AUTH_TOKEN,
      },
      body,
    }
  );
}

module.exports.startTimer = startTimer;
