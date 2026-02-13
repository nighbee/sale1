package grpc

import (
	"context"
	"fmt"

	"github.com/salesai/main-api/pkg/analytics"
	"github.com/salesai/main-api/pkg/stt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type GRPCClient struct {
	sttClient       stt.STTServiceClient
	analyticsClient analytics.AnalyticsServiceClient
}

func NewGRPCClient(sttAddr, analyticsAddr string) (*GRPCClient, error) {
	sttConn, err := grpc.Dial(sttAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("could not connect to STT service: %v", err)
	}

	analyticsConn, err := grpc.Dial(analyticsAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("could not connect to Analytics service: %v", err)
	}

	return &GRPCClient{
		sttClient:       stt.NewSTTServiceClient(sttConn),
		analyticsClient: analytics.NewAnalyticsServiceClient(analyticsConn),
	}, nil
}

func (c *GRPCClient) GetTranscript(ctx context.Context, callID string) (*stt.TranscriptResponse, error) {
	return c.sttClient.GetTranscript(ctx, &stt.TranscriptRequest{CallId: callID})
}

func (c *GRPCClient) GetAnalysis(ctx context.Context, callID string) (*analytics.AnalysisResponse, error) {
	return c.analyticsClient.GetAnalysis(ctx, &analytics.AnalysisRequest{CallId: callID})
}
