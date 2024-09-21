package message

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"testing"
)

func TestEncode(t *testing.T) {
	p := PlayersJoinedMsgStruct{
		player: player{
			id:  0,
			x:   1.4,
			y:   1.2,
			hue: 33,
		},
	}

	buffer := new(bytes.Buffer)
	err := binary.Write(buffer, binary.LittleEndian, p)
	if err != nil {
		panic(err)
	}
	fmt.Println(buffer)
}
