import grpc
from concurrent import futures
import json
import logging
import os
from src.proto import stt_service_pb2, stt_service_pb2_grpc
from src.adapters.storage.postgres_repo import get_pool # Assuming I can reuse pool or I need a getter

logger = logging.getLogger(__name__)

class STTServicer(stt_service_pb2_grpc.STTServiceServicer):
    def GetTranscript(self, request, context):
        call_id = request.call_id
        logger.info(f"gRPC GetTranscript called for call {call_id}")

        conn = get_pool().getconn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT speaker_diarized_json, stt_provider, processed_at FROM calls_schema.transcripts WHERE call_id = %s", (call_id,))
            row = cur.fetchone()
            if row:
                return stt_service_pb2.TranscriptResponse(
                    call_id=call_id,
                    transcript_json=json.dumps(row[0]),
                    stt_provider=row[1],
                    processing_time=0 # Mocked
                )
            else:
                context.set_code(grpc.StatusCode.NOT_FOUND)
                context.set_details("Transcript not found")
                return stt_service_pb2.TranscriptResponse()
        finally:
            get_pool().putconn(conn)

def serve_grpc():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    stt_service_pb2_grpc.add_STTServiceServicer_to_server(STTServicer(), server)
    port = os.getenv("GRPC_PORT", "50051")
    server.add_insecure_port(f'[::]:{port}')
    logger.info(f"gRPC server starting on port {port}...")
    server.start()
    server.wait_for_termination()
