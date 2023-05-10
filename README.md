
# Poe-chat-api

A Node.js library for connecting to GPT-3 via Poe.com


## Features

- Create bot
- Delete bot
- Send message
- Get messages
- Delete all messages
- Break chat


## Installation

```bash
    npm i poe-chat-api
```

In the next step you need to find your poe cookie from the poe website. To do this, follow the steps below

**Go to poe.com > Log in or register > Open inspect > Select the Application tab > Select the Cookies tab > Copy the cookie value named p-b**

Fill **YOUR-POE-COOKIE** with the copied value

```
const Client = require("poe-chat-api")

(async () => {
  const instance = new Client("YOUR-POE-COOKIE", {
    showSteps: true,
  });
})()

```


## Usage/Examples

### Create bot
```javascript
const Client = require("poe-chat-api");

(async () => {
  const instance = new Client("YOUR-POE-COOKIE", {
    showSteps: true,
  });

  const client = await instance.init();

  const res = await client.createBot({
    prompt: `Talk to me like a pirate.`,
  });

  console.log(res);
})();

```

### Send message
```javascript
const Client = require("poe-chat-api");

(async () => {
  const instance = new Client("YOUR-POE-COOKIE", {
    showSteps: true,
  });

  const client = await instance.init();

  await client.sendMessage(
    {
      message: "Hello world",
    },
    (response) => {
      console.log(response);
    },
  );
})();

```


### Get messages
```javascript
const Client = require("poe-chat-api");

(async () => {
  const instance = new Client("YOUR-POE-COOKIE", {
    showSteps: true,
  });

  const client = await instance.init();

  const messages = await client.getMessages({
    range: 2, // The last 2 messages
  });

  console.log(messages);
})();

```

### Send message bot
```javascript
const Client = require("poe-chat-api");

(async () => {
  const instance = new Client("YOUR-POE-COOKIE", {
    showSteps: true,
  });

  const client = await instance.init({ bot: "YOUR_POE_BOT_NAME" });

  await client.sendMessage(
    {
      message: "Hello world",
    },
    (response) => {
      console.log(response);
    },
  );
})();

```

