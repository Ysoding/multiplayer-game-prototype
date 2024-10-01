package message

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
)

type Msg interface {
	// kind		data msg struct
	// 1byte       any
	Encode() ([]byte, error)
	Decode(data []byte) error
}

const (
	HelloMsg MsgType = iota
	PlayersJoinedMsg
	PlayersLeftMsg
	PlayersMovingMsg
	AmmaMovingMsg
	PingMsg
	PongMsg
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

func (h *HelloMsgStruct) Decode(data []byte) error {
	return errors.New("`HelloMsg` only client msg")
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

func (h *PlayersJoinedMsgStruct) Decode(data []byte) error {
	return errors.New("`PlayersJoinedMsgStruct` only client msg")
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

func (h *PlayersLeftMsgStruct) Decode(data []byte) error {
	return errors.New("`PlayersLeftMsgStruct` only client msg")
}

type AmmaMovingMsgStruct struct {
	Direction uint8
	Start     uint8
}

func (a *AmmaMovingMsgStruct) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	buf.WriteByte(byte(PlayersLeftMsg))

	err := binary.Write(buf, binary.LittleEndian, AmmaMovingMsg)
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

	if kind != uint8(AmmaMovingMsg) {
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

type PlayersMovingMsgStruct struct {
	players []Player
}

func NewPlayersMovingMsgStruct(players []Player) Msg {
	return &PlayersMovingMsgStruct{players: players}
}

func (p *PlayersMovingMsgStruct) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	buf.WriteByte(byte(PlayersMovingMsg))

	for _, player := range p.players {
		err := binary.Write(buf, binary.LittleEndian, player)
		if err != nil {
			return nil, err
		}
	}

	return buf.Bytes(), nil
}

func (p *PlayersMovingMsgStruct) Decode(data []byte) error {
	return errors.New("`PlayersMovingMsgStruct` only client msg")
}

type PingMsgStruct struct {
	Timestamp uint32
}

func NewPingMsgStruct(players []Player) Msg {
	return &PingMsgStruct{}
}

func (p *PingMsgStruct) Encode() ([]byte, error) {
	return nil, errors.New("`PingMsgStruct` only client msg")
}

func (p *PingMsgStruct) Decode(data []byte) error {
	buf := bytes.NewReader(data)

	var kind uint8
	err := binary.Read(buf, binary.LittleEndian, &kind)
	if err != nil {
		return err
	}

	if kind != uint8(PingMsg) {
		return fmt.Errorf("msg type not Ping: %d", kind)
	}

	err = binary.Read(buf, binary.LittleEndian, &p.Timestamp)
	if err != nil {
		return err
	}
	return nil
}

type PongMsgStruct struct {
	Timestamp uint32
}

func NewPongMsgStruct(timestamp uint32) Msg {
	return &PongMsgStruct{Timestamp: timestamp}
}

func (p *PongMsgStruct) Encode() ([]byte, error) {
	buf := new(bytes.Buffer)
	buf.WriteByte(byte(PongMsg))

	err := binary.Write(buf, binary.LittleEndian, p)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (p *PongMsgStruct) Decode(data []byte) error {
	return errors.New("`PongMsgStruct` only server msg")
}
