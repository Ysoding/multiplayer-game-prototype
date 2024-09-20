import { HelloMsg, HelloStruct, Player } from "./interface.mjs";

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const PLAYER_SIZE = 30;

(async () => {
  const gameCanvas = document.getElementById(
    "game"
  ) as HTMLCanvasElement | null;
  if (gameCanvas == null) throw new Error("no element with id `game`");
  gameCanvas.width = WORLD_WIDTH;
  gameCanvas.height = WORLD_HEIGHT;

  const ctx = gameCanvas.getContext("2d");
  if (ctx == null) throw new Error("2d canvas is not supported");

  let ws: WebSocket | undefined = new WebSocket(
    `ws://${window.location.hostname}:6970`
  );
  let players = new Map<number, Player>();
  let me: Player | undefined = undefined;

  ws.addEventListener("close", (event) => {
    console.log("WEBSOCKET CLOSE", event);
    ws = undefined;
  });

  ws.addEventListener("error", (event) => {
    // TODO: reconnect on errors
    console.log("WEBSOCKET ERROR", event);
  });

  ws.addEventListener("message", (event) => {
    console.log("Received message", event);
    if (!(event.data instanceof ArrayBuffer)) {
      console.error(
        "Received bogus-amogus message from server. Expected binary data",
        event
      );
      ws?.close();
    }

    const view = new DataView(event.data);
    if (me === undefined) {
      if (HelloStruct.verify(view)) {
        me = {
          id: HelloStruct.id.read(view),
          x: HelloStruct.x.read(view),
          y: HelloStruct.y.read(view),
          hue: (HelloStruct.hue.read(view) / 250) * 360,
        };
        players.set(me.id, me);
      } else {
        console.error(
          "Received bogus-amogus message from server. Incorrect `Hello` message.",
          view
        );
        ws?.close();
      }
    }
  });

  ws.addEventListener("open", (event) => {
    console.log("WEBSOCKET OPEN", event);
  });

  let previousTimestamp = 0;

  const frame = (timestamp: number) => {
    const deltaTime = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;

    ctx.fillStyle = "#202020";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (ws === undefined) {
      console.log("disconnect");
      const label = "Disconnected";
      const textSize = ctx.measureText(label);
      ctx.font = "48px bold";
      ctx.fillStyle = "white";
      ctx.fillText(
        label,
        ctx.canvas.width / 2 - textSize.width / 2,
        ctx.canvas.height / 2
      );
    } else {
      players.forEach((player) => {
        if (me === undefined || me.id == player.id) {
          return;
        }
        ctx.fillStyle = `hsl(${player.hue} 70% 40%)`;
        ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
      });

      if (me !== undefined) {
        ctx.fillStyle = `hsl(${me.hue} 100% 40%)`;
        ctx.fillRect(me.x, me.y, PLAYER_SIZE, PLAYER_SIZE);

        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.strokeRect(me.x, me.y, PLAYER_SIZE, PLAYER_SIZE);
        ctx.stroke();
      }
    }

    window.requestAnimationFrame(frame);
  };

  window.requestAnimationFrame((timestamp: number) => {
    previousTimestamp = timestamp;
    window.requestAnimationFrame(frame);
  });
})();
