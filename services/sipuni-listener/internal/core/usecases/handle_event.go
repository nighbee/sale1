package usecases

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/salesai/sipuni-listener/internal/core/domain"
	"github.com/salesai/sipuni-listener/internal/core/ports"
	applogger "github.com/salesai/sipuni-listener/internal/infrastructure/logger"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
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
	userRepo  ports.UserRepository
	publisher ports.QueuePublisher
}

func NewHandleEventUseCase(callRepo ports.CallRepository, userRepo ports.UserRepository, publisher ports.QueuePublisher) *HandleEventUseCase {
	return &HandleEventUseCase{
		callRepo:  callRepo,
		userRepo:  userRepo,
		publisher: publisher,
	}
}

func generateRandomPassword(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	ret := make([]byte, length)
	for i := 0; i < length; i++ {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		ret[i] = charset[num.Int64()]
	}
	return string(ret)
}

func generateRandomName() string {
	adjectives := []string{"Swift", "Silent", "Bright", "Bold", "Calm", "Fierce", "Noble", "Quick", "Smart", "Wise"}
	nouns := []string{"Falcon", "Tiger", "River", "Mountain", "Eagle", "Lion", "Wolf", "Phoenix", "Storm", "Oak"}

	adjIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(adjectives))))
	nounIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(nouns))))

	return adjectives[adjIdx.Int64()] + " " + nouns[nounIdx.Int64()]
}

