import {
  AmmaMovingStruct,
  Direction,
  HelloStruct,
  MessageKind,
  PingStruct,
  Player,
  PlayersJoinedHeaderStruct,
  PlayersLeftHeaderStruct,
  PlayersMovingHeaderStruct,
  PlayerStruct,
  PongStruct,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  PLAYER_SIZE,
  updatePlayer,
} from "./interface.mjs";

const DIRECTION_KEYS: { [key: string]: Direction } = {
  ArrowLeft: Direction.Left,
  ArrowRight: Direction.Right,
  ArrowUp: Direction.Up,
  ArrowDown: Direction.Down,
  KeyA: Direction.Left,
  KeyD: Direction.Right,
  KeyW: Direction.Up,
  KeyS: Direction.Down,
};

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
  ws.binaryType = "arraybuffer";

  let players = new Map<number, Player>();
  let me: Player | undefined = undefined;
  let ping = 0;

  ws.addEventListener("close", (event) => {
    console.log("WEBSOCKET CLOSE", event);
    ws = undefined;
  });

  ws.addEventListener("error", (event) => {
    // TODO: reconnect on errors
    console.log("WEBSOCKET ERROR", event);
  });

  ws.addEventListener("message", (event) => {
    // console.log("Received message", event);
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
          hue: (HelloStruct.hue.read(view) / 256) * 360,
          moving: 0,
        };
        players.set(me.id, me);
      } else {
        console.error(
          "Received bogus-amogus message from server. Incorrect `Hello` message.",
          view
        );
        ws?.close();
      }
    } else {
      if (PlayersJoinedHeaderStruct.verify(view)) {
        const count = PlayersJoinedHeaderStruct.count(view);
        for (let i = 0; i < count; i++) {
          const playerView = new DataView(
            event.data,
            PlayersJoinedHeaderStruct.size + i * PlayerStruct.size,
            PlayerStruct.size
          );
          const id = PlayerStruct.id.read(playerView);
          const player = players.get(id);
          if (player !== undefined) {
            player.x = PlayerStruct.x.read(playerView);
            player.y = PlayerStruct.y.read(playerView);
            player.hue = (PlayerStruct.hue.read(playerView) / 256) * 360;
            player.moving = PlayerStruct.moving.read(playerView);
          } else {
            players.set(id, {
              id,
              x: PlayerStruct.x.read(playerView),
              y: PlayerStruct.y.read(playerView),
              hue: (PlayerStruct.hue.read(playerView) / 256) * 360,
              moving: PlayerStruct.moving.read(playerView),
            });
          }
        }
      } else if (PlayersLeftHeaderStruct.verify(view)) {
        const count = PlayersLeftHeaderStruct.count(view);
        for (let i = 0; i < count; i++) {
          const id = PlayersLeftHeaderStruct.items(i).id.read(view);
          players.delete(id);
        }
      } else if (PlayersMovingHeaderStruct.verify(view)) {
        const count = PlayersMovingHeaderStruct.count(view);
        for (let i = 0; i < count; i++) {
          const playerView = new DataView(
            event.data,
            PlayersMovingHeaderStruct.size + i * PlayerStruct.size,
            PlayerStruct.size
          );
          const id = PlayerStruct.id.read(playerView);
          const player = players.get(id);
          if (player === undefined) {
            console.error(
              `Received bogus-amogus message from server. player ${id} didn't exists`,
              view
            );
            ws?.close();
            return;
          }
          player.moving = PlayerStruct.moving.read(playerView);
          player.x = PlayerStruct.x.read(playerView);
          player.y = PlayerStruct.y.read(playerView);
        }
      } else if (PongStruct.verify(view)) {
        ping = performance.now() - PongStruct.timestamp.read(view);
      } else {
        console.error("Received bogus-amogus message from server.", view);
        ws?.close();
      }
    }
  });

  ws.addEventListener("open", (event) => {
    console.log("WEBSOCKET OPEN", event);
  });

  let previousTimestamp = 0;

  const PING_COOLDOWN = 60;
  let pingCooldown = PING_COOLDOWN;
  const frame = (timestamp: number) => {
    const deltaTime = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;

    ctx.fillStyle = "#202020";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (ws === undefined) {
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
        updatePlayer(player, deltaTime);
        ctx.fillStyle = `hsl(${player.hue} 70% 40%)`;
        ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
      });

      if (me !== undefined) {
        updatePlayer(me, deltaTime);
        ctx.fillStyle = `hsl(${me.hue} 100% 40%)`;
        ctx.fillRect(me.x, me.y, PLAYER_SIZE, PLAYER_SIZE);

        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.strokeRect(me.x, me.y, PLAYER_SIZE, PLAYER_SIZE);
        ctx.stroke();
      }

      // ping
      ctx.font = "18px bold";
      ctx.fillStyle = "white";
      const padding = ctx.canvas.width * 0.05;
      ctx.fillText(`Ping: ${ping.toFixed(2)}ms`, padding, padding);

      pingCooldown -= 1;
      if (pingCooldown <= 0) {
        const view = new DataView(new ArrayBuffer(PingStruct.size));
        PingStruct.kind.write(view, MessageKind.Ping);
        PingStruct.timestamp.write(view, performance.now());
        ws.send(view);
        pingCooldown = PING_COOLDOWN;
      }
    }

    window.requestAnimationFrame(frame);
  };

  window.requestAnimationFrame((timestamp: number) => {
    previousTimestamp = timestamp;
    window.requestAnimationFrame(frame);
  });

  window.addEventListener("keydown", (e) => {
    if (ws !== undefined && me !== undefined) {
      if (!e.repeat) {
        const direction = DIRECTION_KEYS[e.code];
        if (direction !== undefined) {
          const view = new DataView(new ArrayBuffer(AmmaMovingStruct.size));
          AmmaMovingStruct.kind.write(view, MessageKind.AmmaMoving);
          AmmaMovingStruct.direction.write(view, direction);
          AmmaMovingStruct.start.write(view, 1);
          ws.send(view.buffer);
        }
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (ws !== undefined && me !== undefined) {
      if (!e.repeat) {
        const direction = DIRECTION_KEYS[e.code];
        if (direction !== undefined) {
          const view = new DataView(new ArrayBuffer(AmmaMovingStruct.size));
          AmmaMovingStruct.kind.write(view, MessageKind.AmmaMoving);
          AmmaMovingStruct.direction.write(view, direction);
          AmmaMovingStruct.start.write(view, 0);
          ws.send(view.buffer);
        }
      }
    }
  });
})();
