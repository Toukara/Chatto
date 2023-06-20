const urlParams = new URLSearchParams(window.location.search);
const channelName = urlParams.get("channel");

console;
// const channelName = "toukara";

const deleteMessageTimer = 300000; // 5 minutes per default

const baseUrl = "wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c";

const url = `${baseUrl}?protocol=7&client=js&version=7.4.0&flash=false`;

let subBadges;

async function fetchMsg(url) {
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
  const response = await fetchMsg(`https://kick.com/api/v2/channels/${channelName}`);
  const data = await response.json();

  console.log(`Fetching channel info for ${channelName}...`);
  subBadges = data.subscriber_badges;
  subBadges.sort((a, b) => (a.months > b.months ? 1 : -1));
  return data.chatroom.id;
}

async function handleMessages(msg) {
  // console.log(msg);

  let emoteRegex = /\[emote:(\d+):?([\w\s\-~!@#$%^&*()_+=\{}\\|;:'",.<>\/?]+)\]/g; // Old regex: /\[emote:(\d+):(\w+)\]/g // New regex: /\[emote:(\d+):(\w+\s?\w*)\]/g
  let emoteMatches = msg.content.match(emoteRegex);
  if (emoteMatches) {
    for (let i = 0; i < emoteMatches.length; i++) {
      let emoteMatch = emoteMatches[i];
      let emoteId = emoteMatch.match(/\[emote:(\d+):?([\w\s\-~!@#$%^&*()_+=\{}\\|;:'",.<>\/?]+)\]/)[1];

      msg.content = msg.content.replace(emoteMatch, `<img src="https://d2egosedh0nm8l.cloudfront.net/emotes/${emoteId}/fullsize" class="emote">`);
    }
  }

  let kickEmojiRegex = /\[emoji:(\w+)\]/g;
  let kickEmojiMatches = msg.content.match(kickEmojiRegex);
  if (kickEmojiMatches) {
    for (let i = 0; i < kickEmojiMatches.length; i++) {
      let kickEmojiMatch = kickEmojiMatches[i];
      let kickEmojiName = kickEmojiMatch.match(/\[emoji:(\w+)\]/)[1];

      msg.content = msg.content.replace(
        kickEmojiMatch,
        `<img src="https://dbxmjjzl5pc1g.cloudfront.net/9ad84c86-99f0-4f0a-8e1a-baccf20502b9/images/emojis/${kickEmojiName}.png" class="emote">`
      );
    }
  }

  const user = {
    username: msg.sender.username,
    id: msg.sender.id,
    color: msg.sender.identity.color,
    slug: msg.sender.slug,
    badges: msg.sender.identity.badges,
  };

  const messageElement = document.createElement("div");
  const userBadges = document.createElement("span");
  const username = document.createElement("span");
  const messageContent = document.createElement("span");

  messageElement.classList.add("message");
  userBadges.classList.add("user-badges");
  username.classList.add("username");
  username.style.color = user.color;
  messageContent.classList.add("message-content");

  username.innerText = `${user.username} :`;
  messageContent.innerHTML = msg.content;

  messageContent.setAttribute("data-sender-id", user.id);
  messageContent.setAttribute("message-id", msg.id);
  messageContent.setAttribute("timestamp", msg.created_at);

  if (user.badges.length > 0) {
    userBadges.innerHTML = await getBadges(user.badges);
  } else {
    userBadges.innerHTML = "";
  }

  username.prepend(userBadges);
  messageElement.appendChild(username);
  messageElement.appendChild(messageContent);

  console.log(messageElement);
  console.log(user.username + " : " + msg.content);

  document.getElementById("chat-container").appendChild(messageElement);
}

async function handleClearMessages() {
  console.log("Clearing messages...");

  document.getElementById("events").innerHTML = "Clearing messages...";
  document.getElementById("events").style.display = "block";
  setTimeout(() => {
    document.getElementById("events").innerHTML = "";
    document.getElementById("events").style.display = "none";
  }, 5000);
}

async function handleDeletedMessages(msg) {
  console.log("Deleting message...");

  console.log(msg.message.id);

  let message = document.querySelector(`[message-id="${msg.message.id}"]`);

  if (message) {
    message.parentElement.remove();
  } else {
    console.log("Message not found");
  }
}

async function handleBans(msg) {
  console.log("Banning user...");

  console.log(msg.user.id);

  let message = document.querySelector(`[data-sender-id="${msg.user.id}"]`);

  if (message) {
    message.parentElement.remove();
  } else {
    console.log("Message not found");
  }
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

async function main() {
  const channelId = await getChannelInfo();

  console.log("Chatroom ID: " + channelId);

  const chat = new WebSocket(url);
  console.log("Connecting to Pusher...");
  console.log(chat);

  chat.onerror = (error) => {
    console.log("Error: " + error);
  };

  chat.onopen = () => {
    console.log("Connected to Pusher");
    document.getElementById("events").innerHTML = "Connected";
    // 2 seconds after connecting, remove the loading screen
    setTimeout(() => {
      document.getElementById("events").innerHTML = "";
      document.getElementById("events").style.display = "none";
    }, 1000);
    chat.send(
      JSON.stringify({
        event: "pusher:subscribe",
        data: {
          auth: "",
          channel: `chatrooms.${channelId}.v2`,
        },
      })
    );
    chat.send(
      JSON.stringify({
        event: "pusher:subscribe",
        data: {
          auth: "",
          channel: `channel.${channelId + 2}`,
        },
      })
    );
  };

  chat.onmessage = (event) => {
    let parsedMsg = JSON.parse(event.data);

    if (parsedMsg.event == "pusher_internal:subscription_succeeded" || parsedMsg.event == "pusher:connection_established") return;

    const msg = JSON.parse(parsedMsg.data);

    const events = {
      chatMessage: "App\\Events\\ChatMessageEvent",
      messageDeleted: "App\\Events\\MessageDeletedEvent",
      userBanned: "App\\Events\\UserBannedEvent",
      chatroomClear: "App\\Events\\ChatroomClearEvent",
    };

    switch (parsedMsg.event) {
      case events.chatMessage:
        handleMessages(msg);
        break;
      case events.messageDeleted:
        handleDeletedMessages(msg);
        break;
      case events.userBanned:
        handleBans(msg);
        break;
      case events.chatroomClear:
        handleClearMessages(msg);
        break;
      default:
        console.log("Unknown or event not catched : " + parsedMsg.event);
        break;
    }
  };
}

main();
