package repositories

import (
	"context"
	"database/sql"
	"github.com/salesai/script-service/internal/core/domain"
	"github.com/salesai/script-service/internal/core/ports"
)

type ScriptRepository struct {
	db *sql.DB
}

func NewScriptRepository(db *sql.DB) ports.ScriptRepository {
	return &ScriptRepository{db: db}
}

func (r *ScriptRepository) Create(ctx context.Context, script *domain.Script) error {
	query := `
		INSERT INTO scripts_schema.scripts
		(id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, team_id)
		VALUES ($1, $2, $3, $4, $5, $6, 1, true, $7)
	`
	// Initialize empty structure if empty
	structure := script.Structure
	if structure == "" {
		structure = "{}"
	}
	_, err := r.db.ExecContext(ctx, query, script.ID, script.CompanyID, script.Name, script.FilePathMinio, script.ParsedText, structure, script.TeamID)
	return err
}

func (r *ScriptRepository) GetByID(ctx context.Context, id string) (*domain.Script, error) {
	query := `SELECT id, name, file_path_minio FROM scripts_schema.scripts WHERE id = $1`
	script := &domain.Script{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(&script.ID, &script.Name, &script.FilePathMinio)
	if err != nil {
		return nil, err
	}
	return script, nil
}

func (r *ScriptRepository) List(ctx context.Context, companyID string) ([]*domain.Script, error) {
	query := `SELECT id, name, version, is_active, created_at FROM scripts_schema.scripts WHERE company_id = $1`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scripts []*domain.Script
	for rows.Next() {
		script := &domain.Script{}
		var createdAt string
		if err := rows.Scan(&script.ID, &script.Name, &script.Version, &script.IsActive, &createdAt); err != nil {
			return nil, err
		}
		// In a real app we'd parse createdAt to time.Time
		scripts = append(scripts, script)
	}
	return scripts, nil
}

func (r *ScriptRepository) Delete(ctx context.Context, id string) error {
	query := `UPDATE scripts_schema.scripts SET is_active = false WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
