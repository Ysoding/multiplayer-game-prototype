import { WebSocketServer } from "ws";

const SERVER_PORT = 6970;

const wss = new WebSocketServer({
  port: SERVER_PORT,
});

wss.on("connection", (ws) => {
  console.log("sombody connected!");
});

console.log(`Listening to ws://localhost:${SERVER_PORT}`);
