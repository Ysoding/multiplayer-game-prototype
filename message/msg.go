package message

type HelloMsgStruct struct {
	ID  uint32
	X   float32
	Y   float32
	Hue uint8
}

type player struct {
	id  uint32
	x   float32
	y   float32
	hue uint8
}

type PlayerJoinedMsgStruct struct {
	player
}

const (
	HelloMsg MsgType = iota
	PlayerJoinedMsg
)

type MsgType uint8
