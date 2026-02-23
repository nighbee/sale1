package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type scriptRepository struct {
	db *sql.DB
}

func NewScriptRepository(db *sql.DB) ports.ScriptRepository {
	return &scriptRepository{db: db}
}

func (r *scriptRepository) Create(ctx context.Context, s *domain.Script) error {
	structureJSON, _ := json.Marshal(s.Structure)
	metricsJSON, _ := json.Marshal(s.BaseScriptMetrics)
	query := `
		INSERT INTO scripts_schema.scripts (id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, team_id, is_base_script, is_active_base, base_script_metrics)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query, s.ID, s.CompanyID, s.Name, s.FilePathMinio, s.ParsedText, structureJSON, s.Version, s.IsActive, s.TeamID, s.IsBaseScript, s.IsActiveBase, metricsJSON).Scan(&s.CreatedAt, &s.UpdatedAt)
}

func (r *scriptRepository) Update(ctx context.Context, s *domain.Script) error {
	structureJSON, _ := json.Marshal(s.Structure)
	metricsJSON, _ := json.Marshal(s.BaseScriptMetrics)
	query := `
		UPDATE scripts_schema.scripts SET name = $2, is_active = $3, structure = $4, updated_at = NOW(), team_id = $5, is_base_script = $6, is_active_base = $7, base_script_metrics = $8
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query, s.ID, s.Name, s.IsActive, structureJSON, s.TeamID, s.IsBaseScript, s.IsActiveBase, metricsJSON)
	return err
}

func (r *scriptRepository) Delete(ctx context.Context, companyID, id string) error {
	query := `UPDATE scripts_schema.scripts SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, companyID)
	return err
}

func (r *scriptRepository) GetActiveByCompany(ctx context.Context, companyID string) (*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, created_at, updated_at, team_id, is_base_script, is_active_base, base_script_metrics
		FROM scripts_schema.scripts
		WHERE company_id = $1 AND is_active = true
		ORDER BY version DESC LIMIT 1
	`
	s := &domain.Script{}
	var structureJSON []byte
	var metricsJSON []byte
	err := r.db.QueryRowContext(ctx, query, companyID).Scan(
		&s.ID, &s.CompanyID, &s.Name, &s.FilePathMinio, &s.ParsedText, &structureJSON, &s.Version, &s.IsActive, &s.CreatedAt, &s.UpdatedAt, &s.TeamID, &s.IsBaseScript, &s.IsActiveBase, &metricsJSON,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("active script not found")
	}
	if err != nil {
		return nil, err
	}
	if structureJSON != nil {
		json.Unmarshal(structureJSON, &s.Structure)
	}
	if metricsJSON != nil {
		json.Unmarshal(metricsJSON, &s.BaseScriptMetrics)
	}
	return s, nil
}

func (r *scriptRepository) ListByCompany(ctx context.Context, companyID string) ([]*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, created_at, updated_at, team_id, is_base_script, is_active_base, base_script_metrics
		FROM scripts_schema.scripts
		WHERE company_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	scripts := []*domain.Script{}
	for rows.Next() {
		s := &domain.Script{}
		var structureJSON []byte
		var metricsJSON []byte
		err := rows.Scan(
			&s.ID,
			&s.CompanyID,
			&s.Name,
			&s.FilePathMinio,
			&s.ParsedText,
			&structureJSON,
			&s.Version,
			&s.IsActive,
			&s.CreatedAt,
			&s.UpdatedAt,
			&s.TeamID,
			&s.IsBaseScript,
			&s.IsActiveBase,
			&metricsJSON,
		)
		if err != nil {
			return nil, err
		}
		if structureJSON != nil {
			json.Unmarshal(structureJSON, &s.Structure)
		}
		if metricsJSON != nil {
			json.Unmarshal(metricsJSON, &s.BaseScriptMetrics)
		}
		scripts = append(scripts, s)
	}

	return scripts, nil
}

