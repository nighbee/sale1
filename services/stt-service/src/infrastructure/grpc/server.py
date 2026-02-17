import grpc
from concurrent import futures
import time
import logging
import os
from . import stt_service_pb2
from . import stt_service_pb2_grpc
from src.adapters.storage.postgres_repo import get_pool
import json

logger = logging.getLogger(__name__)

class STTServiceServicer(stt_service_pb2_grpc.STTServiceServicer):
    def GetTranscript(self, request, context):
        call_id = request.call_id
        logger.info(f"gRPC GetTranscript called for call_id: {call_id}")

        conn = get_pool().getconn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT speaker_diarized_json, stt_provider, processing_time_seconds FROM calls_schema.transcripts WHERE call_id = %s", (call_id,))
            row = cur.fetchone()
            cur.close()

            if row:
                return stt_service_pb2.TranscriptResponse(
                    call_id=call_id,
                    transcript_json=json.dumps(row[0]),
                    stt_provider=row[1],
                    processing_time=row[2] or 0
                )
            else:
                context.abort(grpc.StatusCode.NOT_FOUND, "Transcript not found")
        finally:
            get_pool().putconn(conn)

def serve():
    port = os.getenv("GRPC_PORT", "50051")
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    stt_service_pb2_grpc.add_STTServiceServicer_to_server(STTServiceServicer(), server)
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    logger.info(f"STT gRPC server started on port {port}")
    return server
