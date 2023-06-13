// Get the user parameter from the URL
const urlParams = new URLSearchParams(window.location.search);
const user = urlParams.get("user");
const fontSize = urlParams.get("font-size");
const stroke = urlParams.get("stroke");
const animate = urlParams.get("animate");
const fade = urlParams.get("fade");
const showBadges = urlParams.get("badges");
const hideCommands = urlParams.get("commands");
const hideBots = urlParams.get("bots");
let maxMessages = 250;

/* Customisation */

if (fontSize == "Small") {
  const smallFont = document.createElement("link");
  smallFont.rel = "stylesheet";
  smallFont.href = "assets/size_small.css";
  document.head.appendChild(smallFont);
} else if (fontSize == "Medium") {
  const mediumFont = document.createElement("link");
  mediumFont.rel = "stylesheet";
  mediumFont.href = "assets/size_medium.css";
  document.head.appendChild(mediumFont);
} else if (fontSize == "Large") {
  const largeFont = document.createElement("link");
  largeFont.rel = "stylesheet";
  largeFont.href = "assets/size_large.css";
  document.head.appendChild(largeFont);
}

if (stroke == "Thin") {
  const thinStroke = document.createElement("link");
  thinStroke.rel = "stylesheet";
  thinStroke.href = "assets/stroke_thin.css";
  document.head.appendChild(thinStroke);
} else if (stroke == "Medium") {
  const mediumStroke = document.createElement("link");
  mediumStroke.rel = "stylesheet";
  mediumStroke.href = "assets/stroke_medium.css";
  document.head.appendChild(mediumStroke);
} else if (stroke == "Thick") {
  const thickStroke = document.createElement("link");
  thickStroke.rel = "stylesheet";
  thickStroke.href = "assets/stroke_thick.css";
  document.head.appendChild(thickStroke);
} else if (stroke == "Thicker") {
  const thickerStroke = document.createElement("link");
  thickerStroke.rel = "stylesheet";
  thickerStroke.href = "assets/stroke_thicker.css";
  document.head.appendChild(thickerStroke);
}

// Store names and colours
let name_colours = {};

// If the user parameter is not set, redirect to the /index.html page
if (!user) {
  window.location.replace("/");
}

let subBadges;

