package main

import (
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ysoding/multiplayer-game-prototype/message"
)

type Direction uint8

const (
	Left Direction = iota
	Right
	Up
	Down
)

const (
	directionCount    = 4
	worldWidth        = 800
	worldHeight       = 600
	playerSpeed       = 500
	playerSize        = 30
	serverFPS         = 60
	sleepTimeInterval = time.Second / serverFPS
)

var players map[uint32]*PlayerOnServer
var idCounter uint32 = 0
var joinedIDs map[uint32]struct{}
var leftIDs map[uint32]struct{}
var pingIDs map[uint32]uint32
var mu sync.RWMutex
var directions [][]int // Left: {x:-1, y: 0}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func init() {
	players = map[uint32]*PlayerOnServer{}
	joinedIDs = map[uint32]struct{}{}
	leftIDs = map[uint32]struct{}{}
	pingIDs = map[uint32]uint32{}

	directions = make([][]int, directionCount)
	directions[Left] = []int{-1, 0}
	directions[Right] = []int{1, 0}
	directions[Up] = []int{0, -1}
	directions[Down] = []int{0, 1}
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
	previousTime := time.Now()
	for {
		startTime := time.Now()
		deltaTime := startTime.Sub(previousTime)
		previousTime = startTime

		mu.RLock()
		if len(joinedIDs) > 0 {
			// initialize joined player
			{
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
					joinedPlayer.sendMsg(helloMsg)
					// Reconstructing the state of the other players
					joinedPlayer.sendMsg(playersJoinedMsg)
				}
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
					player.sendMsg(playersJoinedMsg)
				}
			}
		}

		// notifying about whom left
		{
			if len(leftIDs) > 0 {
				tmpIDs := make([]uint32, 0, len(players))
				for id := range leftIDs {
					tmpIDs = append(tmpIDs, id)
				}
				msg := message.NewPlayersLeftMsgStruct(tmpIDs)

				for _, player := range players {
					player.sendMsg(msg)
				}
			}
		}

		// notifying about moving player
		{
			cnt := 0
			for _, player := range players {
				if player.newMoving != player.Moving {
					cnt++
				}
			}

			if cnt > 0 {
				tmpPlayers := make([]message.Player, 0)
				for _, player := range players {
					if player.newMoving != player.Moving {
						player.Moving = player.newMoving
						tmpPlayers = append(tmpPlayers, player.Player)
					}
				}

				msg := message.NewPlayersMovingMsgStruct(tmpPlayers)
				for _, player := range players {
					player.sendMsg(msg)
				}
			}
		}

		// update player state
		for _, player := range players {
			player.update(float64(deltaTime.Milliseconds()) / 1000)
		}

		// send ping
		for id, ping := range pingIDs {
			if player, ok := players[id]; ok {
				msg := message.NewPongMsgStruct(ping)
				player.sendMsg(msg)
			}
		}
		mu.RUnlock()

		mu.Lock()
		joinedIDs = map[uint32]struct{}{}
		leftIDs = map[uint32]struct{}{}
		pingIDs = map[uint32]uint32{}
		mu.Unlock()

		tickTime := time.Since(startTime)
		sleepTime := sleepTimeInterval - tickTime
		if sleepTime > 0 {
			time.Sleep(sleepTime)
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
	hue := uint8((math.Floor(rnd.Float64()*360) / 360) * 256)

	player := NewPlayer(conn, remoteAddr, id, x, y, hue)

	mu.Lock()
	players[id] = player
	joinedIDs[id] = struct{}{}
	mu.Unlock()

	log.Printf("Player%d connected\n", id)

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Player%d ReadMessage %d error:%v\n", id, messageType, err)
			onConnectionClose(id)
			break
		}

		go player.handleMsg(messageType, p)
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
	newMoving     uint8
}

func NewPlayer(conn *websocket.Conn, remoteAddr string, id uint32, x, y float32, hue uint8) *PlayerOnServer {
	return &PlayerOnServer{
		Player: message.Player{
			ID:     id,
			X:      x,
			Y:      y,
			Hue:    hue,
			Moving: 0,
		},
		conn:          conn,
		remoteAddress: remoteAddr,
		newMoving:     0,
	}
}

func (p *PlayerOnServer) sendMsgWithData(data []byte) {
	err := p.conn.WriteMessage(websocket.BinaryMessage, data)
	if err != nil {
		if websocket.IsUnexpectedCloseError(err, websocket.CloseMessage) {
			onConnectionClose(p.ID)
		}
		log.Printf("SendMsgWithData error:%v\n", err)
		return
	}
}

func (p *PlayerOnServer) sendMsg(msg message.Msg) {
	bytes, err := msg.Encode()
	if err != nil {
		log.Printf("SendMsg error: %v\n", err)
	}
	p.sendMsgWithData(bytes)
}

func (p *PlayerOnServer) update(deltaTime float64) {
	dx := 0.0
	dy := 0.0
	for dir := 0; dir < directionCount; dir++ {
		if ((p.Moving >> dir) & 1) != 0 {
			dx += float64(directions[dir][0])
			dy += float64(directions[dir][1])
		}
	}

	l := dx*dx + dy*dy

	if l != 0 {
		length := math.Sqrt(l)
		dx /= length
		dy /= length
	}

	p.X = float32(properMod(float64(p.X)+dx*playerSpeed*deltaTime, worldWidth))
	p.Y = float32(properMod(float64(p.Y)+dy*playerSpeed*deltaTime, worldHeight))
}

func properMod(a float64, b float64) float64 {
	return math.Mod(math.Mod(a, b)+b, b)
}

func (p *PlayerOnServer) handleMsg(messageType int, data []byte) {
	if messageType != websocket.BinaryMessage {
		log.Println("received not BinaryMessage")
		return
	}

	ammaMovingMsg := message.AmmaMovingMsgStruct{}
	pingMsg := message.PingMsgStruct{}
	if err := ammaMovingMsg.Decode(data); err == nil {
		// log.Printf("processing AmmaMovingMsg: %v\n", msg)
		if ammaMovingMsg.Start == 1 {
			p.newMoving |= (1 << ammaMovingMsg.Direction)
		} else {
			p.newMoving &= ^(1 << ammaMovingMsg.Direction)
		}
	} else if err := pingMsg.Decode(data); err == nil {
		pingIDs[p.ID] = pingMsg.Timestamp
	} else {
		fmt.Printf("received bogus-amogus message from player %d\n", p.ID)
		p.conn.Close()
		return
	}
}

func onConnectionClose(id uint32) {
	mu.Lock()
	defer mu.Unlock()
	delete(players, id)
	delete(joinedIDs, id)
	leftIDs[id] = struct{}{}
}
