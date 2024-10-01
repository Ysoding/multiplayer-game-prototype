import { WebSocket } from "ws";
import {
  Player,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  HelloStruct,
  PlayersMovingHeaderStruct,
  PlayerStruct,
  updatePlayer,
  AmmaMovingStruct,
  MessageKind,
  Direction,
  PLAYER_SPEED,
} from "./interface.mjs";

const BOT_FPS = 60;

interface Bot {
  ws: WebSocket;
  me: Player | undefined;
  goalX: number;
  goalY: number;
  timeoutBeforeTurn: undefined | number;
}

function createBot(): Bot {
  const bot: Bot = {
    ws: new WebSocket("ws://localhost:6970"),
    me: undefined,
    goalX: WORLD_WIDTH * 0.5,
    goalY: WORLD_HEIGHT * 0.6,
    timeoutBeforeTurn: undefined,
  };
  bot.ws.binaryType = "arraybuffer";

  bot.ws.addEventListener("message", (event) => {
    if (!(event.data instanceof ArrayBuffer)) {
      return;
    }
    const view = new DataView(event.data);
    if (bot.me === undefined) {
      if (HelloStruct.verify(view)) {
        bot.me = {
          id: HelloStruct.id.read(view),
          x: HelloStruct.x.read(view),
          y: HelloStruct.y.read(view),
          moving: 0,
          hue: (HelloStruct.hue.read(view) / 256) * 360,
        };
        turn();
        setTimeout(tick, 1000 / BOT_FPS);
        console.log(`Connected as player ${bot.me.id}`);
      } else {
        console.error(
          "Received bogus-amogus message from server. Incorrect `Hello` message.",
          view
        );
        bot.ws.close();
      }
    } else {
      if (PlayersMovingHeaderStruct.verify(view)) {
        const count = PlayersMovingHeaderStruct.count(view);

        for (let i = 0; i < count; ++i) {
          const playerView = new DataView(
            event.data,
            PlayersMovingHeaderStruct.size + i * PlayerStruct.size,
            PlayerStruct.size
          );

          const id = PlayerStruct.id.read(playerView);
          if (id === bot.me.id) {
            bot.me.moving = PlayerStruct.moving.read(playerView);
            bot.me.x = PlayerStruct.x.read(playerView);
            bot.me.y = PlayerStruct.y.read(playerView);
          }
        }
      }
    }
  });

  function turn() {
    if (bot.me === undefined) return;
    const view = new DataView(new ArrayBuffer(AmmaMovingStruct.size));
    AmmaMovingStruct.kind.write(view, MessageKind.AmmaMoving);

    // full stop
    for (let direction = 0; direction < Direction.Count; ++direction) {
      if ((bot.me.moving >> direction) & 1) {
        AmmaMovingStruct.direction.write(view, direction);
        AmmaMovingStruct.start.write(view, 0);
        bot.ws.send(view);
      }
    }

    // new direction
    const direction = Math.floor(Math.random() * Direction.Count);
    bot.timeoutBeforeTurn = (Math.random() * WORLD_WIDTH * 0.5) / PLAYER_SPEED;

    AmmaMovingStruct.direction.write(view, direction);
    AmmaMovingStruct.start.write(view, 1);
    bot.ws.send(view);
  }

  let previousTimestamp = 0;
  function tick() {
    const timestamp = performance.now();
    const deltaTime = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;
    if (bot.timeoutBeforeTurn !== undefined) {
      bot.timeoutBeforeTurn -= deltaTime;
      if (bot.timeoutBeforeTurn <= 0) turn();
    }
    if (bot.me !== undefined) {
      updatePlayer(bot.me, deltaTime);
    }
    setTimeout(tick, Math.max(0, 1000 / BOT_FPS - timestamp));
  }

  return bot;
}

let bots: Array<Bot> = [];
for (let i = 0; i < 200; i++) bots.push(createBot());