async function fetchData(url) {
  let response;
  while (!response || !response.ok) {
    try {
      response = await fetch(url);
      if (!response.ok) {
        console.log("Error: " + response.status);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log("Error: " + error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return response;
}

async function getChannelInfo() {
  const response = await fetchData(`https://kick.com/api/v2/channels/${user}`);
  const data = await response.json();

  console.log("Fetching chatroom ID for user " + user + "...");
  console.log("Fetching channel ID for user " + user + "...");
  subBadges = data.subscriber_badges;
  // Sort sub badges by months
  subBadges.sort((a, b) => (a.months > b.months ? 1 : -1));
  return response.status, data.chatroom.id;
}

getChannelInfo().then((chatroomID) => {
  console.log("Chatroom ID: " + chatroomID);
  console.table(subBadges);
  main(chatroomID);
});

function main(chatroomID) {
  const chat = new WebSocket("wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c?protocol=7&client=js&version=7.4.0&flash=false");
  console.log("Connecting to Pusher...");
  console.log(chat);

  chat.onerror = (error) => {
    console.log("Error: " + error);
  };

  chat.onopen = () => {
    console.log("Connected to Pusher");
    document.getElementById("loading").innerHTML = "Connected";
    // 2 seconds after connecting, remove the loading screen
    setTimeout(() => {
      document.getElementById("loading").style.display = "none";
    }, 1000);
    chat.send(
      JSON.stringify({
        event: "pusher:subscribe",
        data: {
          auth: "",
          channel: `chatrooms.${chatroomID}.v2`,
        },
      })
    );
    chat.send(
      JSON.stringify({
        event: "pusher:subscribe",
        data: {
          auth: "",
          channel: `channel.${chatroomID + 2}`,
        },
      })
    );
  };

  chat.onmessage = (event) => {
    parseMessage(event.data);
  };

  // Ping every 1 minute to keep the connection alive
  setInterval(() => {
    chat.send(
      JSON.stringify({
        event: "pusher:ping",
        data: {},
      })
    );
  }, 60000);
}

function parseMessage(message) {
  const msg = JSON.parse(message);
  // Remove all the \ from message.data
  const data = JSON.parse(
    msg.data
      .replace(/\\u00a0/g, " ")
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\f/g, " ")
      .replace(/\\b/g, " ")
      .replace(/\\v/g, " ")
      .replace(/\\\\/g, "\\")
  );
  // If the data begins with "pusher", it's a pusher message, just console.log it
  if (msg.event.startsWith("pusher")) {
    if (!msg.event == "pusher:pong") {
      console.log(data);
    }
  } else if (msg.event == "App\\Events\\ChatMessageEvent") {
    console.log("Sent:");
    console.log(data);
    handleMessage(data);
  } else if (msg.event == "App\\Events\\MessageDeletedEvent") {
    console.log("Deleted:");
    console.log(data);
    handleDelete(data);
  } else if (msg.event == "App\\Events\\ChatMessageReact") {
    console.log("Reacted:");
    console.log(data);
    handleReact(data);
  } else if (msg.event == "App\\Events\\UserBannedEvent") {
    console.log("Banned:");
    console.log(data);
    handleBan(data);
  } else if (msg.event == "App\\Events\\ChatroomClearEvent") {
    console.log("Cleared:");
    console.log(data);
    handleClear(data);
  } else {
    console.log(msg.event);
  }
}

function handleMessage(data) {
  let msgID = data.id;
  let msgContent = data.content;
  let msgSender = data.sender.username;
  let msgTimestamp = data.created_at;

  if (hideCommands == "true") {
    if (msgContent.startsWith("!")) {
      return;
    }
  }

  if (hideBots == "true") {
    let bots = ["livebot", "corardbot", "botrix"];
    if (bots.includes(msgSender.toLowerCase())) {
      return;
    }
  }

  // Handle emotes
  let emoteRegex = /\[emote:(\d+):?([\w\s\-~!@#$%^&*()_+=\{}\\|;:'",.<>\/?]+)\]/g; // Old regex: /\[emote:(\d+):(\w+)\]/g // New regex: /\[emote:(\d+):(\w+\s?\w*)\]/g
  let emoteMatches = msgContent.match(emoteRegex);
  if (emoteMatches) {
    for (let i = 0; i < emoteMatches.length; i++) {
      let emoteMatch = emoteMatches[i];
      let emoteId = emoteMatch.match(/\[emote:(\d+):?([\w\s\-~!@#$%^&*()_+=\{}\\|;:'",.<>\/?]+)\]/)[1];

      msgContent = msgContent.replace(emoteMatch, `<img src="https://d2egosedh0nm8l.cloudfront.net/emotes/${emoteId}/fullsize" class="emote">`);
    }
  }

  // Handle Kick Emojis
    let kickEmojiRegex = /\[emoji:(\w+)\]/g;
    let kickEmojiMatches = msgContent.match(kickEmojiRegex);
    if (kickEmojiMatches) {
      for (let i = 0; i < kickEmojiMatches.length; i++) {
        let kickEmojiMatch = kickEmojiMatches[i];
        let kickEmojiName = kickEmojiMatch.match(/\[emoji:(\w+)\]/)[1];

        msgContent = msgContent.replace(
          kickEmojiMatch,
          `<img src="https://dbxmjjzl5pc1g.cloudfront.net/9ad84c86-99f0-4f0a-8e1a-baccf20502b9/images/emojis/${kickEmojiName}.png" class="emote">`
        );
      }
    }

  // Create the message element
  let msg = document.createElement("div");
  msg.classList.add("chat_line");

  // Add data attributes to the message element
  msg.setAttribute("data-id", msgID);
  msg.setAttribute("data-sender", msgSender);
  msg.setAttribute("data-timestamp", msgTimestamp);

  // Add a child span element for the user info
  let msgInfo = document.createElement("span");
  msgInfo.classList.add("user_info");

  // Add badges
  if (showBadges == "true") {
    msgInfo.innerHTML = badges(data);
  } else {
    msgInfo.innerHTML = "";
  }

  // Add a child span element for the username
  let msgUsernameSpan = document.createElement("span");
  msgUsernameSpan.classList.add("username");
  // Add a random pastel color to the username
  msgUsernameSpan.style.color = data.sender.identity.color;
  msgUsernameSpan.innerHTML = msgSender;

  // Add a child span element for the colon
  let msgColonSpan = document.createElement("span");
  msgColonSpan.classList.add("colon");
  msgColonSpan.innerHTML = ": ";

  // Append the username and colon to the user info
  msgInfo.appendChild(msgUsernameSpan);
  msgInfo.appendChild(msgColonSpan);

  // Add a child span element for the message content
  let msgContentSpan = document.createElement("span");
  msgContentSpan.classList.add("message_content");
  msgContentSpan.innerHTML = msgContent;

  // Add the user info and message content to the message element
  msg.appendChild(msgInfo);
  msg.appendChild(msgContentSpan);

  // Animate the message up
  if (animate) {
    msg.classList.add("animate");
  }

  if (fade) {
    // Fade out after fade seconds
    setTimeout(() => {
      msg.classList.add("fade");
      setTimeout(() => {
        msg.remove();
      }, 1000);
    }, fade * 1000);
  }

  // Remove messages outside of the max message limit
  if (maxMessages > 0) {
    let messages = document.querySelectorAll(".chat_line");
    if (messages.length > maxMessages) {
      messages[0].remove();
    }
  }

  // Add the message element to the chat
  document.getElementById("chat-container").appendChild(msg);
}

function handleDelete(data) {
  let msgID = data.message.id;

  // Delete the div with the data-id attribute matching the deleted message's ID
  document.querySelector(`[data-id="${msgID}"]`).remove();
}

function handleReact(data) {
  return;
}

function handleBan(data) {
  let bannedUser = data.user.username;

  // Delete all messages where data-sender attribute matches the banned user's username
  document.querySelectorAll(`[data-sender="${bannedUser}"]`).forEach((msg) => {
    msg.remove();
  });
}

function handleClear(data) {
  document.getElementById("chat-container").innerHTML = "";
}

function badges(data) {
  let badgesArray = "";
  let userBadges = data.sender.identity.badges;

  for (let i = 0; i < userBadges.length; i++) {
    if (userBadges[i].type == "subscriber") {
      let subAge = userBadges[i].count;
      // Loop through the subBadges array and apply the badge that matches the subAge or the closest one below it
      subBadges.sort((a, b) => b.months - a.months);
      for (let j = 0; j < subBadges.length; j++) {
        if (subAge >= subBadges[j].months) {
          badgesArray += `<img src="${subBadges[j].badge_image.src}" class="badge ${subBadges[j].text}"></img>`;
          break;
        }
      }

      continue;
    }
    badgesArray += `<img src="assets/img/${userBadges[i].type}.svg" class="badge ${userBadges[i].text}"></img>`;
  }

  return badgesArray;
}
