package message

import (
	"fmt"
	"testing"
)

// func TestEncode(t *testing.T) {
// 	p := PlayersJoinedMsgStruct{
// 		player: Player{
// 			ID:  0,
// 			X:   1.4,
// 			Y:   1.2,
// 			Hue: 33,
// 		},
// 	}

// 	buffer := new(bytes.Buffer)
// 	err := binary.Write(buffer, binary.LittleEndian, p)
// 	if err != nil {
// 		panic(err)
// 	}
// 	fmt.Println(buffer)
// }

type B struct {
	X int
}

type A struct {
	B
}

type C struct {
	*B
}

func TestStruct(t *testing.T) {
	a := []*A{&A{B: B{X: 1}}}
	for _, aa := range a {
		aa.X = 10
	}
	fmt.Println(a[0].X)
}
