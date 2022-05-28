import { NETWORKS } from "./constants.js";
// import deployedContracts from "./contracts/hardhat_contracts.json";
import wss from "websocket";
import http from "http";
import useStaticJSONRPC from "./useStaticJSONRPC.js";
import { ethers, providers } from "ethers";
import { createRequire } from "node:module";
import getContractFuncs from "./getContractFuncs.js";
import createGifs from "./createGifs.js";
import fs from "fs";
import ipfsAPI from "ipfs-api";

const require = createRequire(import.meta.url);
const deployedContracts = require("./contracts/hardhat_contracts.json");

const ipfs = ipfsAPI("ipfs.infura.io", "5001", { protocol: "https" });

const NEXT_PICTURE = "NEXT_PICTURE";
const END_OF_GAME = "END_OF_GAME";
const WAITING_FOR_PLAYER = "WAITING_FOR_PLAYER";

const webSocketsServerPort = 8000;
const webSocketServer = wss.server;
const cache = {
  // {gameToPlayers: {gameID:{playerId:bool}}}
  gameToPlayers: {},
  // {gameToTeamInfo: {playerToTeam: {playerId:teamI}, assignedTeams: [teamI]{playerId:nextPlayerId}}}
  gameToTeamInfo: {},
};
async function main() {
  const numOfPicsInGame = 5;
  // Spinning the http server and the websocket server.
  const server = http.createServer();
  const wsServer = new webSocketServer({
    httpServer: server,
  });
  const initialNetwork = NETWORKS.rinkeby; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)
  const networkOptions = [initialNetwork.name, "mainnet", "rinkeby"];
  const targetNetwork = NETWORKS[networkOptions[0]];

  const contractJSON = deployedContracts[4].rinkeby.contracts;
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
    SpinJamGIF: getContractFuncs(contracts.SpinJamGIF, signer),
    SpinJamVRFv2Consumer: getContractFuncs(
      contracts.SpinJamVRFv2Consumer,
      signer
    ),
    SpinJamCoordinator: getContractFuncs(contracts.SpinJamCoordinator, signer),
  };

  let gasPrice = await localProvider.getGasPrice();
  console.log("gasPrice", gasPrice);
  //  I'm maintaining all active connections in this object
  const clients = {};
  // {gameID:{userID:[binData,...]}}
  const allDrawings = {};
  const games = [];

  // todo: connect to network and get info from contract
  // -----------------
  const fillPlayerCache = async (gameID) => {
    if (!cache.gameToPlayers[gameID]) {
      const players = {};
      const gameToPlayers = await funcs.SpinJamCoordinator.getGameToPlayers([
        gameID,
      ]);
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
    let next = team[userID];
    while (!clients[next] && next != userID) {
      next = team[next];
    }
    return next;
  };

  const rsvpers = async (gameID) => {
    await fillPlayerCache(gameID);
    return gamePlayersFromCache(gameID);
  };
  const getGameID = async (gameNum) => {
    console.log("getting game num ", gameNum);
    return await funcs.SpinJamCoordinator.gameSchedule([gameNum]);
  };
  const validGame = (gameID) => {
    return !!gameID;
  };
  const validUser = async (gameID, userID) => {
    return (await rsvpers(gameID))[userID];
  };
  // -----------------

  const reverseList = (list) => {
    var copy = {};
    Object.keys(list).forEach((k) => {
      copy[list[k]] = k;
    });
    return copy;
  };

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
    console.log("getting game");

    const gameID = await getGameID(gameNum);
    if (!validGame(gameID)) {
      console.log("invalid gameNum " + gameNum + "and gameID " + gameID);
      await request.reject(403, "invalid game");
      return;
    }
    console.log("gameID", gameID);
    const userID = queryParams.get("user");
    if (!(await validUser(gameID, userID))) {
      console.log("user '" + userID + "' not allowed in game " + gameID);
      await request.reject(
        403,
        "user '" + userID + "' not allowed in game " + gameNum
      );
      return;
    }
    if (!allDrawings[gameID]) {
      allDrawings[gameID] = {};
    }
    console.log("userID", userID);

    const drawings = allDrawings[gameID];

    const playersToTeam = 5;
    const players = await gamePlayersFromCache(gameID);
    const randNum = await getRandNum(gameID);
    cacheTeams(gameID, Object.keys(players), randNum, playersToTeam);
    const teamInfo = getCachedTeamInfo(gameID);
    const teams = getCachedTeams(teamInfo);
    const myTeam = teams[getMyTeamI(teamInfo, userID)];
    const myReverseTeam = reverseList(teams[getMyTeamI(teamInfo, userID)]);

    // You can rewrite this part of the code to accept only the requests from allowed origin
    const connection = request.accept(null, request.origin);
    clients[userID] = connection;
    wsServer.broadcast("user " + userID + " joined");

    connection.on("close", function (connection) {
      console.log("close connection for: ", userID);
      delete clients[userID];
      // delete drawings[userID];
    });

    connection.on("message", async function (msg) {
      console.log(msg.type);
      console.log(msg);
      switch (msg.type) {
        case "utf8":
          console.log("utf8");
          break;
        case "binary":
          console.log("bin data");
          if (!drawings[userID]) {
            drawings[userID] = [];
          }
          drawings[userID].push(msg.binaryData);
          console.log("num of pics", drawings[userID].length);
          if (drawings[userID].length >= numOfPicsInGame) {
            console.log("end of game!");
            connection.send(END_OF_GAME, (e) => {
              if (e) {
                console.log("END_OF_GAME err: ", e);
              }
            });
            let allDone = true;
            Object.keys(drawings).forEach((user) => {
              if (drawings[user].length < numOfPicsInGame) {
                allDone = false;
              }
            });
            if (allDone) {
              const gifs = await createGifs(drawings);
              console.log("created gif2s", gifs);
              gifs.forEach(
                async (gifFile) =>
                  fs.readFile(gifFile, async (err, data) => {
                    if (err) {
                      console.log(err);
                    } else {
                      // ipfs upload
                      ipfs.files.add(data, function (err, file) {
                        if (err) {
                          console.log(err);
                          return;
                        }
                        console.log(file);
                        const ipfsUrl = "https://ipfs.io/ipfs/" + file[0].path;
                        Object.keys(gamePlayersFromCache(gameID)).forEach(
                          (player) => {
                            console.log("trying to send");
                            if (clients[player]) {
                              console.log("sending to player ", player);
                              clients[player].send(ipfsUrl, (e) => {
                                if (e) {
                                  console.log("error sending ipfsUrl", e);
                                } else {
                                  console.log("sent ipfsUrl");
                                }
                              });
                            }
                          }
                        );
                      });

                      // console.log(data);
                      // Object.keys(gamePlayersFromCache(gameID)).forEach(
                      //   (player) => {
                      //     console.log("trying to send");
                      //     if (clients[player]) {
                      //       console.log("sending to player ", player);
                      //       clients[player].send(data, (e) => {
                      //         if (e) {
                      //           console.log("error sending gif", e);
                      //         } else {
                      //           console.log("sent blob");
                      //         }
                      //       });
                      //     }
                      //   }
                      // );
                      // console.log("broadcasting data", data);
                      // wsServer.broadcast(data);
                    }
                  })
                // wsServer.broadcast(
                //   await new Promise((resolve, reject) => {
                //     fs.readFile(gifFile, (err, data) => {
                //       if (err) {
                //         reject(err);
                //       } else {
                //         resolve(data);
                //       }
                //     });
                //   })
                // )
              );
            }
          } else {
            let nextClient = clients[nextPlayer(myTeam, userID)];
            nextClient.sendBytes(msg.binaryData, (e) => {
              if (e) {
                console.log("err: ", e);
              }
            });
          }

          break;
        default:
          console.log("unrecognized msg type", msg.type);
          console.log(msg);
      }
    });

    console.log(
      "connected: " + userID + " in " + Object.getOwnPropertyNames(clients)
    );
  });

  server.listen(webSocketsServerPort);
}

main();
