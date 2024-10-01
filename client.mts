import {
  AmmaMovingStruct,
  Direction,
  HelloStruct,
  MessageKind,
  Player,
  PlayersJoinedHeaderStruct,
  PlayersLeftHeaderStruct,
  PlayersMovingHeaderStruct,
  PlayerStruct,
} from "./interface.mjs";

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const PLAYER_SIZE = 30;
const PLAYER_SPEED = 500;

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

type Vector2 = { x: number; y: number };
const DIRECTION_VECTORS: Vector2[] = (() => {
  console.assert(
    Direction.Count == 4,
    "The definition of Direction have changed"
  );
  const vectors = Array(Direction.Count);
  vectors[Direction.Left] = { x: -1, y: 0 };
  vectors[Direction.Right] = { x: 1, y: 0 };
  vectors[Direction.Up] = { x: 0, y: -1 };
  vectors[Direction.Down] = { x: 0, y: 1 };
  return vectors;
})();

function properMod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

function updatePlayer(player: Player, deltaTime: number) {
  let dx = 0;
  let dy = 0;
  for (let dir = 0; dir < Direction.Count; dir += 1) {
    if ((player.moving >> dir) & 1) {
      dx += DIRECTION_VECTORS[dir].x;
      dy += DIRECTION_VECTORS[dir].y;
    }
  }
  const l = dx * dx + dy * dy;
  if (l !== 0) {
    const length = Math.sqrt(l);
    dx /= length;
    dy /= length;
  }
  player.x = properMod(player.x + dx * PLAYER_SPEED * deltaTime, WORLD_WIDTH);
  player.y = properMod(player.y + dy * PLAYER_SPEED * deltaTime, WORLD_HEIGHT);
}
