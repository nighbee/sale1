package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/salesai/main-api/internal/core/domain"
)

type analysisRepository struct {
	db *sql.DB
}

func NewAnalysisRepository(db *sql.DB) *analysisRepository {
	return &analysisRepository{db: db}
}

func (r *analysisRepository) GetByCallID(ctx context.Context, callID string) (*domain.AnalysisReport, error) {
	query := `
		SELECT id, call_id, script_id, quality_score, script_match, errors_free, overall_rating, kpi, recommendation, brief, next_best_action, llm_provider, processed_at
		FROM calls_schema.analysis_reports
		WHERE call_id = $1
	`

	a := &domain.AnalysisReport{}
	err := r.db.QueryRowContext(ctx, query, callID).Scan(
		&a.ID,
		&a.CallID,
		&a.ScriptID,
		&a.QualityScore,
		&a.ScriptMatch,
		&a.ErrorsFree,
		&a.OverallRating,
		&a.KPI,
		&a.Recommendation,
		&a.Brief,
		&a.NextBestAction,
		&a.LLMProvider,
		&a.ProcessedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("analysis report not found")
	}

	return a, err
}
