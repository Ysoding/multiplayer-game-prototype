export const UINT8_SIZE = 1;
export const UINT16_SIZE = 2;
export const UINT32_SIZE = 4;
export const FLOAT32_SIZE = 4;

export enum Direction {
  Left = 0,
  Right,
  Up,
  Down,
}

export enum MessageKind {
  Hello,
  PlayersJoined,
  PlayersLeft,
  PlayersMoving,
  AmmaMoving,
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
  const headerSize = allocator.size;
  const itemSize = PlayerStruct.size;
  const verify = (view: DataView) =>
    view.byteLength >= headerSize &&
    (view.byteLength - headerSize) % itemSize == 0 &&
    kind.read(view) == MessageKind.PlayersJoined;
  const count = (view: DataView) => (view.byteLength - headerSize) / itemSize;
  return { kind, headerSize, verify, count };
})();

export const PlayersLeftHeaderStruct = (() => {
  const allocator = { size: 0 };
  const kind = allocUint8Field(allocator);
  const headerSize = allocator.size;
  const itemSize = UINT32_SIZE;
  const items = (index: number) => {
    return {
      id: {
        read: (view: DataView) =>
          view.getUint32(headerSize + index * itemSize, true),
      },
    };
  };
  const verify = (view: DataView) =>
    view.byteLength >= headerSize &&
    (view.byteLength - headerSize) % itemSize == 0 &&
    kind.read(view) == MessageKind.PlayersLeft;
  const count = (view: DataView) => (view.byteLength - headerSize) / itemSize;
  return { kind, headerSize, verify, count, items };
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
  const headerSize = allocator.size;
  const itemSize = PlayerStruct.size;
  const verify = (view: DataView) =>
    view.byteLength >= headerSize &&
    (view.byteLength - headerSize) % itemSize == 0 &&
    kind.read(view) == MessageKind.PlayersMoving;
  const count = (view: DataView) => (view.byteLength - headerSize) / itemSize;
  return { kind, headerSize, verify, count };
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
