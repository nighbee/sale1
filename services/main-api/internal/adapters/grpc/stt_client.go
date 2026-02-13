package grpc

import (
	"github.com/salesai/main-api/pkg/stt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type sttClient struct {
	client stt.STTServiceClient
}

func NewSTTClient(address string) (stt.STTServiceClient, error) {
	conn, err := grpc.Dial(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return stt.NewSTTServiceClient(conn), nil
}
