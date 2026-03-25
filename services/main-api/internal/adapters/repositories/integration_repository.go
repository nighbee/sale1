package repositories

import (
	"context"
	"database/sql"
	"errors"

	"github.com/salesai/main-api/internal/core/domain"
	"github.com/salesai/main-api/internal/core/ports"
)

type integrationRepository struct {
	db *sql.DB
}

func NewIntegrationRepository(db *sql.DB) ports.IntegrationRepository {
	return &integrationRepository{db: db}
}

func (r *integrationRepository) Create(ctx context.Context, i *domain.Integration) error {
	query := `
		INSERT INTO integrations_schema.integrations
		(id, integration_type, credentials, config, is_active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		i.ID, i.IntegrationType, i.Credentials, i.Config, i.IsActive,
	).Scan(&i.CreatedAt, &i.UpdatedAt)
}

func (r *integrationRepository) GetByType(ctx context.Context, it domain.IntegrationType) (*domain.Integration, error) {
	query := `
		SELECT id, integration_type, credentials, config, is_active, last_sync, created_at, updated_at
		FROM integrations_schema.integrations
		WHERE integration_type = $1
	`
	i := &domain.Integration{}
	err := r.db.QueryRowContext(ctx, query, it).Scan(
		&i.ID, &i.IntegrationType, &i.Credentials, &i.Config, &i.IsActive, &i.LastSync, &i.CreatedAt, &i.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("integration not found")
	}
	return i, err
}

func (r *integrationRepository) List(ctx context.Context) ([]*domain.Integration, error) {
	query := `
		SELECT id, integration_type, credentials, config, is_active, last_sync, created_at, updated_at
		FROM integrations_schema.integrations
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	integrations := []*domain.Integration{}
	for rows.Next() {
		i := &domain.Integration{}
		if err := rows.Scan(&i.ID, &i.IntegrationType, &i.Credentials, &i.Config, &i.IsActive, &i.LastSync, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		integrations = append(integrations, i)
	}
	return integrations, nil
}

func (r *integrationRepository) ListAllActive(ctx context.Context) ([]*domain.Integration, error) {
	query := `
		SELECT id, integration_type, credentials, config, is_active, last_sync, created_at, updated_at
		FROM integrations_schema.integrations
		WHERE is_active = TRUE
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	integrations := []*domain.Integration{}
	for rows.Next() {
		i := &domain.Integration{}
		if err := rows.Scan(&i.ID, &i.IntegrationType, &i.Credentials, &i.Config, &i.IsActive, &i.LastSync, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		integrations = append(integrations, i)
	}
	return integrations, nil
}

func (r *integrationRepository) Update(ctx context.Context, i *domain.Integration) error {
	query := `
		UPDATE integrations_schema.integrations
		SET credentials = $2, config = $3, is_active = $4, updated_at = NOW()
		WHERE integration_type = $1
	`
	_, err := r.db.ExecContext(ctx, query, i.IntegrationType, i.Credentials, i.Config, i.IsActive)
	return err
}

func (r *integrationRepository) Delete(ctx context.Context, it domain.IntegrationType) error {
	query := `DELETE FROM integrations_schema.integrations WHERE integration_type = $1`
	_, err := r.db.ExecContext(ctx, query, it)
	return err
}
