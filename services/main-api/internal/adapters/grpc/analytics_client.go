package grpc

import (
	"github.com/salesai/main-api/pkg/analytics"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func NewAnalyticsClient(address string) (analytics.AnalyticsServiceClient, error) {
	conn, err := grpc.Dial(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return analytics.NewAnalyticsServiceClient(conn), nil
}
