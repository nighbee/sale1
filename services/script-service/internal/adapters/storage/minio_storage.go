package storage

import (
	"context"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/salesai/script-service/internal/core/ports"
)

type minioStorage struct {
	client *minio.Client
}

func NewMinioStorage(client *minio.Client) ports.Storage {
	return &minioStorage{client: client}
}

func (s *minioStorage) Upload(ctx context.Context, bucketName, objectName, filePath string) error {
	_, err := s.client.FPutObject(ctx, bucketName, objectName, filePath, minio.PutObjectOptions{
		ContentType: "application/octet-stream",
	})
	return err
}

func (s *minioStorage) GetStream(ctx context.Context, bucketName, objectName string) (io.ReadCloser, error) {
	return s.client.GetObject(ctx, bucketName, objectName, minio.GetObjectOptions{})
}

func (s *minioStorage) BucketExists(ctx context.Context, bucketName string) (bool, error) {
	return s.client.BucketExists(ctx, bucketName)
}

func (s *minioStorage) MakeBucket(ctx context.Context, bucketName string) error {
	return s.client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
}
