const axios = require("axios");
const Gql = require("./utils/Gql");
const WebSocket = require("ws");

class Client {
  gql_url = "/api/gql_POST";
  settings_url = "/api/settings";
  origin_url = "https://poe.com";

  channel = {};

  constructor(
    token,
    options = {
      showSteps: true,
    },
  ) {
    this.token = token;
    this.cookie = `p-b=${token}`;

    this.request = axios.create({
      baseURL: this.origin_url,
      headers: {
        Cookie: this.cookie,
        "content-type": "application/json",
        Referrer: "https://poe.com/",
        Origin: this.origin_url,
        Host: "poe.com",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9,und;q=0.8,af;q=0.7",
        "Cache-Control": "no-cache",
        Dnt: "1",
        Pragma: "no-cache",
        "Sec-Ch-Ua":
          '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Chrome OS"',
        "Sec-Gpc": "1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    this.MAX_RETRIES = 15;

    this.RETRY_DELAY = 2000;

    this.request.interceptors.request.use((config) => {
      config.retryCount = config.retryCount || 0;
      return config;
    });

    this.request.interceptors.response.use(
      (response) => response,
      (error) => {
        const { config } = error;

        console.log("Retrying :", config.retryCount);

        if (config.retryCount < this.MAX_RETRIES) {
          config.retryCount++;
          return new Promise((resolve) =>
            setTimeout(() => resolve(this.request(config)), this.RETRY_DELAY),
          );
        }

        return Promise.reject(error);
      },
    );
  }

  payload(queryName, variables = {}) {
    return { queryName, variables };
  }

  async getSettings() {
    console.log("Downloading Settings...");

    let query = "";

    if (Object.keys(this.channel).length > 0)
      query = `?channel=${this.channel.channel}`;

    try {
      let response = {};

      if (query)
        response = await this.request.get(`${this.settings_url}${query}`);
      else response = await this.request.get(this.settings_url);

      this.channel = response.data.tchannelData;
    } catch (e) {
      throw new Error(`Can't load Setting Data ${e}`);
    }
  }

  extractFormkey(html) {
    const script_regex = /<script>if\(.+\)throw new Error;(.+)<\/script>/;
    const script_text = html.match(script_regex)[1];
    const key_regex = /var .="([0-9a-f]+)",/;
    const key_text = script_text.match(key_regex)[1];
    const cipher_regex = /.?\[(\d+)\]=.?\[(\d+)\]/g;
    const cipher_pairs = script_text.matchAll(cipher_regex);

    const formkey_list = Array.from({ length: cipher_pairs.length }, () => "");
    for (const pair of cipher_pairs) {
      const formkey_index = parseInt(pair[1]);
      const key_index = parseInt(pair[2]);
      formkey_list[formkey_index] = key_text[key_index];
    }
    const formkey = formkey_list.join("");

    return formkey;
  }

  getNextData(overwrite_vars = false) {
    console.log("Downloading next_data...");

    return this.request
      .get(this.origin_url)
      .then((res) => {
        const jsonRegex =
          /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/;
        const jsonText = res.data.match(jsonRegex)[1];
        const nextData = JSON.parse(jsonText);

        if (overwrite_vars) {
          this.formkey = this.extractFormkey(res.data);
          this.viewer = nextData.props.pageProps.payload.viewer;
          this.next_data = nextData;
        }

        return nextData;
      })
      .catch((e) => {
        console.error(`Error in get_next_data: ${e}`);
      });
  }

  async sendMessage(
    params = { message, bot: "capybara", withChatBreak: true },
    callback = () => {},
  ) {
    await this.connectWebSocket();

    let counter = 0;

    const wsMessageHandler = (message) => {
      if (counter > 0) return;
      const response = message.toString("utf-8");

      let data = JSON.parse(response);

      data.messages = data.messages.map((item) => JSON.parse(item));

      this.ws.close(1011, "should_close");
      counter++;
      callback(data);
    };

    this.ws.on("message", wsMessageHandler);

    console.log("Sending message...");

    const chatId =
      this.next_data.props.pageProps?.payload?.chatOfBotDisplayName?.chatId;

    const gql = new Gql();

    gql
      .readyQuery("chatHelpers_sendMessageMutation_Mutation", {
        chatId: chatId,
        bot: params?.bot || "capybara",
        query: params.message,
        source: null,
        withChatBreak: params.withChatBreak || false,
      })
      .setHeaders(this.formkey, this.channel.channel);

    try {
      const res = await this.request.post(this.gql_url, gql.query, {
        headers: {
          ...gql.headers,
        },
      });
    } catch (e) {
      console.log(e);
    }

    return this;
  }

  async connectWebSocket() {
    console.log("WebSocket Connecting...");

    let ws = this.ws;

    const connect = async () => {
      if (!ws) {
        const wsDomain = Math.floor(Math.random() * 1000000) + 1;

        const query = `?min_seq=${this.channel?.minSeq}&channel=${this.channel?.channel}&hash=${this.channel?.channelHash}`;

        ws = new WebSocket(
          `wss://tch${wsDomain}.tch.${this.channel?.baseHost}/up/${this.channel?.boxName}/updates` +
            query,
          {},
        );

        this.ws = ws;
      }

      ws.on("close", async (code, reason) => {
        if (reason.includes("should_close"))
          return console.log("WebSocket Connection Closed");

        console.log("WebSocket disconnected!");
        if (this.wsRetryCount < this.MAX_RETRIES) {
          console.log(
            `Retrying WebSocket connection in ${this.RETRY_DELAY}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY));
          await connect();
          this.wsRetryCount++;
        } else {
          console.log(
            `WebSocket connection failed after ${this.MAX_RETRIES} attempts.`,
          );
        }
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });

      ws.on("unexpected-response", (e) => {
        console.log("Unexpected Response: ", e);
      });

      const openPromise = new Promise((res, rej) => {
        ws.on("open", () => {
          console.log("WebSocket connected!");
          this.wsRetryCount = 0;

          res(true);
        });
      });

      await openPromise;
    };

    await connect();

    return this;
  }

  async getMessages(
    options = {
      update: true,
      botMessagesOnly: false,
      humanMessagesOnly: false,
      textMessages: false,
      range: -1,
    },
  ) {
    if (!this.next_data || options?.update) await this.getNextData(false);

    let messages =
      this.next_data?.props?.pageProps?.payload?.chatOfBotDisplayName
        ?.messagesConnection?.edges || [];

    if (options?.botMessagesOnly)
      messages = messages.filter((item) => item.node.author === "capybara");
    else if (options?.humanMessagesOnly)
      messages = messages.filter((item) => item.node.author === "human");

    if (options?.textMessages)
      messages = messages.map((item) => item.node.text);

    if (options?.range > 0) messages = messages.slice(-options?.range);

    return messages;
  }

  async chatBreak() {
    console.log("Breaking Chat...");

    await this.getNextData();

    const data =
      this?.next_data?.props?.pageProps?.payload?.chatOfBotDisplayName;

    if (!data) throw new Error("The next_data Not Found");

    const gql = new Gql();

    gql
      .readyQuery("chatHelpers_addMessageBreakEdgeMutation_Mutation", {
        chatId: +data.chatId,
        connections: [
          `client:${data.id}:__ChatMessagesView_chat_messagesConnection_connection`,
        ],
      })
      .setHeaders(this.formkey, this.channel.channel);

    try {
      const res = await this.request.post(this.gql_url, gql.query, {
        headers: {
          ...gql.headers,
        },
      });
    } catch (e) {
      console.log(e);
    }
  }

  async subscribe() {
    await this.getNextData(true);

    console.log("Subscribing...");

    const AnnotateWithIdsProviderQuery = async () => {
      const gql = new Gql();

      gql
        .readyQuery("AnnotateWithIdsProviderQuery")
        .setHeaders(this.formkey, this.channel.channel);

      try {
        const res = await this.request.post(this.gql_url, gql.query, {
          headers: {
            ...gql.headers,
          },
        });
      } catch (e) {
        console.log(e);
      }
    };

    const subscriptionsMutation = async () => {
      const gql = new Gql();

      gql
        .readyQuery("subscriptionsMutation", {
          subscriptions: gql.getSubs(
            "messageAdded",
            "messageDeleted",
            "viewerStateUpdated",
            "viewerMessageLimitUpdated",
          ).subList,
        })
        .setHeaders(this.formkey, this.channel.channel);

      try {
        const res = await this.request.post(this.gql_url, gql.query, {
          headers: {
            ...gql.headers,
          },
        });
      } catch (e) {
        console.log(e);
      }
    };

    await AnnotateWithIdsProviderQuery();

    await subscriptionsMutation();
  }

  async initialize() {
    await this.getSettings();

    await this.subscribe();

    return this;
  }
}

module.exports = Client;