func (r *scriptRepository) GetByID(ctx context.Context, companyID, id string) (*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, created_at, updated_at, team_id, is_base_script, is_active_base, base_script_metrics
		FROM scripts_schema.scripts
		WHERE id = $1 AND company_id = $2
	`

	s := &domain.Script{}
	var structureJSON []byte
	var metricsJSON []byte
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(
		&s.ID,
		&s.CompanyID,
		&s.Name,
		&s.FilePathMinio,
		&s.ParsedText,
		&structureJSON,
		&s.Version,
		&s.IsActive,
		&s.CreatedAt,
		&s.UpdatedAt,
		&s.TeamID,
		&s.IsBaseScript,
		&s.IsActiveBase,
		&metricsJSON,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("script not found")
	}
	if err != nil {
		return nil, err
	}
	if structureJSON != nil {
		json.Unmarshal(structureJSON, &s.Structure)
	}
	if metricsJSON != nil {
		json.Unmarshal(metricsJSON, &s.BaseScriptMetrics)
	}

	return s, nil
}

func (r *scriptRepository) GetActiveBaseScript(ctx context.Context) (*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, created_at, updated_at, team_id, is_base_script, is_active_base, base_script_metrics
		FROM scripts_schema.scripts
		WHERE is_base_script = TRUE AND is_active_base = TRUE
		LIMIT 1
	`

	s := &domain.Script{}
	var structureJSON []byte
	var metricsJSON []byte
	err := r.db.QueryRowContext(ctx, query).Scan(
		&s.ID,
		&s.CompanyID,
		&s.Name,
		&s.FilePathMinio,
		&s.ParsedText,
		&structureJSON,
		&s.Version,
		&s.IsActive,
		&s.CreatedAt,
		&s.UpdatedAt,
		&s.TeamID,
		&s.IsBaseScript,
		&s.IsActiveBase,
		&metricsJSON,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("active base script not found")
	}
	if err != nil {
		return nil, err
	}
	if structureJSON != nil {
		json.Unmarshal(structureJSON, &s.Structure)
	}
	if metricsJSON != nil {
		json.Unmarshal(metricsJSON, &s.BaseScriptMetrics)
	}

	return s, nil
}

func (r *scriptRepository) GetAllBaseScripts(ctx context.Context) ([]*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, created_at, updated_at, team_id, is_base_script, is_active_base, base_script_metrics
		FROM scripts_schema.scripts
		WHERE is_base_script = TRUE
		ORDER BY is_active_base DESC, created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	scripts := []*domain.Script{}
	for rows.Next() {
		s := &domain.Script{}
		var structureJSON []byte
		var metricsJSON []byte
		err := rows.Scan(
			&s.ID,
			&s.CompanyID,
			&s.Name,
			&s.FilePathMinio,
			&s.ParsedText,
			&structureJSON,
			&s.Version,
			&s.IsActive,
			&s.CreatedAt,
			&s.UpdatedAt,
			&s.TeamID,
			&s.IsBaseScript,
			&s.IsActiveBase,
			&metricsJSON,
		)
		if err != nil {
			return nil, err
		}
		if structureJSON != nil {
			json.Unmarshal(structureJSON, &s.Structure)
		}
		if metricsJSON != nil {
			json.Unmarshal(metricsJSON, &s.BaseScriptMetrics)
		}
		scripts = append(scripts, s)
	}

	return scripts, nil
}

func (r *scriptRepository) SetActiveBaseScript(ctx context.Context, scriptID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `UPDATE scripts_schema.scripts SET is_active_base = FALSE WHERE is_base_script = TRUE`)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx, `UPDATE scripts_schema.scripts SET is_active_base = TRUE WHERE id = $1 AND is_base_script = TRUE`, scriptID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *scriptRepository) UpdateBaseScriptMetrics(ctx context.Context, scriptID string, metrics map[string]interface{}) error {
	metricsJSON, _ := json.Marshal(metrics)
	query := `UPDATE scripts_schema.scripts SET base_script_metrics = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, scriptID, metricsJSON)
	return err
}
