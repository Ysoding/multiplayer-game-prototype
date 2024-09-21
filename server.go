package main

import (
	"bytes"
	"encoding/binary"
	"log"
	"math"
	"math/rand"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ysoding/multiplayer-game-prototype/message"
)

const (
	worldWidth   = 800
	worldHeight  = 600
	playerSize   = 30
	serverFPS    = 60
	timeInterval = time.Second / serverFPS
)

var players map[uint32]*Player
var idCounter uint32 = 0
var joinedIDs map[uint32]struct{}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func init() {
	players = map[uint32]*Player{}
	joinedIDs = map[uint32]struct{}{}
}

func main() {
	http.HandleFunc("/", handler)

	go tick()
	log.Println("Listening to ws://0.0.0.0:6970")
	if err := http.ListenAndServe(":6970", nil); err != nil {
		panic(err)
	}
}

func tick() {
	ticker := time.NewTicker(timeInterval)
	defer ticker.Stop()

	for {
		start := time.Now()

		// initialize joined player
		if len(joinedIDs) > 0 {
			for id := range joinedIDs {
				joinedPlayer, ok := players[id]
				if !ok {
					continue
				}

				msg := message.HelloMsgStruct{
					ID:  joinedPlayer.id,
					X:   joinedPlayer.x,
					Y:   joinedPlayer.y,
					Hue: joinedPlayer.hue,
				}

				joinedPlayer.SendMsg(msg, message.HelloMsg)
			}
		}

		// // notifying old player about who joined
		// for id, player := range players {
		// }

		elapsed := time.Since(start)
		sleepDuration := timeInterval - elapsed
		if sleepDuration > 0 {
			time.Sleep(sleepDuration)
		}
	}
}

func handler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()

	id := getNewID()
	remoteAddr := conn.UnderlyingConn().RemoteAddr().String()

	rnd := rand.New(rand.NewSource(time.Now().UnixNano()))
	x := rnd.Float32() * (worldWidth - playerSize)
	y := rnd.Float32() * (worldHeight - playerSize)
	hue := uint8(math.Floor(rnd.Float64() * 360))

	player := NewPlayer(conn, remoteAddr, id, x, y, hue)
	players[id] = player
	joinedIDs[id] = struct{}{}
	log.Printf("Player%d connected", id)

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Player%d ReadMessage error:%v", id, err)
			// TODO: mutex
			delete(joinedIDs, id)
			break
		}

		go handleMsg(conn, messageType, p)
	}
}

func handleMsg(conn *websocket.Conn, messageType int, msg []byte) {
	log.Printf("processing msg: %s", msg)

	if err := conn.WriteMessage(messageType, msg); err != nil {
		log.Println(err)
		return
	}

}

func getNewID() uint32 {
	id := idCounter
	idCounter += 1
	return id
}

type Player struct {
	id            uint32
	x             float32
	y             float32
	hue           uint8
	conn          *websocket.Conn
	remoteAddress string
}

func NewPlayer(conn *websocket.Conn, remoteAddr string, id uint32, x, y float32, hue uint8) *Player {
	return &Player{
		id:            id,
		x:             x,
		y:             y,
		conn:          conn,
		remoteAddress: remoteAddr,
		hue:           hue,
	}
}

func (p *Player) SendMsg(msg any, typ message.MsgType) {
	// kind		data msg struct
	// 1byte       any
	buf := new(bytes.Buffer)
	buf.WriteByte(byte(typ))

	err := binary.Write(buf, binary.BigEndian, msg)
	if err != nil {
		log.Println("sendMsg binary write error:", err)
		return
	}

	err = p.conn.WriteMessage(websocket.BinaryMessage, buf.Bytes())
	if err != nil {
		if websocket.IsUnexpectedCloseError(err, websocket.CloseMessage) {
			// TODO: mutex
			delete(joinedIDs, p.id)
		}
		log.Printf("sendMsg error:%v", err)
		return
	}
}
