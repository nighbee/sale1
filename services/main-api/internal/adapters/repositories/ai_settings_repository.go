package repositories

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/salesai/main-api/internal/core/domain"
)

type aiSettingsRepository struct {
	db *sql.DB
}

func NewAISettingsRepository(db *sql.DB) *aiSettingsRepository {
	return &aiSettingsRepository{db: db}
}

func (r *aiSettingsRepository) Get(ctx context.Context) (*domain.AISettings, error) {
	query := `
		SELECT id, stt_provider, stt_model, stt_language, llm_provider, llm_model, circuit_breaker_enabled, created_at, updated_at
		FROM calls_schema.ai_settings
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query)

	var s domain.AISettings
	err := row.Scan(&s.ID, &s.STTProvider, &s.STTModel, &s.STTLanguage, &s.LLMProvider, &s.LLMModel, &s.CircuitBreakerEnabled, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		// Return default settings if not found
		return &domain.AISettings{
			STTProvider:           "openai",
			LLMProvider:           "openai",
			CircuitBreakerEnabled: true,
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get ai settings: %w", err)
	}

	return &s, nil
}

func (r *aiSettingsRepository) Update(ctx context.Context, s *domain.AISettings) error {
	query := `
		INSERT INTO calls_schema.ai_settings (stt_provider, stt_model, stt_language, llm_provider, llm_model, circuit_breaker_enabled, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
		ON CONFLICT (id) DO UPDATE SET
			stt_provider = EXCLUDED.stt_provider,
			stt_model = EXCLUDED.stt_model,
			stt_language = EXCLUDED.stt_language,
			llm_provider = EXCLUDED.llm_provider,
			llm_model = EXCLUDED.llm_model,
			circuit_breaker_enabled = EXCLUDED.circuit_breaker_enabled,
			updated_at = CURRENT_TIMESTAMP
	`

	// If ID is missing, we try to update the single existing row
	if s.ID == "" {
		existing, err := r.Get(ctx)
		if err == nil && existing.ID != "" {
			s.ID = existing.ID
		}
	}

	if s.ID != "" {
		query = `
			UPDATE calls_schema.ai_settings
			SET stt_provider = $1, stt_model = $2, stt_language = $3, llm_provider = $4, llm_model = $5, circuit_breaker_enabled = $6, updated_at = CURRENT_TIMESTAMP
			WHERE id = $7
		`
		_, err := r.db.ExecContext(ctx, query, s.STTProvider, s.STTModel, s.STTLanguage, s.LLMProvider, s.LLMModel, s.CircuitBreakerEnabled, s.ID)
		return err
	}

	_, err := r.db.ExecContext(ctx, query, s.STTProvider, s.STTModel, s.STTLanguage, s.LLMProvider, s.LLMModel, s.CircuitBreakerEnabled)
	return err
}
