import grpc
from concurrent import futures
import logging
import os
from src.proto import analytics_service_pb2, analytics_service_pb2_grpc
from src.adapters.storage.postgres_repo import get_pool
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

class AnalyticsServicer(analytics_service_pb2_grpc.AnalyticsServiceServicer):
    def GetAnalysis(self, request, context):
        call_id = request.call_id
        logger.info(f"gRPC GetAnalysis called for call {call_id}")

        conn = get_pool().getconn()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT * FROM calls_schema.analysis_reports WHERE call_id = %s", (call_id,))
            row = cur.fetchone()
            if row:
                return analytics_service_pb2.AnalysisResponse(
                    call_id=call_id,
                    quality_score=row['quality_score'],
                    script_match=row['script_match'],
                    errors_free=row['errors_free'],
                    overall_rating=float(row['overall_rating']),
                    kpi=float(row['kpi']),
                    recommendation=row['recommendation'],
                    brief=row['brief'],
                    next_best_action=row['next_best_action']
                )
            else:
                context.set_code(grpc.StatusCode.NOT_FOUND)
                context.set_details("Analysis report not found")
                return analytics_service_pb2.AnalysisResponse()
        finally:
            get_pool().putconn(conn)

def serve_grpc():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    analytics_service_pb2_grpc.add_AnalyticsServiceServicer_to_server(AnalyticsServicer(), server)
    port = os.getenv("GRPC_PORT", "50052")
    server.add_insecure_port(f'[::]:{port}')
    logger.info(f"gRPC server starting on port {port}...")
    server.start()
    server.wait_for_termination()
