package repositories

import (
	"context"
	"database/sql"
)

type ScriptRepository struct {
	db *sql.DB
}

func NewScriptRepository(db *sql.DB) *ScriptRepository {
	return &ScriptRepository{db: db}
}

func (r *ScriptRepository) Create(ctx context.Context, id, companyID, name, filePath, parsedText string) error {
	query := `
		INSERT INTO scripts_schema.scripts
		(id, company_id, name, file_path_minio, parsed_text, version, is_active)
		VALUES ($1, $2, $3, $4, $5, 1, true)
	`
	_, err := r.db.ExecContext(ctx, query, id, companyID, name, filePath, parsedText)
	return err
}

func (r *ScriptRepository) List(ctx context.Context, companyID string) ([]map[string]interface{}, error) {
	query := `SELECT id, name, version, is_active, created_at FROM scripts_schema.scripts WHERE company_id = $1`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scripts []map[string]interface{}
	for rows.Next() {
		var id, name string
		var version int
		var isActive bool
		var createdAt string
		if err := rows.Scan(&id, &name, &version, &isActive, &createdAt); err != nil {
			return nil, err
		}
		scripts = append(scripts, map[string]interface{}{
			"id":         id,
			"name":       name,
			"version":    version,
			"is_active":  isActive,
			"created_at": createdAt,
		})
	}
	return scripts, nil
}

func (r *ScriptRepository) Delete(ctx context.Context, id string) error {
	query := `UPDATE scripts_schema.scripts SET is_active = false WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
