package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/salesai/main-api/internal/core/domain"
)

type scriptRepository struct {
	db *sql.DB
}

func NewScriptRepository(db *sql.DB) *scriptRepository {
	return &scriptRepository{db: db}
}

func (r *scriptRepository) GetByCompany(ctx context.Context, companyID string) ([]*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, version, is_active, created_at, updated_at
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
		err := rows.Scan(
			&s.ID,
			&s.CompanyID,
			&s.Name,
			&s.FilePathMinio,
			&s.ParsedText,
			&s.Version,
			&s.IsActive,
			&s.CreatedAt,
			&s.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		scripts = append(scripts, s)
	}

	return scripts, nil
}

func (r *scriptRepository) GetByID(ctx context.Context, id string) (*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, version, is_active, created_at, updated_at
		FROM scripts_schema.scripts
		WHERE id = $1
	`

	s := &domain.Script{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&s.ID,
		&s.CompanyID,
		&s.Name,
		&s.FilePathMinio,
		&s.ParsedText,
		&s.Version,
		&s.IsActive,
		&s.CreatedAt,
		&s.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("script not found")
	}

	return s, err
}
