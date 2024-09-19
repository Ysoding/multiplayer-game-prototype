package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

type Player struct {
	id            int
	x             int
	y             int
	conn          *websocket.Conn
	remoteAddress string
}

var players map[int]Player
var idCounter = 0

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	http.HandleFunc("/ws", handler)

	log.Println("Listening to ws://0.0.0.0:6969")
	if err := http.ListenAndServe(":6969", nil); err != nil {
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

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			continue
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
