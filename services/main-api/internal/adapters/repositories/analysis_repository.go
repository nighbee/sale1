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

func (r *analysisRepository) GetTeamPerformance(ctx context.Context, filters map[string]interface{}) ([]map[string]interface{}, error) {
	argIdx := 1
	whereClauses := []string{}
	args := []interface{}{}

	// Enforce multi-tenancy: company_id must be provided
	if companyID, ok := filters["company_id"].(string); ok && companyID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.company_id = $%d", argIdx))
		args = append(args, companyID)
		argIdx++
	} else {
		return nil, errors.New("company_id filter is required")
	}

	// Status filter
	statusClause := "(c.status = 'completed' OR ar.call_id IS NOT NULL)"
	if includePending, ok := filters["include_pending"].(bool); ok && includePending {
		statusClause = "(c.status IN ('completed', 'pending', 'processing') OR ar.call_id IS NOT NULL)"
	}
	whereClauses = append(whereClauses, statusClause)

	if teamID, ok := filters["team_id"].(string); ok && teamID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.manager_id IN (SELECT manager_id FROM auth_schema.users WHERE team_id = $%d AND company_id = c.company_id)", argIdx))
		args = append(args, teamID)
		argIdx++
	}

	if source, ok := filters["source"].(string); ok && source != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(replace(lower(coalesce(c.source, '')), '-', '_') = replace(lower($%d), '-', '_') OR replace(lower(coalesce(ar.llm_provider, '')), '-', '_') = replace(lower($%d), '-', '_'))", argIdx, argIdx))
		args = append(args, source)
		argIdx++
	}

	if managerID, ok := filters["manager_id"].(string); ok && managerID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.manager_id = $%d", argIdx))
		args = append(args, managerID)
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
			whereClauses = append(whereClauses, fmt.Sprintf("COALESCE(c.call_date, ar.processed_at) >= NOW() - INTERVAL '%s'", interval))
		}
	}

	where := strings.Join(whereClauses, " AND ")

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
			COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), c.manager_name) as manager_name,
			COALESCE(u.id::text, c.manager_id) as manager_id,
			COUNT(c.id)                AS total_calls,
			COALESCE(AVG(ar.quality_score), 0)   AS avg_quality,
			COALESCE(AVG(ar.script_match), 0)    AS avg_script_match,
			COALESCE(AVG(ar.errors_free), 0)     AS avg_errors_free,
			COALESCE(AVG(ar.overall_rating), 0)  AS avg_overall_rating,
			COALESCE(AVG(ar.kpi), 0)             AS avg_kpi,
			COALESCE(SUM(c.duration), 0)         AS total_duration_seconds,
			COALESCE(AVG(c.duration), 0)         AS avg_duration_seconds,
			COUNT(CASE WHEN ar.overall_rating >= 4.0 THEN 1 END) AS excellent_calls_count,
			MAX(c.manager_id) as external_id
		FROM calls_schema.calls c
		LEFT JOIN auth_schema.users u ON c.manager_id = u.manager_id AND c.company_id = u.company_id
		LEFT JOIN calls_schema.analysis_reports ar ON c.id = ar.call_id
		WHERE %s
	GROUP BY COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), c.manager_name), COALESCE(u.id::text, c.manager_id)
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
		var totalCalls, excellentCalls int
		var avgQuality, avgScriptMatch, avgErrorsFree, avgOverallRating, avgKPI, totalDuration, avgDuration float64
		var externalID string
		err := rows.Scan(&managerName, &managerID, &totalCalls, &avgQuality, &avgScriptMatch, &avgErrorsFree, &avgOverallRating, &avgKPI, &totalDuration, &avgDuration, &excellentCalls, &externalID)
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
			"avg_duration_minutes":   avgDuration / 60,
			"excellent_calls_count":  excellentCalls,
			"external_id":            externalID,
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
	var (
		scriptID       sql.NullString
		qualityScore   sql.NullInt64
		scriptMatch    sql.NullInt64
		errorsFree     sql.NullInt64
		overallRating  sql.NullFloat64
		kpiVal         sql.NullFloat64
		recommendation sql.NullString
		brief          sql.NullString
		nextBestAction sql.NullString
		llmProvider    sql.NullString
		processedAt    sql.NullTime
	)

	err := r.db.QueryRowContext(ctx, query, callID).Scan(
		&a.ID,
		&a.CallID,
		&scriptID,
		&qualityScore,
		&scriptMatch,
		&errorsFree,
		&overallRating,
		&kpiVal,
		&recommendation,
		&brief,
		&nextBestAction,
		&llmProvider,
		&processedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("analysis report not found")
	}
	if err != nil {
		return nil, err
	}

	// Map nullable DB fields into domain struct with safe defaults
	if scriptID.Valid {
		s := scriptID.String
		a.ScriptID = &s
	}
	if qualityScore.Valid {
		a.QualityScore = int(qualityScore.Int64)
	}
	if scriptMatch.Valid {
		a.ScriptMatch = int(scriptMatch.Int64)
	}
	if errorsFree.Valid {
		a.ErrorsFree = int(errorsFree.Int64)
	}
	if overallRating.Valid {
		a.OverallRating = overallRating.Float64
	}
	if kpiVal.Valid {
		a.KPI = kpiVal.Float64
	}
	if recommendation.Valid {
		a.Recommendation = recommendation.String
	}
	if brief.Valid {
		a.Brief = brief.String
	}
	if nextBestAction.Valid {
		a.NextBestAction = nextBestAction.String
	}
	if llmProvider.Valid {
		a.LLMProvider = llmProvider.String
	}
	if processedAt.Valid {
		a.ProcessedAt = processedAt.Time
	}

	// Populate frontend compatibility fields
	a.Summary = a.Brief
	a.Sentiment = "Neutral"
	a.Objections = []string{}
	if a.NextBestAction != "" {
		a.NextSteps = strings.Split(a.NextBestAction, "\n")
	}

	return a, nil
}
