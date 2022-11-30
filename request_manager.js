const fetch = require("node-fetch");

async function startTimer(requestBody) {
  let now = new Date();
  let duration = -Math.floor(now / 1000);
  let start = now.toISOString().split(".")[0] + "Z";
  let postBody = JSON.stringify({
    created_with: "pomodoneapp-webhook-helper",
    description: requestBody.description,
    pid: 183274766,
    tags: ["Work"],
    billable: false,
    workspace_id: 6502875,
    duration,
    start,
    stop: null,
  });
  console.log("postBody", postBody);
  return await fetch(
    "https://api.track.toggl.com/api/v9/workspaces/6502875/time_entries",
    {
      method: "POST",
      headers: {
        Authorization: process.env.AUTH_TOKEN,
      },
      body: postBody,
    }
  );
}

module.exports.startTimer = startTimer;
