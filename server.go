package main

import (
	"log"
	"math"
	"math/rand"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

type Player struct {
	id            int
	x             int
	y             int
	conn          *websocket.Conn
	remoteAddress string
}

type HelloMsg struct {
	X   int     `json:"x"`
	Y   int     `json:"y"`
	Hue float64 `json:"hue"`
	ID  int     `json:"id"`
}

const (
	worldWidth  = 800
	worldHeight = 600
	playerSize  = 30
)

var players map[int]*Player
var idCounter = 0

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func init() {
	players = make(map[int]*Player)
}

func main() {
	http.HandleFunc("/", handler)

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
	x := rnd.Intn(worldWidth - playerSize)
	y := rnd.Intn(worldHeight - playerSize)
	hue := math.Floor(rnd.Float64() * 360)

	player := NewPlayer(conn, remoteAddr, id, x, y)
	players[id] = player
	log.Printf("Player%d connected", id)

	helloMsg := HelloMsg{X: x, Y: y, ID: id, Hue: hue}
	if err := conn.WriteJSON(helloMsg); err != nil {
		log.Printf("Player%d send HelloMsg error:%v", id, err)
		return
	}

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

func getNewID() int {
	id := idCounter
	idCounter += 1
	return id
}

func NewPlayer(conn *websocket.Conn, remoteAddr string, id, x, y int) *Player {
	return &Player{
		id:            id,
		x:             x,
		y:             y,
		conn:          conn,
		remoteAddress: remoteAddr,
	}
}
