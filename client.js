const axios = require("axios");
const Gql = require("./utils/Gql");
const WebSocket = require("ws");

class Client {
  gql_url = "/api/gql_POST";
  settings_url = "/api/settings";
  home_url = "https://poe.com";

  channel = {};

  constructor(token) {
    this.token = token;
    this.cookie = `p-b=${token}`;

    this.request = axios.create({
      baseURL: "https://poe.com",
      headers: {
        Cookie: this.cookie,
        "content-type": "application/json",
      },
    });

    const MAX_RETRIES = 20;

    const RETRY_DELAY = 2000;

    this.request.interceptors.request.use((config) => {
      config.retryCount = config.retryCount || 0;
      return config;
    });

    this.request.interceptors.response.use(
      (response) => response,
      (error) => {
        const { config, response } = error;

        console.log("Retrying :", config.retryCount);
        if (config.retryCount < MAX_RETRIES) {
          config.retryCount++;
          return new Promise((resolve) =>
            setTimeout(() => resolve(this.request(config)), RETRY_DELAY),
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
      .get(this.home_url)
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
    let counter = 0;

    const wsMessageHandler = (message) => {
      if (counter > 0) return;
      const response = message.toString("utf-8");

      let data = JSON.parse(response);

      data.messages = data.messages.map((item) => JSON.parse(item));

      callback({ data });
      counter++;
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
      const res = await this.request.post("/api/gql_POST", gql.query, {
        headers: {
          ...gql.headers,
        },
      });

      return this;
    } catch (e) {
      console.log(e);
    }
  }

  async connectWebSocket() {
    console.log("WS Connecting...");

    const RETRY_INTERVAL_MS = 2000;
    const MAX_RETRIES = 20;

    let retryCount = 0;

    const wsDomain = Math.floor(Math.random() * 1000000) + 1;

    // console.log(this.channel);

    const query = `?min_seq=${this.channel?.minSeq}&channel=${this.channel.channel}&hash=${this.channel.channelHash}`;

    const ws = new WebSocket(
      `wss://tch${wsDomain}.tch.${this.channel.baseHost}/up/${this.channel.boxName}/updates` +
        query,
    );

    ws.on("close", () => {
      console.log("WebSocket disconnected!");
      if (retryCount < MAX_RETRIES) {
        console.log(
          `Retrying WebSocket connection in ${RETRY_INTERVAL_MS}ms...`,
        );
        setTimeout(this.connectWebSocket, RETRY_INTERVAL_MS);
        retryCount++;
      } else {
        console.log(
          `WebSocket connection failed after ${MAX_RETRIES} attempts.`,
        );
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    ws.on("unexpected-response", (e) => {
      console.log("Unexpected Response: ", e);
    });

    await new Promise((res, rej) => {
      ws.on("open", () => {
        console.log("WebSocket connected!");
        retryCount = 0;

        return res(true);
      });
    });

    this.ws = ws;
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
        const res = await this.request.post("/api/gql_POST", gql.query, {
          headers: {
            ...gql.headers,
          },
        });
        // console.log(res.data);
      } catch (e) {
        console.log(e);
      }
    };

    const subscriptionsMutation = async () => {
      const gql = new Gql();

      gql
        .readyQuery("subscriptionsMutation", {
          subscriptions: gql.setSubs(
            "messageAdded",
            "messageDeleted",
            "viewerStateUpdated",
            "viewerMessageLimitUpdated",
          ).subList,
        })
        .setHeaders(this.formkey, this.channel.channel);

      try {
        const res = await this.request.post("/api/gql_POST", gql.query, {
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

    await this.connectWebSocket();

    await this.subscribe();
    // await this.getNextData(true);

    return this;
  }
}

module.exports = Client;
