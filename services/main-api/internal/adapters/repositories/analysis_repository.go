package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

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
	argIdx := 2
	where := "c.company_id = $1 AND c.status = 'completed'"
	args := []interface{}{companyID}

	if teamID, ok := filters["team_id"].(string); ok && teamID != "" {
		where += fmt.Sprintf(" AND c.manager_id IN (SELECT manager_id FROM auth_schema.users WHERE team_id = $%d)", argIdx)
		args = append(args, teamID)
		argIdx++
	}

	if source, ok := filters["source"].(string); ok && source != "" {
		where += fmt.Sprintf(" AND c.source = $%d", argIdx)
		args = append(args, source)
		argIdx++
	}

	if period, ok := filters["period"].(string); ok && period != "" {
		var interval string
		switch period {
		case "7d":
			interval = "7 days"
		case "30d":
			interval = "30 days"
		case "90d":
			interval = "90 days"
		}
		if interval != "" {
			where += fmt.Sprintf(" AND c.call_date >= NOW() - INTERVAL '%s'", interval)
		}
	}

	sortBy := "avg_kpi"
	if s, ok := filters["sort_by"].(string); ok {
		allowed := map[string]bool{
			"avg_kpi": true, "avg_quality": true, "avg_script_match": true,
			"avg_errors_free": true, "total_calls": true,
		}
		if allowed[s] {
			sortBy = s
		}
	}

	query := fmt.Sprintf(`
		SELECT
			COALESCE(u.id::text, c.manager_id) as manager_id,
			COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), c.manager_name) as manager_name,
			COUNT(c.id)                AS total_calls,
			COALESCE(AVG(ar.quality_score), 0)   AS avg_quality,
			COALESCE(AVG(ar.script_match), 0)    AS avg_script_match,
			COALESCE(AVG(ar.errors_free), 0)     AS avg_errors_free,
			COALESCE(AVG(ar.overall_rating), 0)  AS avg_overall_rating,
			COALESCE(AVG(ar.kpi), 0)             AS avg_kpi,
			COALESCE(SUM(c.duration), 0)         AS total_duration_seconds
		FROM calls_schema.calls c
		LEFT JOIN auth_schema.users u ON c.manager_id = u.manager_id AND c.company_id = u.company_id
		LEFT JOIN calls_schema.analysis_reports ar ON c.id = ar.call_id
		WHERE %s
		GROUP BY COALESCE(u.id::text, c.manager_id), u.first_name, u.last_name, c.manager_name
		ORDER BY %s DESC NULLS LAST
	`, where, sortBy)

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

	// Populate frontend compatibility fields
	a.Summary = a.Brief
	if a.NextBestAction != "" {
		a.NextSteps = strings.Split(a.NextBestAction, "\n")
	}

	return a, err
}
