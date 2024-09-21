package main

import (
	"log"
	"math"
	"math/rand"
	"net/http"
	"sync"
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

var players map[uint32]*PlayerOnServer
var idCounter uint32 = 0
var joinedIDs map[uint32]struct{}
var leftIDs map[uint32]struct{}
var mu sync.RWMutex

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func init() {
	players = map[uint32]*PlayerOnServer{}
	joinedIDs = map[uint32]struct{}{}
	leftIDs = map[uint32]struct{}{}
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

		mu.RLock()
		// initialize joined player
		if len(joinedIDs) > 0 {
			tmpPlayers := make([]message.Player, 0, len(players))
			for _, player := range players {
				tmpPlayers = append(tmpPlayers, player.Player)
			}
			playersJoinedMsg := message.NewPlayersJoinedMsgStruct(tmpPlayers)

			for id := range joinedIDs {
				joinedPlayer, ok := players[id]
				if !ok {
					continue
				}
				helloMsg := message.NewHelloMsgStruct(joinedPlayer.ID, joinedPlayer.X, joinedPlayer.Y, joinedPlayer.Hue)
				joinedPlayer.SendMsg(helloMsg)
				joinedPlayer.SendMsg(playersJoinedMsg)
			}

			// notifying old player about who joined
			{
				tmpPlayers := make([]message.Player, 0, len(joinedIDs))
				for id := range joinedIDs {
					playerJoined, ok := players[id]
					if !ok {
						continue
					}
					tmpPlayers = append(tmpPlayers, playerJoined.Player)
				}

				playersJoinedMsg := message.NewPlayersJoinedMsgStruct(tmpPlayers)

				for id, player := range players {
					if _, ok := joinedIDs[id]; ok { // skip self
						continue
					}
					player.SendMsg(playersJoinedMsg)
				}
			}
		}

		if len(leftIDs) > 0 {
			// notifying about whom left
			tmpIDs := make([]uint32, 0, len(players))
			for id := range leftIDs {
				tmpIDs = append(tmpIDs, id)
			}
			msg := message.NewPlayersLeftMsgStruct(tmpIDs)

			for _, player := range players {
				player.SendMsg(msg)
			}
		}
		mu.RUnlock()

		mu.Lock()
		joinedIDs = map[uint32]struct{}{}
		leftIDs = map[uint32]struct{}{}
		mu.Unlock()

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
	hue := uint8(math.Floor(rnd.Float64()*360) / 360 * 256)

	player := NewPlayer(conn, remoteAddr, id, x, y, hue)

	mu.Lock()
	players[id] = player
	joinedIDs[id] = struct{}{}
	mu.Unlock()

	log.Printf("Player%d connected", id)

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Player%d ReadMessage error:%v", id, err)
			onConnectionClose(id)
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

type PlayerOnServer struct {
	message.Player
	conn          *websocket.Conn
	remoteAddress string
}

func NewPlayer(conn *websocket.Conn, remoteAddr string, id uint32, x, y float32, hue uint8) *PlayerOnServer {
	return &PlayerOnServer{
		Player: message.Player{
			ID:  id,
			X:   x,
			Y:   y,
			Hue: hue,
		},
		conn:          conn,
		remoteAddress: remoteAddr,
	}
}

func (p *PlayerOnServer) SendMsgWithData(data []byte) {
	err := p.conn.WriteMessage(websocket.BinaryMessage, data)
	if err != nil {
		if websocket.IsUnexpectedCloseError(err, websocket.CloseMessage) {
			onConnectionClose(p.ID)
		}
		log.Printf("SendMsgWithData error:%v", err)
		return
	}
}

func (p *PlayerOnServer) SendMsg(msg message.Msg) {
	bytes, err := msg.Encode()
	if err != nil {
		log.Printf("SendMsg error: %v", err)
	}
	p.SendMsgWithData(bytes)
}

func onConnectionClose(id uint32) {
	mu.Lock()
	defer mu.Unlock()
	delete(players, id)
	delete(joinedIDs, id)
	leftIDs[id] = struct{}{}
}
