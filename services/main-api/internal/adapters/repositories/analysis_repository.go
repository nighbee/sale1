package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type analysisRepository struct {
	db *sql.DB
}

func NewAnalysisRepository(db *sql.DB) ports.AnalysisRepository {
	return &analysisRepository{db: db}
}

func (r *analysisRepository) Create(ctx context.Context, a *domain.AnalysisReport) error {
	query := `
		INSERT INTO calls_schema.analysis_reports
		(id, call_id, script_id, quality_score, script_match, errors_free, overall_rating, kpi, recommendation, brief, next_best_action, llm_provider)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING processed_at
	`
	return r.db.QueryRowContext(ctx, query,
		a.ID, a.CallID, a.ScriptID, a.QualityScore, a.ScriptMatch, a.ErrorsFree,
		a.OverallRating, a.KPI, a.Recommendation, a.Brief, a.NextBestAction, a.LLMProvider,
	).Scan(&a.ProcessedAt)
}

func (r *analysisRepository) GetTeamPerformance(ctx context.Context, companyID string, filters map[string]interface{}) ([]map[string]interface{}, error) {
	where := "company_id = $1"
	args := []interface{}{companyID}

	if teamID, ok := filters["team_id"].(string); ok && teamID != "" {
		where += " AND manager_id IN (SELECT manager_id FROM auth_schema.users WHERE team_id = $2)"
		args = append(args, teamID)
	}

	query := fmt.Sprintf(`
		SELECT
			manager_id,
			manager_name,
			total_calls,
			avg_quality,
			avg_script_match,
			avg_errors_free,
			avg_overall_rating,
			avg_kpi,
			total_duration_seconds
		FROM calls_schema.v_manager_performance
		WHERE %s
	`, where)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []map[string]interface{}{}
	for rows.Next() {
		var managerID, managerName string
		var totalCalls int
		var avgQuality, avgScriptMatch, avgErrorsFree, avgOverallRating, avgKPI, totalDuration float64
		err := rows.Scan(&managerID, &managerName, &totalCalls, &avgQuality, &avgScriptMatch, &avgErrorsFree, &avgOverallRating, &avgKPI, &totalDuration)
		if err != nil {
			return nil, err
		}
		result = append(result, map[string]interface{}{
			"manager_id":             managerID,
			"manager_name":           managerName,
			"total_calls":            totalCalls,
			"avg_quality":            avgQuality,
			"avg_script_match":       avgScriptMatch,
			"avg_errors_free":        avgErrorsFree,
			"avg_overall_rating":     avgOverallRating,
			"avg_kpi":                avgKPI,
			"total_duration_minutes": totalDuration / 60,
		})
	}
	return result, nil
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
