import grpc
from concurrent import futures
import time
import logging
import os
from . import stt_service_pb2
from . import stt_service_pb2_grpc
from src.adapters.storage.postgres_repo import get_pool
import json
from src.infrastructure.monitoring.metrics import REQUEST_COUNT, REQUEST_LATENCY

logger = logging.getLogger(__name__)

class STTServiceServicer(stt_service_pb2_grpc.STTServiceServicer):
    def GetTranscript(self, request, context):
        with REQUEST_LATENCY.labels(app_name='stt-service', method='GRPC', path='/GetTranscript').time():
            call_id = request.call_id
            logger.info("gRPC GetTranscript called", extra={"call_id": call_id, "method": "GetTranscript"})

            conn = get_pool().getconn()
            cur = None
            try:
                cur = conn.cursor()
                cur.execute("SELECT speaker_diarized_json, stt_provider, processing_time_seconds FROM calls_schema.transcripts WHERE call_id = %s", (call_id,))
                row = cur.fetchone()

                if row:
                    REQUEST_COUNT.labels(app_name='stt-service', method='GRPC', path='/GetTranscript', status_code='200').inc()
                    segments = json.loads(row[0]) if isinstance(row[0], str) else row[0]
                    segment_count = len(segments) if segments else 0
                    logger.info(
                        "gRPC GetTranscript success",
                        extra={
                            "call_id": call_id,
                            "stt_provider": row[1],
                            "processing_time_s": row[2] or 0,
                            "segment_count": segment_count,
                        },
                    )
                    return stt_service_pb2.TranscriptResponse(
                        call_id=call_id,
                        transcript_json=json.dumps(row[0]),
                        stt_provider=row[1],
                        processing_time=row[2] or 0
                    )
                else:
                    REQUEST_COUNT.labels(app_name='stt-service', method='GRPC', path='/GetTranscript', status_code='404').inc()
                    logger.warning("gRPC GetTranscript not found", extra={"call_id": call_id})
                    context.set_code(grpc.StatusCode.NOT_FOUND)
                    context.set_details("Transcript not found")
                    return stt_service_pb2.TranscriptResponse()
            except Exception as e:
                REQUEST_COUNT.labels(app_name='stt-service', method='GRPC', path='/GetTranscript', status_code='500').inc()
                logger.error("gRPC GetTranscript error", extra={"call_id": call_id, "error": str(e)})
                raise e
            finally:
                if cur:
                    cur.close()
                conn.rollback()
                get_pool().putconn(conn)

def serve():
    port = os.getenv("GRPC_PORT", "50051")
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    stt_service_pb2_grpc.add_STTServiceServicer_to_server(STTServiceServicer(), server)
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    logger.info("STT gRPC server started", extra={"grpc_port": port})
    return server
