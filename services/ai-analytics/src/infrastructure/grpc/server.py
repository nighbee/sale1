import grpc
from concurrent import futures
import logging
from . import analytics_service_pb2
from . import analytics_service_pb2_grpc
from src.adapters.storage.postgres_repo import get_pool

logger = logging.getLogger(__name__)

class AnalyticsServiceServicer(analytics_service_pb2_grpc.AnalyticsServiceServicer):
    def GetAnalysis(self, request, context):
        call_id = request.call_id
        logger.info(f"gRPC GetAnalysis called for call_id: {call_id}")

        conn = get_pool().getconn()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT quality_score, script_match, errors_free, overall_rating, kpi, recommendation, brief, next_best_action
                FROM calls_schema.analysis_reports
                WHERE call_id = %s
            """, (call_id,))
            row = cur.fetchone()
            cur.close()

            if row:
                return analytics_service_pb2.AnalysisResponse(
                    call_id=call_id,
                    quality_score=row[0],
                    script_match=row[1],
                    errors_free=row[2],
                    overall_rating=float(row[3]),
                    kpi=float(row[4]),
                    recommendation=row[5],
                    brief=row[6],
                    next_best_action=row[7]
                )
            else:
                context.abort(grpc.StatusCode.NOT_FOUND, "Analysis not found")
        finally:
            get_pool().putconn(conn)

import os

def serve():
    port = os.getenv("GRPC_PORT", "50052")
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    analytics_service_pb2_grpc.add_AnalyticsServiceServicer_to_server(AnalyticsServiceServicer(), server)
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    logger.info(f"Analytics gRPC server started on port {port}")
    return server
