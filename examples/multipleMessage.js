require("dotenv").config();
const Client = require("../index");
const Async = require("async");

(async () => {
  const instance = new Client(process.env.TOKEN, {
    showSteps: true,
  });

  const client = await instance.init();

  let messages = [
    "Hi",
    "I want to know what makes a person happy",
    "I meant drinks",
    "I correct, alcoholic drink",
    "I want to buy one and surprise my friend with it. What kind do you suggest?",
  ].map((msg) => ({ text: msg, answer: "" }));

  Async.eachSeries(messages, async (message, callback) => {
    const text = await new Promise(
      (resolve) => {
        client.sendMessage({ message: message.text }, (response) => {
          resolve(response.messages[0]?.payload?.data?.messageAdded?.text);
        });
      },
      (err) => {
        if (err) console.error(err);
        else {
          console.log(messages);
          message.answer = text;
          callback();
        }
      },
    );
  });
})();