func (uc *HandleEventUseCase) Execute(ctx context.Context, companyID string, request json.RawMessage) {
	log := applogger.L.With(zap.String("operation", "HandleEventUseCase.Execute"), zap.String("company_id", companyID))
	var notify SipuniNotifyRequest
	if err := json.Unmarshal(request, &notify); err != nil {
		log.Error("unmarshal notify error", zap.Error(err))
		return
	}

	// Identify full source number and line ID
	lineID := notify.UserID
	fullSrcNum := notify.SrcNum
	if notify.SrcType != 1 && notify.SrcNum != "" {
		fullSrcNum = notify.SrcNum
	} else if notify.DstType != 1 && notify.DstNum != "" {
		fullSrcNum = notify.DstNum
	}

	// Calculate extension (managerID) by removing lineID prefix from fullSrcNum
	managerID := fullSrcNum
	if lineID != "" && strings.HasPrefix(fullSrcNum, lineID) {
		managerID = strings.TrimPrefix(fullSrcNum, lineID)
	}

	if managerID == "" {
		log.Warn("skipping notify — empty managerID (extension)",
			zap.String("full_src_num", fullSrcNum),
			zap.String("line_id", lineID),
			zap.String("sipuni_call_id", notify.CallID))
		return
	}

	// Requirement: if managerID length is > 9, skip creation
	if len(managerID) > 9 {
		log.Warn("skipping notify — managerID exceeds 9 digits",
			zap.String("manager_id", managerID),
			zap.String("sipuni_call_id", notify.CallID))
		return
	}

	managerName := notify.User
	if managerName == "" {
		managerName = generateRandomName()
	}

	log.Info("processing Sipuni notify",
		zap.String("sipuni_call_id", notify.CallID),
		zap.String("event", notify.Event.String()),
		zap.String("status", notify.Status),
		zap.String("src_num", notify.SrcNum),
		zap.Int("src_type", notify.SrcType),
		zap.String("dst_num", notify.DstNum),
		zap.String("full_src_num", fullSrcNum),
		zap.String("line_id", lineID),
		zap.String("manager_id", managerID),
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

	// Ensure manager exists in auth_schema.users
	var user *domain.User
	if fullSrcNum != "" {
		var err error
		// First try searching by full SrcNum
		user, err = uc.userRepo.FindBySrcNum(ctx, fullSrcNum, companyID)
		if err != nil {
			log.Error("error checking for manager existence by src_num", zap.String("src_num", fullSrcNum), zap.Error(err))
		}

		// Fallback to manager_id (extension) if not found by full src_num
		if user == nil && managerID != "" {
			user, err = uc.userRepo.FindByManagerID(ctx, managerID, companyID)
			if err != nil {
				log.Error("error checking for manager existence by manager_id", zap.String("manager_id", managerID), zap.Error(err))
			}
		}

		if user == nil {
			log.Info("manager not found, creating new user", zap.String("src_num", fullSrcNum), zap.String("manager_id", managerID))

			// Use a safe email format including companyID to avoid cross-tenant collisions
			safeID := strings.ReplaceAll(fullSrcNum, " ", "")
			email := fmt.Sprintf("manager_%s_%s@salesai.local", companyID, safeID)

			// Double check if user exists by email (to avoid race conditions)
			existingUser, err := uc.userRepo.FindByEmail(ctx, email)
			if err == nil && existingUser != nil {
				log.Info("manager already exists by email (race condition handled)", zap.String("email", email))
				user = existingUser
			} else {
				// Generate random password
				randomPassword := generateRandomPassword(12)
				hashedPassword, err := bcrypt.GenerateFromPassword([]byte(randomPassword), bcrypt.DefaultCost)
				if err != nil {
					log.Error("error hashing random password", zap.Error(err))
				} else {
					newUser := &domain.User{
						ID:              uuid.New().String(),
						CompanyID:       companyID,
						Email:           email,
						Username:        managerName,
						PasswordHash:    string(hashedPassword),
						InitialPassword: &randomPassword,
						Role:            domain.RoleSalesRep,
						ManagerID:       &managerID,
						ManagerName:     managerName,
						LineID:          &lineID,
						SrcNum:          &fullSrcNum,
						FirstName:       managerName,
						IsActive:        true,
					}

					if err := uc.userRepo.Create(ctx, newUser); err != nil {
						// Final attempt to handle race condition if Create fails due to duplicate key
						var pqErr *pq.Error
						if errors.As(err, &pqErr) && pqErr.Code == "23505" {
							log.Info("manager creation conflict (23505), attempting final fetch by email", zap.String("email", email))
							if existingUser, err := uc.userRepo.FindByEmail(ctx, email); err == nil && existingUser != nil {
								user = existingUser
							} else {
								log.Error("error creating new manager user and failed to fetch after conflict", zap.String("src_num", fullSrcNum), zap.Error(err))
							}
						} else {
							log.Error("error creating new manager user", zap.String("src_num", fullSrcNum), zap.Error(err))
						}
					} else {
						log.Info("new manager user created", zap.String("user_id", newUser.ID), zap.String("src_num", fullSrcNum), zap.String("manager_id", managerID))
						user = newUser
					}
				}
			}
		}

		if user != nil {
			// Update manager name if it has changed in Sipuni
			if notify.User != "" && user.ManagerName != notify.User {
				log.Info("updating manager name",
					zap.String("user_id", user.ID),
					zap.String("old_name", user.ManagerName),
					zap.String("new_name", notify.User))
				if err := uc.userRepo.UpdateManagerName(ctx, user.ID, notify.User); err != nil {
					log.Error("failed to update manager name", zap.Error(err))
				} else {
					user.ManagerName = notify.User
				}
			}

			managerName = user.ManagerName
			// Use the extension from the existing user record
			if user.ManagerID != nil {
				managerID = *user.ManagerID
			}
		}
	}

	// Generate deterministic UUID for the call based on Sipuni CallID
	// This ensures we don't create duplicate records if we receive the same event multiple times
	// and makes it easier to link data across systems.
	namespace := uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8") // DNS namespace as a base
	callID := uuid.NewMD5(namespace, []byte(notify.CallID)).String()

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

	// call_record_link is used as-is. Sipuni typically provides a full clickable URL.
	// We no longer call url.QueryUnescape on the entire URL, as it can mangle
	// standard query parameters.
	recordLink := notify.CallRecordLink

	call := &domain.Call{
		ID:          callID,
		CompanyID:   companyID,
		ManagerID:   managerID, // This is now the extension (deleted left part)
		ManagerName: managerName,
		ClientPhone: clientPhone,
		Duration:    talkDuration,
		CallLink:    recordLink,
		CallDate:    callDate,
		CallTime:    callDate,
		Status:      domain.StatusPending,
		Source:      "sipuni",
		ExternalID:  &notify.CallID,
	}

	if err := uc.callRepo.Create(ctx, call); err != nil {
		log.Error("database error saving call",
			zap.String("call_id", callID), zap.Error(err))
		return
	}
	log.Info("call record created",
		zap.String("call_id", callID), zap.String("manager_id", managerID),
		zap.String("client_phone", clientPhone), zap.Int("duration_s", talkDuration))

	if err := uc.publisher.EnqueueAudioProcessing(ctx, callID, recordLink, managerID, companyID); err != nil {
		log.Error("queue error enqueuing audio job",
			zap.String("call_id", callID), zap.Error(err))
	} else {
		log.Info("audio processing job enqueued",
			zap.String("call_id", callID), zap.String("audio_url", recordLink))
	}
}
