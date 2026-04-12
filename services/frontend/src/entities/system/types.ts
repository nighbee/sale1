export interface QueueStatus {
  queues: Record<string, number>;
  status: string;
}

export interface MetricData {
  cpu: any;
  memory: any;
}

export interface LogEntry {
  logs: any;
}
