require("dotenv").config();
const Client = require("../index");

(async () => {
  const instance = new Client(process.env.TOKEN, {
    showSteps: true,
  });

  const client = await instance.init({
    bot: "NetnairEvilV1",
    noPattern: false,
  });

  let messages = [
    "Hi",
    "I want to know what makes a person happy",
    "I meant drinks",
    "I correct, alcoholic drink",
    "I want to buy one and surprise my friend with it. What kind do you suggest?",
  ];

  let requests = [];

  for (let i in messages) {
    const message = messages[i];

    requests.push(
      new Promise(async (resolve, rej) => {
        await client.sendMessage(
          {
            message: message,
            withChatBreak: true,
          },
          (res, text) => {
            resolve(text);
          },
        );
      }),
    );
  }

  const res = await Promise.all(requests);

  console.log(res);
})();
