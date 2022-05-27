import { NETWORKS } from "./constants.js";
// import deployedContracts from "./contracts/hardhat_contracts.json";
import wss from "websocket";
import http from "http";
import useStaticJSONRPC from "./useStaticJSONRPC.js";
import { ethers, providers } from "ethers";
import { createRequire } from "node:module";
import Transactor from "./Transactor.js";
import getContractFuncs from "./getContractFuncs.js";

const require = createRequire(import.meta.url);
const deployedContracts = require("./contracts/hardhat_contracts.json");

const webSocketsServerPort = 8000;
const webSocketServer = wss.server;
const cache = {
  // {gameToPlayers: {gameID:{playerId:bool}}}
  gameToPlayers: {},
  // {gameToTeamInfo: {playerToTeam: {playerId:teamI}, assignedTeams: [teamI]{playerId:nextPlayerId}}}
  gameToTeamInfo: {},
};
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
  // let localProvider = new ethers.providers.JsonRpcProvider(
  //   targetNetwork.rpcUrl
  // );

  let localProvider = await useStaticJSONRPC([
    process.env.REACT_APP_PROVIDER
      ? process.env.REACT_APP_PROVIDER
      : targetNetwork.rpcUrl,
  ]);
  let signer = localProvider.getSigner();

  const burnerWallet = ethers.Wallet.createRandom();
  burnerWallet.connect(localProvider);

  const contracts = {};
  Object.keys(contractJSON).forEach((contractKey) => {
    contracts[contractKey] = new ethers.Contract(
      contractJSON[contractKey].address,
      contractJSON[contractKey].abi,
      localProvider
    );
  });

  const funcs = {
    YourCollectible: getContractFuncs(contracts.YourCollectible, signer),
    VRFv2Consumer: getContractFuncs(contracts.VRFv2Consumer, signer),
    YourContract: getContractFuncs(contracts.YourContract, signer),
  };

  let gasPrice = await localProvider.getGasPrice();
  const tx = Transactor(localProvider, gasPrice);

  //  I'm maintaining all active connections in this object
  const clients = {};
  const drawings = {};
  const games = [];

  // todo: connect to network and get info from contract
  // -----------------
  const fillPlayerCache = async (gameID) => {
    if (!cache.gameToPlayers[gameID]) {
      const players = {};
      const gameToPlayers = await funcs.YourContract.getGameToPlayers([gameID]);
      gameToPlayers.forEach((p) => {
        players[p] = true;
      });
      cache.gameToPlayers[gameID] = players;
    }
  };
  const gamePlayersFromCache = (gameID) => {
    return cache.gameToPlayers[gameID];
  };

  const getRandNum = async (gameID) => {
    // todo: hook up blockchain for randomness

    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  };

  const cacheTeams = (gameID, players, randNum, playersToATeam) => {
    if (!cache.gameToTeamInfo[gameID]) {
      const teamInfo = assignTeams([...players], randNum, playersToATeam);
      cache.gameToTeamInfo[gameID] = teamInfo;
    }
  };

  const assignTeams = (players, randNum, playersToATeam) => {
    const teams = [];
    const playerToTeam = {};
    const numOfTeams = Math.ceil(players.length / playersToATeam);
    for (let i = 0; i < numOfTeams; i++) {
      teams.push(new Array(0));
    }
    let i = 0;
    let playerI = 0;
    while (players.length) {
      const curPlayer = players.splice(playerI % players.length, 1)[0];
      const teamI = i++ % teams.length;
      teams[teamI].push(curPlayer);
      playerToTeam[curPlayer] = teamI;
      playerI += randNum;
    }
    return {
      playerToTeam,
      assignedTeams: teams.map((team) => {
        let newTeam = {};
        team.forEach((p, i) => {
          newTeam[p] = team[(i + 1) % team.length];
        });
        return newTeam;
      }),
    };
  };
  const getCachedTeamInfo = (gameID) => {
    return cache.gameToTeamInfo[gameID];
  };
  const getCachedTeams = (teamInfo) => {
    return teamInfo.assignedTeams;
  };
  const getMyTeamI = (teamInfo, userID) => {
    return teamInfo.playerToTeam[userID];
  };

  const nextPlayer = (team, userID) => {
    return team[userID];
  };
  const rsvpers = async (gameID) => {
    await fillPlayerCache(gameID);
    return gamePlayersFromCache(gameID);
  };
  const getGameID = async (gameNum) => {
    return await funcs.YourContract.gameSchedule([gameNum]);
  };
  const validGame = (gameID) => {
    return !!gameID;
  };
  const validUser = async (gameID, userID) => {
    return (await rsvpers(gameID))[userID];
  };
  // -----------------

  let queryParams = new URLSearchParams("");
  wsServer.on("request", async function (request) {
    try {
      queryParams = new URLSearchParams(request.httpRequest.url.slice(2));
    } catch (e) {
      console.log("error in URLSearchParams", e);
      console.log("trying to parse", request.httpRequest.url.slice(2));
      console.log("from url", request.httpRequest.url);
      await request.reject(400, "malformed request");
      return;
    }

    const gameNum = parseInt(queryParams.get("game"));
    if (isNaN(gameNum)) {
      console.log(
        "malformed request. Game should be a number got: '" + gameNum + "'"
      );
      await request.reject(400, "malformed request. Game should be a number");
      return;
    }
    const gameID = await getGameID(gameNum);
    if (!validGame(gameID)) {
      console.log("invalid gameNum " + gameNum + "and gameID " + gameID);
      await request.reject(403, "invalid game");
      return;
    }

    const userID = queryParams.get("user");
    if (!(await validUser(gameID, userID))) {
      console.log("user '" + userID + "' not allowed in game " + gameID);
      await request.reject(
        403,
        "user '" + userID + "' not allowed in game " + gameNum
      );
      return;
    }

    const playersToTeam = 5;
    const players = await gamePlayersFromCache(gameID);
    const randNum = await getRandNum(gameID);
    cacheTeams(gameID, Object.keys(players), randNum, playersToTeam);
    const teamInfo = getCachedTeamInfo(gameID);
    const teams = getCachedTeams(teamInfo);
    const myTeam = teams[getMyTeamI(teamInfo, userID)];

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

          clients[nextPlayer(myTeam, userID)].send(msg.binaryData, (e) => {
            if (e) {
              console.log("err: ", e);
            }
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
