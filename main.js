const channelName = "iceposeidon";

const deleteMessageTimer = 300000; // 5 minutes per default

const baseUrl = "wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c";
const urlParams = new URLSearchParams({
  protocol: "7",
  client: "js",
  version: "7.4.0",
  flash: "false",
});

const url = `${baseUrl}?${urlParams.toString()}`;

function connection(chatroomID) {
  const chat = new WebSocket(url);
  console.log("Connecting to chat...");
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

  setInterval(() => {
    chat.send(
      JSON.stringify({
        event: "pusher:ping",
        data: {},
      })
    );
  }, 60000);
}

async function parseMessage(message) {
  const parsedMessage = JSON.parse(message);
  const data = JSON.parse(
    parsedMessage.data
      .replace(/\\u00a0/g, " ")
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\f/g, " ")
      .replace(/\\b/g, " ")
      .replace(/\\v/g, " ")
      .replace(/\\\\/g, "\\")
  );

  if (!data) return;
  // console.log(data);
  const user = {
    username: data.sender.username,
    id: data.sender.id,
    color: data.sender.identity.color,
    slug: data.sender.slug,
    badges: data.sender.identity.badges,
  };

  let msgContent = data.content;

  let emoteRegex = /\[emote:(\d+):?([\w\s\-~!@#$%^&*()_+=\{}\\|;:'",.<>\/?]+)\]/g;
  let emoteMatches = msgContent.match(emoteRegex);
  if (emoteMatches) {
    for (let i = 0; i < emoteMatches.length; i++) {
      let emoteMatch = emoteMatches[i];
      let emoteId = emoteMatch.match(/\[emote:(\d+):?([\w\s\-~!@#$%^&*()_+=\{}\\|;:'",.<>\/?]+)\]/)[1];

      msgContent = msgContent.replace(emoteMatch, `<img src="https://d2egosedh0nm8l.cloudfront.net/emotes/${emoteId}/fullsize" class="emote">`);
    }
  }

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

  // console.log(user.badges);

  const messageElement = document.createElement("div");
  const userBadges = document.createElement("span");
  const username = document.createElement("span");
  const messageContent = document.createElement("span");

  messageElement.classList.add("message");
  userBadges.classList.add("user-badges");
  username.classList.add("username");
  username.style.color = user.color;
  messageContent.classList.add("message-content");

  username.innerText = user.username;
  messageContent.innerText = ` : ${data.content}`;

  if (user.badges.length > 0) {
    userBadges.innerHTML = await getBadges(user.badges);
    console.log(userBadges);
  } else {
    userBadges.innerHTML = "";
  }

  username.prepend(userBadges);
  messageElement.appendChild(username);
  messageElement.appendChild(messageContent);

  document.getElementById("chat-container").appendChild(messageElement);

  setTimeout(() => {
    console.log("Removing message");
    console.log(messageElement);
    messageElement.remove();
  }, deleteMessageTimer);
}

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

let subsBadges;

async function fetchChannelID(channelName) {
  const response = await fetchData(`https://kick.com/api/v2/channels/${channelName}`);
  const data = await response.json();

  console.log("Channel ID: " + data.user_id);

  // console.log(data);

  subsBadges = data.subscriber_badges;
  subsBadges.sort((a, b) => (a.months > b.months ? 1 : -1));

  console.log(subsBadges);

  return { channelID: data.user_id, chatroomID: data.chatroom.id };
}

async function main() {
  const { channelID, chatroomID } = await fetchChannelID(channelName);
  connection(chatroomID);
  // console.log(channelID);
}

async function getBadges(userBadges) {
  let badgesArray = "";

  for (let i = 0; i < userBadges.length; i++) {
    if (userBadges[i].type == "subscriber") {
      let subAge = userBadges[i].count;
      subsBadges.sort((a, b) => b.months - a.months);
      for (let j = 0; j < subsBadges.length; j++) {
        if (subAge >= subsBadges[j].months) {
          badgesArray += `<img src="${subsBadges[j].badge_image.src}" class="badge ${subsBadges[j].text}"></img>`;
          break;
        }
      }

      continue;
    }
    badgesArray += `<img src="./assets/svg/${userBadges[i].type}.svg" class="badge"></img>`;
  }

  // console.log(badgesArray);
  return badgesArray;
}

main();

// TODO LIST
// 1. Add emotes to chat
// 2. Possibly to change the font size of the chat (in parameters,etc..)
// 3. Possibly to change the font family of the chat (in parameters,etc..)

// GETS FEEEDBACK ON IT AND THEN IMPLEMENTS IT
