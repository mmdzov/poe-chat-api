const Client = require("./client");

class Group {
  constructor(clients = [new Client()]) {
    this.clients = clients;
  }

  async sendMessage(
    params = {
      message,
      withChatBreak: true,
      messageId: 0,
      paginationMethod: false,
      paginationCount: 10,
      paginationRefreshDelay: 3000, //ms
    },
  ) {
    const getLenMsgQueue = (client) =>
      client.answering.array.length + client.answerQueue.array.length;

    const client = this.clients.sort(
      (a, b) => getLenMsgQueue(a) - getLenMsgQueue(b),
    )[0];

    return await new Promise((res) => {
      client.sendMessage(params, (response, text) => res([response, text]));
    });
  }
}

module.exports = Group;
