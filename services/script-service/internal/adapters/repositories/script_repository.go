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
