package message

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

type Msg interface {
	// kind		data msg struct
	// 1byte       any
	Encode() ([]byte, error)
}

const (
	HelloMsg MsgType = iota
	PlayersJoinedMsg
	PlayersLeftMsg
	AmmaMoving
)

type MsgType uint8

type HelloMsgStruct struct {
	ID  uint32
	X   float32
	Y   float32
	Hue uint8
}

func NewHelloMsgStruct(id uint32, x, y float32, hue uint8) Msg {
	return &HelloMsgStruct{
		ID:  id,
		X:   x,
		Y:   y,
		Hue: hue,
	}
}

func (h *HelloMsgStruct) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	buf.WriteByte(byte(HelloMsg))

	err := binary.Write(buf, binary.LittleEndian, h)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

type Player struct {
	ID     uint32
	X      float32
	Y      float32
	Hue    uint8
	Moving uint8
}

type PlayersJoinedMsgStruct struct {
	players []Player
}

func (p *PlayersJoinedMsgStruct) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	buf.WriteByte(byte(PlayersJoinedMsg))

	for _, player := range p.players {
		err := binary.Write(buf, binary.LittleEndian, player)
		if err != nil {
			return nil, err
		}
	}

	return buf.Bytes(), nil
}

func NewPlayersJoinedMsgStruct(players []Player) Msg {
	return &PlayersJoinedMsgStruct{players: players}
}

type PlayersLeftMsgStruct struct {
	playerIDs []uint32
}

func (p *PlayersLeftMsgStruct) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	buf.WriteByte(byte(PlayersLeftMsg))

	for _, id := range p.playerIDs {
		err := binary.Write(buf, binary.LittleEndian, id)
		if err != nil {
			return nil, err
		}
	}

	return buf.Bytes(), nil
}

func NewPlayersLeftMsgStruct(playerIDs []uint32) Msg {
	return &PlayersLeftMsgStruct{playerIDs: playerIDs}
}

type AmmaMovingMsgStruct struct {
	Direction uint8
	Start     uint8
}

func (a *AmmaMovingMsgStruct) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	buf.WriteByte(byte(PlayersLeftMsg))

	err := binary.Write(buf, binary.LittleEndian, AmmaMoving)
	if err != nil {
		return nil, err
	}

	err = binary.Write(buf, binary.LittleEndian, a.Direction)
	if err != nil {
		return nil, err
	}

	err = binary.Write(buf, binary.LittleEndian, a.Start)
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (a *AmmaMovingMsgStruct) Decode(data []byte) error {
	buf := bytes.NewReader(data)

	var kind uint8
	err := binary.Read(buf, binary.LittleEndian, &kind)
	if err != nil {
		return err
	}

	if kind != uint8(AmmaMoving) {
		return fmt.Errorf("msg type not AmmaMoving: %d", kind)
	}

	err = binary.Read(buf, binary.LittleEndian, &a.Direction)
	if err != nil {
		return err
	}

	err = binary.Read(buf, binary.LittleEndian, &a.Start)
	if err != nil {
		return err
	}

	return nil
}
