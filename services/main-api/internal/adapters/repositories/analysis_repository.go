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

func (r *analysisRepository) GetTeamPerformance(ctx context.Context, companyID string) (interface{}, error) {
	// Simple aggregation query
	query := `
		SELECT
			manager_id,
			manager_name,
			COUNT(*) as total_calls,
			AVG(quality_score) as avg_quality,
			AVG(script_match) as avg_script_match,
			AVG(kpi) as avg_kpi
		FROM calls_schema.v_calls_with_analysis
		WHERE company_id = $1
		GROUP BY manager_id, manager_name
	`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var managerID, managerName string
		var totalCalls int
		var avgQuality, avgScriptMatch, avgKPI float64
		if err := rows.Scan(&managerID, &managerName, &totalCalls, &avgQuality, &avgScriptMatch, &avgKPI); err != nil {
			return nil, err
		}
		results = append(results, map[string]interface{}{
			"manager_id":       managerID,
			"manager_name":     managerName,
			"total_calls":      totalCalls,
			"avg_quality":      avgQuality,
			"avg_script_match": avgScriptMatch,
			"avg_kpi":          avgKPI,
		})
	}
	return results, nil
}

func (r *analysisRepository) GetLeaderboard(ctx context.Context, companyID string) (interface{}, error) {
	query := `
		SELECT
			manager_id,
			manager_name,
			AVG(overall_rating) as avg_rating
		FROM calls_schema.v_calls_with_analysis
		WHERE company_id = $1
		GROUP BY manager_id, manager_name
		ORDER BY avg_rating DESC
	`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var managerID, managerName string
		var avgRating float64
		if err := rows.Scan(&managerID, &managerName, &avgRating); err != nil {
			return nil, err
		}
		results = append(results, map[string]interface{}{
			"manager_id":   managerID,
			"manager_name": managerName,
			"avg_rating":   avgRating,
		})
	}
	return results, nil
}
