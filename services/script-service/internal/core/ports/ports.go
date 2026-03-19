package ports

import (
	"context"
	"io"
	"github.com/salesai/script-service/internal/core/domain"
)

type ScriptRepository interface {
	Create(ctx context.Context, script *domain.Script) error
	GetByID(ctx context.Context, id string) (*domain.Script, error)
	List(ctx context.Context, companyID string) ([]*domain.Script, error)
	Delete(ctx context.Context, id string) error
}

type Storage interface {
	Upload(ctx context.Context, bucketName, objectName, filePath string) error
	GetStream(ctx context.Context, bucketName, objectName string) (io.ReadCloser, error)
	BucketExists(ctx context.Context, bucketName string) (bool, error)
	MakeBucket(ctx context.Context, bucketName string) error
}
