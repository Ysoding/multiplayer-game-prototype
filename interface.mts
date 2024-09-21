export const UINT8_SIZE = 1;
export const UINT16_SIZE = 2;
export const UINT32_SIZE = 4;
export const FLOAT32_SIZE = 4;

export enum MessageKind {
  Hello,
  PlayersJoined,
}

export interface Player {
  id: number;
  x: number;
  y: number;
  hue: number;
}

export interface HelloMsg {
  id: number;
  x: number;
  y: number;
  hue: number;
}

interface Field {
  offset: number;
  size: number;
  read(view: DataView): number;
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
    kind,
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
  const size = allocator.size;
  return { id, x, y, hue, size };
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
  };
}

function allocUint16Field(allocator: { size: number }): Field {
  const offset = allocator.size;
  const size = UINT16_SIZE;
  allocator.size += size;
  return {
    offset,
    size,
    read: (view) => view.getUint16(offset),
  };
}

function allocUint32Field(allocator: { size: number }): Field {
  const offset = allocator.size;
  const size = UINT32_SIZE;
  allocator.size += size;
  return {
    offset,
    size,
    read: (view) => view.getUint32(offset),
  };
}

function allocFloat32Field(allocator: { size: number }): Field {
  const offset = allocator.size;
  const size = FLOAT32_SIZE;
  allocator.size += size;
  return {
    offset,
    size,
    read: (view) => view.getFloat32(offset),
  };
}
