export interface JobModel {
  id: string;
  name: string;
  payload: JobPayload;
  options?: JobOptions;
  state: JobState;
  status?: JobStatus;
  result?: JobResult;
}

export type JobModelNew = Pick<JobModel, "name" | "payload" | "options">;

export interface JobOptions {
  priority?: number;
  attempts?: number;
  deduplication?: {
    id: string;
  };
  deferUntil?: number;
  delay?: number;
}

export enum JobState {
  Pending = "Pending",
  Reserved = "Reserved",
  Started = "Started",
  Completed = "Completed",
  Failed = "Failed",
}

export interface JobLogEntry {
  timestamp: Date;
  level: number;
  message: string;
  data?: Record<string, string>;
}

export interface JobStatus {
  progress?: number;
  statusMessage?: string;
  startTime?: Date;
  endTimeEstimated?: Date;
  endTime?: Date;
  log?: JobLogEntry[];
}

export interface JobPayload extends Record<string, any> {
  [key: string]: any;
}

export interface JobResult extends Record<string, any> {
  [key: string]: any;
}

export type JobProgressFn = (
  progress: number,
  statusMessage?: string
) => Promise<void>;

export type JobHandler = (
  payload: JobPayload,
  update: JobProgressFn
) => Promise<JobResult>;

export interface JobScheduleModel {
  key: string;
  repeatOptions: JobRepeatOptions;
  jobTemplate: JobModelNew;

  count?: number;
  jobId?: string;
  prevMillis?: number;
  nextMillis?: number;
}

export type JobRepeatOptions = { pattern: string } | { every: number };
