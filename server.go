package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

type MsgType uint8

type Player struct {
	id            uint32
	x             float32
	y             float32
	conn          *websocket.Conn
	remoteAddress string
}

type HelloMsgStruct struct {
	x   float32
	y   float32
	hue uint8
	id  uint32
}

const (
	HelloMsg MsgType = iota
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

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func init() {
	players = make(map[uint32]*Player)
}

func main() {
	http.HandleFunc("/", handler)

	go tick()
	log.Println("Listening to ws://0.0.0.0:6970")
	if err := http.ListenAndServe(":6970", nil); err != nil {
		panic(err)
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

	player := NewPlayer(conn, remoteAddr, id, x, y)
	players[id] = player
	log.Printf("Player%d connected", id)

	helloMsg := HelloMsgStruct{x: x, y: y, id: id, hue: hue}
	sendMsg(conn, helloMsg)

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Player%d ReadMessage error:%v", id, err)
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

func NewPlayer(conn *websocket.Conn, remoteAddr string, id uint32, x, y float32) *Player {
	return &Player{
		id:            id,
		x:             x,
		y:             y,
		conn:          conn,
		remoteAddress: remoteAddr,
	}
}

func sendMsg(conn *websocket.Conn, data any) {
	buf := new(bytes.Buffer)
	err := binary.Write(buf, binary.LittleEndian, data)
	if err != nil {
		log.Println("sendMsg binary write error:", err)
		return
	}

	err = conn.WriteMessage(websocket.BinaryMessage, buf.Bytes())
	if err != nil {
		log.Printf("sendMsg error:%v", err)
		return
	}
}

func tick() {
	ticker := time.NewTicker(timeInterval)
	defer ticker.Stop()

	for {
		start := time.Now()

		time.Sleep(10 * time.Millisecond)
		time.Sleep(5 * time.Millisecond)

		elapsed := time.Since(start)
		sleepDuration := timeInterval - elapsed
		if sleepDuration > 0 {
			time.Sleep(sleepDuration)
		}

		fmt.Printf("Frame time: %v\n", time.Since(start))
	}

}
