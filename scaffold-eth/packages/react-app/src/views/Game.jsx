import React, { useEffect, useState } from "react";
import Canvas from "../components/Game/Canvas";
import { w3cwebsocket as W3CWebSocket } from "websocket";
import { Button } from "antd";

const END_OF_GAME = "END_OF_GAME";
const WAITING_FOR_PLAYER = "WAITING_FOR_PLAYER";
function Game() {
  const [waiting, setWaiting] = useState(false);
  const [user, setUser] = useState("");
  const [needToGrabNextPicture, setNeedToGrabNextPicture] = useState(false);
  const [gameId, setGameId] = useState("");
  const [client, setClient] = useState(null);
  const [endOfGame, setEndOfGame] = useState(false);
  const [onionSkin, setOnionSkin] = useState("");
  const [nextOnionSkin, setNextOnionSkin] = useState("");
  const [connected, setConnected] = useState(false);
  const [gifSources, setGifSources] = useState([]);
  const fileToUrl = file => {
    const url = window.URL || window.webkitURL;
    try {
      return url.createObjectURL(file);
    } catch (e) {
      return "";
    }
  };

  const connectToClient = (user, game) => {
    setClient(null);
    setConnected(false);
    console.log(client, connected);
    var url = new URL("ws://127.0.0.1:8000");
    url.searchParams.append("user", user);
    url.searchParams.append("game", game);
    return new W3CWebSocket(url.toString());
  };

  const grabNextPic = () => {
    if (nextOnionSkin) {
      setOnionSkin(nextOnionSkin);
      setNextOnionSkin("");
      setWaiting(false);
    }
  };

  useEffect(() => {
    console.log("client change", client);
    console.log("connected", connected);
    console.log("connected && client", connected && client);
    if (client === null) {
      console.log("null client");
      setEndOfGame(false);
      setWaiting(false);
      setConnected(false);
      setOnionSkin("");
      setNextOnionSkin("");
      setGifSources([]);
      return;
    }

    client.onclose = () => {
      console.log("WebSocket Client closed");
      setClient(null);
    };
    client.onopen = () => {
      console.log("WebSocket Client Connected");
    };
    client.onError = e => {
      console.log("error: ", e);
    };
    client.onmessage = msg => {
      setConnected(true);
      console.log("message: ", msg);
      console.log("message.data: ", msg.data);
      if (msg.data instanceof Blob) {
        console.log("bin data");
        console.log("waiting", waiting);
        const fileUrl = fileToUrl(msg.data);
        console.log("new file", fileUrl);
        setNextOnionSkin(fileUrl);
      } else if (msg.data === END_OF_GAME) {
        console.log("end of game");
        setEndOfGame(true);
      } else if (msg.data instanceof String && msg.data == WAITING_FOR_PLAYER) {
        console.log("waiting for picture");
      } else if (msg.data.includes("ipfs.io/ipfs")) {
        setGifSources(s => [...s, msg.data]);
      } else {
        console.log(JSON.stringify(msg.data));
        console.log("not recognized message");
      }
    };
  }, [client]);

  const handleSubmit = event => {
    event.preventDefault();
    setClient(connectToClient(user, gameId));
    console.log(client, connected);
  };

  const EndOfGame = () => {
    return (
      <div>
        <p>End of Game</p>
        <p>Minting to ipfs</p>
        <Button
          onClick={() => {
            client.close();
            setClient(null);
          }}
        >
          start new game
        </Button>
        {gifSources.map((gif, i) => (
          <img src={gif} key={i} />
        ))}
      </div>
    );
  };

  const ConnectToWS = () => {
    return (
      <form onSubmit={handleSubmit}>
        <label htmlFor="game">Game id:</label>
        <br />
        <input type="text" id="game" name="game" value={gameId} onChange={e => setGameId(e.target.value)} />
        <br />
        <label htmlFor="user">User:</label>
        <br />
        <input type="text" id="user" name="user" value={user} onChange={e => setUser(e.target.value)} />
        <br />
        <br />
        <input type="submit" value="Submit" />
      </form>
    );
  };

  const ChangingConnection = () => {
    return (
      <div>
        <p>Changing connection status</p>
        <Button
          onClick={() => {
            client.close();
            setClient(null);
          }}
        >
          abort connection
        </Button>
      </div>
    );
  };

  const GamePlay = ({ waiting, grabNextPic, submit }) => {
    useEffect(() => {
      console.log("waiting change to", waiting);
    }, [waiting]);
    return (
      <div>
        {waiting ? (
          <div>
            <p>Waiting for next pic</p>
            {needToGrabNextPicture ? <Button onClick={grabNextPic}>Get next picture</Button> : <></>}
          </div>
        ) : (
          <Canvas
            onionSkin={onionSkin}
            submit={blob => {
              submit(blob);
            }}
          />
        )}
      </div>
    );
  };

  return endOfGame ? (
    <EndOfGame />
  ) : client === null ? (
    <ConnectToWS />
  ) : client !== null && !connected ? (
    <ChangingConnection />
  ) : (
    <GamePlay
      waiting={waiting}
      submit={blob => {
        if (nextOnionSkin) {
          setOnionSkin(nextOnionSkin);
          setNextOnionSkin("");
        } else {
          setNeedToGrabNextPicture(true);
          setWaiting(true);
        }
        client.send(blob);
      }}
      grabNextPic={grabNextPic}
    />
  );
}

export default Game;
