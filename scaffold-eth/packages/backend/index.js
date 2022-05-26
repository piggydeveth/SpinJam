import { NETWORKS } from "./constants.js";
// import deployedContracts from "./contracts/hardhat_contracts.json";
import wss from "websocket";
import http from "http";
import useStaticJSONRPC from "./useStaticJSONRPC.js";
import { ethers } from "ethers";
import { createRequire } from "node:module";
import Transactor from "./Transactor.js";
import getContractFuncs from "./getContractFuncs.js";

const require = createRequire(import.meta.url);
const deployedContracts = require("./contracts/hardhat_contracts.json");

const webSocketsServerPort = 8000;
const webSocketServer = wss.server;

async function main() {
  // Spinning the http server and the websocket server.
  const server = http.createServer();
  const wsServer = new webSocketServer({
    httpServer: server,
  });

  const initialNetwork = NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)
  const networkOptions = [initialNetwork.name, "mainnet", "rinkeby"];
  const targetNetwork = NETWORKS[networkOptions[0]];

  const contractJSON = deployedContracts[31337].localhost.contracts;
  let localProvider = await useStaticJSONRPC([
    process.env.REACT_APP_PROVIDER
      ? process.env.REACT_APP_PROVIDER
      : targetNetwork.rpcUrl,
  ]);

  const contracts = {};
  Object.keys(contractJSON).forEach((contractKey) => {
    contracts[contractKey] = new ethers.Contract(
      contractJSON[contractKey].address,
      contractJSON[contractKey].abi,
      localProvider
    );
  });
  console.log(Object.keys(contracts));
  console.log(
    "funcs",
    getContractFuncs(contracts.YourCollectible, localProvider)
  );
  const tx = Transactor(localProvider, null);

  // tx(contracts.YourCollectible.connect(localProvider));

  //  I'm maintaining all active connections in this object
  const clients = {};
  const drawings = {};
  const games = [];

  // todo: connect to network and get info from contract
  // -----------------
  const getTeams = (game) => {
    return { jo: "ma", ma: "jo" };
  };
  const nextPlayer = (game, player) => {
    const teams = getTeams(game);
    return teams[player];
  };
  const rsvpers = (game) => {
    return {};
  };
  const validGame = (gameNum) => {
    return true;
  };
  const validUser = (user, gameNum) => {
    return true || rsvpers(gameNum)[user];
  };
  // -----------------

  let queryParams = new URLSearchParams("");
  wsServer.on("request", function (request) {
    try {
      queryParams = new URLSearchParams(request.httpRequest.url.slice(2));
    } catch (e) {
      console.log("error in URLSearchParams", e);
      console.log("trying to parse", request.httpRequest.url.slice(2));
      console.log("from url", request.httpRequest.url);
      request.reject(400, "malformed request");
      return;
    }

    const gameNum = parseInt(queryParams.get("game"));
    if (isNaN(gameNum)) {
      console.log(
        "malformed request. Game should be a number got: '" + gameNum + "'"
      );
      request.reject(400, "malformed request. Game should be a number");
      return;
    }

    if (!validGame(gameNum)) {
      console.log("invalid game" + gameNum);
      request.reject(403, "invalid game");
      return;
    }

    const userID = queryParams.get("user");
    if (!validUser(gameNum, userID)) {
      console.log("user '" + userID + "' not allowed in game " + gameNum);
      request.reject(
        403,
        "user '" + userID + "' not allowed in game " + gameNum
      );
      return;
    }

    const teams = getTeams(gameNum);

    // You can rewrite this part of the code to accept only the requests from allowed origin
    const connection = request.accept(null, request.origin);

    wsServer.broadcast("user " + userID + " joined");

    connection.on("close", function (connection) {
      console.log("close connection for: ", userID);
      delete clients[userID];
      // delete drawings[userID];
    });

    connection.on("message", function (msg) {
      switch (msg.type) {
        case "string":
          console.log(msg.type);
          break;
        case "binary":
          console.log("bin data");
          if (!drawings[userID]) {
            drawings[userID] = [];
          }
          drawings[userID].push(msg.binaryData);
          clients[nextPlayer(gameNum, userID)].send(msg.binaryData, (e) => {
            console.log("err: ", e);
          });
          console.log("num of pics", drawings[userID].length);
          break;
        default:
          console.log(msg.type);
      }
    });

    clients[userID] = connection;
    console.log(
      "connected: " + userID + " in " + Object.getOwnPropertyNames(clients)
    );
  });

  server.listen(webSocketsServerPort);
}

main();
