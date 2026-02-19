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
	query := `
		INSERT INTO scripts_schema.scripts (id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, team_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query, s.ID, s.CompanyID, s.Name, s.FilePathMinio, s.ParsedText, structureJSON, s.Version, s.IsActive, s.TeamID).Scan(&s.CreatedAt, &s.UpdatedAt)
}

func (r *scriptRepository) Update(ctx context.Context, s *domain.Script) error {
	structureJSON, _ := json.Marshal(s.Structure)
	query := `
		UPDATE scripts_schema.scripts SET name = $2, is_active = $3, structure = $4, updated_at = NOW(), team_id = $6
		WHERE id = $1 AND company_id = $5
	`
	_, err := r.db.ExecContext(ctx, query, s.ID, s.Name, s.IsActive, structureJSON, s.CompanyID, s.TeamID)
	return err
}

func (r *scriptRepository) Delete(ctx context.Context, companyID, id string) error {
	query := `UPDATE scripts_schema.scripts SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, companyID)
	return err
}

func (r *scriptRepository) GetActiveByCompany(ctx context.Context, companyID string) (*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, created_at, updated_at, team_id
		FROM scripts_schema.scripts
		WHERE company_id = $1 AND is_active = true
		ORDER BY version DESC LIMIT 1
	`
	s := &domain.Script{}
	var structureJSON []byte
	err := r.db.QueryRowContext(ctx, query, companyID).Scan(
		&s.ID, &s.CompanyID, &s.Name, &s.FilePathMinio, &s.ParsedText, &structureJSON, &s.Version, &s.IsActive, &s.CreatedAt, &s.UpdatedAt, &s.TeamID,
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
	return s, nil
}

func (r *scriptRepository) ListByCompany(ctx context.Context, companyID string) ([]*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, created_at, updated_at, team_id
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
		)
		if err != nil {
			return nil, err
		}
		if structureJSON != nil {
			json.Unmarshal(structureJSON, &s.Structure)
		}
		scripts = append(scripts, s)
	}

	return scripts, nil
}

func (r *scriptRepository) GetByID(ctx context.Context, companyID, id string) (*domain.Script, error) {
	query := `
		SELECT id, company_id, name, file_path_minio, parsed_text, structure, version, is_active, created_at, updated_at, team_id
		FROM scripts_schema.scripts
		WHERE id = $1 AND company_id = $2
	`

	s := &domain.Script{}
	var structureJSON []byte
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

	return s, nil
}
