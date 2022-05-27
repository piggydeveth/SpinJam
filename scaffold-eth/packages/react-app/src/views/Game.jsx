import React, { useEffect, useState } from "react";
import Canvas from "../components/Game/Canvas";
import { w3cwebsocket as W3CWebSocket } from "websocket";

function Game() {
  const connectToClient = (user, game) => {
    var url = new URL("ws://127.0.0.1:8000");
    url.searchParams.append("user", user);
    url.searchParams.append("game", game);
    return new W3CWebSocket(url.toString());
  };

  const [user, setUser] = useState("");
  const [gameId, setGameId] = useState("");
  const [client, setClient] = useState(null);
  const [picSourceNames, setPicSourceNames] = useState([]);
  const [onionSkin, setOnionSkin] = useState("");
  const [gifSource, setGifSource] = useState([]);
  const fileToUrl = file => {
    const url = window.URL || window.webkitURL;
    try {
      return url.createObjectURL(file);
    } catch (e) {
      return "";
    }
  };
  useEffect(() => {
    console.log("client change", client);
    if (client === null) {
      return;
    }

    client.onclose = () => {
      console.log("WebSocket Client closed");
      setClient(null);
    };
    client.onopen = () => {
      console.log("WebSocket Client Connected");
    };
    client.onmessage = msg => {
      console.log("message: ", msg);
      console.log("message.data: ", msg.data);
      if (msg.data instanceof Blob) {
        console.log("bin data");
        setOnionSkin(fileToUrl(msg.data));
      }
    };
  }, [client]);

  const handleSubmit = event => {
    event.preventDefault();
    setClient(connectToClient(user, gameId));
  };

  return client ? (
    <div>
      <img src={gifSource.length ? gifSource[0] : ""} alt="" />
      <Canvas
        onionSkin={onionSkin}
        submit={blob => {
          client.send(blob);
        }}
      />
    </div>
  ) : (
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
}

export default Game;
