export const UINT8_SIZE = 1;
export const UINT16_SIZE = 2;
export const UINT32_SIZE = 4;
export const FLOAT32_SIZE = 4;
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;
export const PLAYER_SIZE = 30;
export const PLAYER_SPEED = 500;

export enum Direction {
  Left = 0,
  Right,
  Up,
  Down,
  Count,
}

export enum MessageKind {
  Hello,
  PlayersJoined,
  PlayersLeft,
  PlayersMoving,
  AmmaMoving,
  Ping,
  Pong,
}

export interface Player {
  id: number;
  x: number;
  y: number;
  hue: number;
  moving: number;
}

interface Field {
  offset: number;
  size: number;
  read(view: DataView): number;
  write(view: DataView, value: number): void;
}

export const HelloStruct = (() => {
  const allocator = { size: 0 };
  const kind = allocUint8Field(allocator);
  const id = allocUint32Field(allocator);
  const x = allocFloat32Field(allocator);
  const y = allocFloat32Field(allocator);
  const hue = allocUint8Field(allocator);
  const size = allocator.size;
  const verify = verifier(kind, MessageKind.Hello, size);
  return {
    id,
    x,
    y,
    hue,
    size,
    verify,
  };
})();

export const PlayerStruct = (() => {
  const allocator = { size: 0 };
  const id = allocUint32Field(allocator);
  const x = allocFloat32Field(allocator);
  const y = allocFloat32Field(allocator);
  const hue = allocUint8Field(allocator);
  const moving = allocUint8Field(allocator);
  const size = allocator.size;
  return { id, x, y, hue, size, moving };
})();

export const PlayersJoinedHeaderStruct = (() => {
  const allocator = { size: 0 };
  const kind = allocUint8Field(allocator);
  const size = allocator.size;
  const itemSize = PlayerStruct.size;
  const verify = (view: DataView) =>
    view.byteLength >= size &&
    (view.byteLength - size) % itemSize == 0 &&
    kind.read(view) == MessageKind.PlayersJoined;
  const count = (view: DataView) => (view.byteLength - size) / itemSize;
  return { kind, size, verify, count };
})();

export const PlayersLeftHeaderStruct = (() => {
  const allocator = { size: 0 };
  const kind = allocUint8Field(allocator);
  const size = allocator.size;
  const itemSize = UINT32_SIZE;
  const items = (index: number) => {
    return {
      id: {
        read: (view: DataView) => view.getUint32(size + index * itemSize, true),
      },
    };
  };
  const verify = (view: DataView) =>
    view.byteLength >= size &&
    (view.byteLength - size) % itemSize == 0 &&
    kind.read(view) == MessageKind.PlayersLeft;
  const count = (view: DataView) => (view.byteLength - size) / itemSize;
  return { kind, size, verify, count, items };
})();

export const AmmaMovingStruct = (() => {
  const allocator = { size: 0 };
  const kind = allocUint8Field(allocator);
  const direction = allocUint8Field(allocator);
  const start = allocUint8Field(allocator);
  const size = allocator.size;
  const verify = verifier(kind, MessageKind.AmmaMoving, size);
  return { kind, direction, size, verify, start };
})();

export const PlayersMovingHeaderStruct = (() => {
  const allocator = { size: 0 };
  const kind = allocUint8Field(allocator);
  const size = allocator.size;
  const itemSize = PlayerStruct.size;
  const verify = (view: DataView) =>
    view.byteLength >= size &&
    (view.byteLength - size) % itemSize == 0 &&
    kind.read(view) == MessageKind.PlayersMoving;
  const count = (view: DataView) => (view.byteLength - size) / itemSize;
  return { kind, size, verify, count };
})();

export const PingStruct = (() => {
  const allocator = { size: 0 };
  const kind = allocUint8Field(allocator);
  const timestamp = allocUint32Field(allocator);
  const size = allocator.size;
  const verify = verifier(kind, MessageKind.Ping, size);
  return { kind, timestamp, size, verify };
})();

export const PongStruct = (() => {
  const allocator = { size: 0 };
  const kind = allocUint8Field(allocator);
  const timestamp = allocUint32Field(allocator);
  const size = allocator.size;
  const verify = verifier(kind, MessageKind.Pong, size);
  return { kind, timestamp, size, verify };
})();

function verifier(
  kindField: Field,
  kind: number,
  size: number
): (view: DataView) => boolean {
  return (view) => view.byteLength == size && kindField.read(view) == kind;
}

function allocUint8Field(allocator: { size: number }): Field {
  const offset = allocator.size;
  const size = UINT8_SIZE;
  allocator.size += size;
  return {
    offset,
    size,
    read: (view) => view.getUint8(offset),
    write: (view, value) => view.setUint8(offset, value),
  };
}

function allocUint16Field(allocator: { size: number }): Field {
  const offset = allocator.size;
  const size = UINT16_SIZE;
  allocator.size += size;
  return {
    offset,
    size,
    read: (view) => view.getUint16(offset, true),
    write: (view, value) => view.setUint16(offset, value, true),
  };
}

function allocUint32Field(allocator: { size: number }): Field {
  const offset = allocator.size;
  const size = UINT32_SIZE;
  allocator.size += size;
  return {
    offset,
    size,
    read: (view) => view.getUint32(offset, true),
    write: (view, value) => view.setUint32(offset, value, true),
  };
}

function allocFloat32Field(allocator: { size: number }): Field {
  const offset = allocator.size;
  const size = FLOAT32_SIZE;
  allocator.size += size;
  return {
    offset,
    size,
    read: (view) => view.getFloat32(offset, true),
    write: (view, value) => view.setFloat32(offset, value, true),
  };
}

export type Vector2 = { x: number; y: number };
export const DIRECTION_VECTORS: Vector2[] = (() => {
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

export function updatePlayer(player: Player, deltaTime: number) {
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
