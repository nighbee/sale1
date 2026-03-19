package usecases

import (
	"context"
	"encoding/json"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/salesai/sipuni-listener/internal/core/domain"
	"github.com/salesai/sipuni-listener/internal/core/ports"
	applogger "github.com/salesai/sipuni-listener/internal/infrastructure/logger"
	"go.uber.org/zap"
)

type SipuniNotifyRequest struct {
	CallID              string      `json:"call_id"`
	Event               json.Number `json:"event"`
	DstNum              string      `json:"dst_num"`
	SrcNum              string      `json:"src_num"`
	SrcType             int         `json:"src_type"`
	DstType             int         `json:"dst_type"`
	Timestamp           json.Number `json:"timestamp"`
	UserID              string      `json:"user_id"`
	User                string      `json:"user"`
	Status              string      `json:"status"`
	CallStartTimestamp  json.Number `json:"call_start_timestamp"`
	CallAnswerTimestamp json.Number `json:"call_answer_timestamp"`
	CallRecordLink      string      `json:"call_record_link"`
	TreeName            string      `json:"treeName"`
}

type HandleEventUseCase struct {
	callRepo  ports.CallRepository
	publisher ports.QueuePublisher
}

func NewHandleEventUseCase(callRepo ports.CallRepository, publisher ports.QueuePublisher) *HandleEventUseCase {
	return &HandleEventUseCase{
		callRepo:  callRepo,
		publisher: publisher,
	}
}

func (uc *HandleEventUseCase) Execute(ctx context.Context, request json.RawMessage) {
	log := applogger.L.With(zap.String("operation", "HandleEventUseCase.Execute"))
	var notify SipuniNotifyRequest
	if err := json.Unmarshal(request, &notify); err != nil {
		log.Error("unmarshal notify error", zap.Error(err))
		return
	}

	// Unify UserID and User
	managerID := notify.UserID
	if managerID == "" {
		managerID = notify.User
	}

	log.Info("processing Sipuni notify",
		zap.String("sipuni_call_id", notify.CallID),
		zap.String("event", notify.Event.String()),
		zap.String("status", notify.Status),
		zap.String("src_num", notify.SrcNum),
		zap.Int("src_type", notify.SrcType),
		zap.String("dst_num", notify.DstNum),
		zap.Bool("has_recording", notify.CallRecordLink != ""))

	// Only process answered calls — NOANSWER/BUSY/FAILED/CANCEL have no actual audio
	if notify.Status != "ANSWER" {
		log.Info("skipping notify — call not answered",
			zap.String("sipuni_call_id", notify.CallID),
			zap.String("status", notify.Status))
		return
	}

	// We only care about calls with a record link
	if notify.CallRecordLink == "" {
		log.Info("skipping notify — no recording link despite ANSWER status",
			zap.String("sipuni_call_id", notify.CallID))
		return
	}

	callID := uuid.New().String()

	// Parse timestamps.
	// Talk duration = hang-up timestamp − answer timestamp (not start timestamp,
	// which would include ring time).
	startTime, _ := notify.CallStartTimestamp.Int64()
	answerTime, _ := notify.CallAnswerTimestamp.Int64()
	endTime, _ := notify.Timestamp.Int64()

	talkDuration := int(endTime - answerTime)
	if talkDuration <= 0 {
		talkDuration = 1
	}

	callDate := time.Unix(startTime, 0)

	// Determine client phone using src_type / dst_type:
	//   src_type=1 means the caller is external (incoming call scenario)
	//   dst_type=1 means the destination is external (outbound call scenario)
	var clientPhone string
	if notify.SrcType == 1 {
		// Incoming: external caller → internal operator
		clientPhone = notify.SrcNum
	} else if notify.DstType == 1 {
		// Outbound: internal operator → external client
		clientPhone = notify.DstNum
	} else {
		// Fallback: both internal — use length heuristic
		clientPhone = notify.SrcNum
		if len(notify.DstNum) > len(notify.SrcNum) {
			clientPhone = notify.DstNum
		}
	}

	// call_record_link is URL-encoded per Sipuni docs — decode before storing.
	recordLink, err := url.QueryUnescape(notify.CallRecordLink)
	if err != nil {
		// If decoding fails keep the raw value
		recordLink = notify.CallRecordLink
	}

	call := &domain.Call{
		ID:          callID,
		ManagerID:   managerID,
		ManagerName: "Sipuni Manager",
		ClientPhone: clientPhone,
		Duration:    talkDuration,
		CallLink:    recordLink,
		CallDate:    callDate,
		CallTime:    callDate,
		Status:      domain.StatusPending,
		Source:      "sipuni",
	}

	if err := uc.callRepo.Create(ctx, call); err != nil {
		log.Error("database error saving call",
			zap.String("call_id", callID), zap.Error(err))
		return
	}
	log.Info("call record created",
		zap.String("call_id", callID), zap.String("manager_id", managerID),
		zap.String("client_phone", clientPhone), zap.Int("duration_s", talkDuration))

	if err := uc.publisher.EnqueueAudioProcessing(ctx, callID, recordLink, managerID); err != nil {
		log.Error("queue error enqueuing audio job",
			zap.String("call_id", callID), zap.Error(err))
	} else {
		log.Info("audio processing job enqueued",
			zap.String("call_id", callID), zap.String("audio_url", recordLink))
	}
}
