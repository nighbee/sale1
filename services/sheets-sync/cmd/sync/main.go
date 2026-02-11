package main

import (
	"log"
	"time"
)

func main() {
	log.Println("Google Sheets Sync service starting...")

	// Mock sync loop
	for {
		log.Println("Checking for new rows in Google Sheets...")
		time.Sleep(5 * time.Minute)
	}
}
