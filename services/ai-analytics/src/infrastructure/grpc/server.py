import grpc
from concurrent import futures
import logging
from . import analytics_service_pb2
from . import analytics_service_pb2_grpc
from src.adapters.storage.postgres_repo import get_pool
from src.infrastructure.monitoring.metrics import REQUEST_COUNT, REQUEST_LATENCY

logger = logging.getLogger(__name__)

class AnalyticsServiceServicer(analytics_service_pb2_grpc.AnalyticsServiceServicer):
    def GetAnalysis(self, request, context):
        with REQUEST_LATENCY.labels(app_name='ai-analytics', method='GRPC', path='/GetAnalysis').time():
            call_id = request.call_id
            logger.info("gRPC GetAnalysis called", extra={"call_id": call_id, "method": "GetAnalysis"})

            conn = get_pool().getconn()
            cur = None
            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT quality_score, script_match, errors_free, overall_rating, kpi, recommendation, brief, next_best_action
                    FROM calls_schema.analysis_reports
                    WHERE call_id = %s
                """, (call_id,))
                row = cur.fetchone()

                if row:
                    REQUEST_COUNT.labels(app_name='ai-analytics', method='GRPC', path='/GetAnalysis', status_code='200').inc()
                    logger.info(
                        "gRPC GetAnalysis success",
                        extra={
                            "call_id": call_id,
                            "overall_rating": float(row[3]),
                            "quality_score": row[0],
                            "script_match": row[1],
                            "errors_free": row[2],
                            "kpi": float(row[4]),
                        },
                    )
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
                    REQUEST_COUNT.labels(app_name='ai-analytics', method='GRPC', path='/GetAnalysis', status_code='404').inc()
                    logger.warning("gRPC GetAnalysis not found", extra={"call_id": call_id})
                    context.set_code(grpc.StatusCode.NOT_FOUND)
                    context.set_details("Analysis not found")
                    return analytics_service_pb2.AnalysisResponse()
            except Exception as e:
                REQUEST_COUNT.labels(app_name='ai-analytics', method='GRPC', path='/GetAnalysis', status_code='500').inc()
                logger.error("gRPC GetAnalysis error", extra={"call_id": call_id, "error": str(e)})
                raise e
            finally:
                if cur:
                    cur.close()
                conn.rollback()
                get_pool().putconn(conn)

import os

def serve():
    port = os.getenv("GRPC_PORT", "50052")
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    analytics_service_pb2_grpc.add_AnalyticsServiceServicer_to_server(AnalyticsServiceServicer(), server)
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    logger.info("Analytics gRPC server started", extra={"grpc_port": port})
    return server
