/**
 * Simple In-Memory Job Queue for Async Processing
 * For production, consider using Redis or a proper queue system
 */

interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

/**
 * Create a new job
 */
export function createJob(): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  jobs.set(id, {
    id,
    status: 'pending',
    createdAt: Date.now(),
  });
  
  // Clean up old jobs (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [jobId, job] of jobs.entries()) {
    if (job.createdAt < oneHourAgo) {
      jobs.delete(jobId);
    }
  }
  
  return id;
}

/**
 * Get job status
 */
export function getJobStatus(id: string): Job | null {
  return jobs.get(id) || null;
}

/**
 * Update job status
 */
export function updateJob(id: string, updates: Partial<Job>): void {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, updates);
  }
}

/**
 * Set job as processing
 */
export function setJobProcessing(id: string): void {
  updateJob(id, { status: 'processing' });
}

/**
 * Set job as completed with result
 */
export function setJobCompleted(id: string, result: any): void {
  updateJob(id, { status: 'completed', result });
}

/**
 * Set job as failed with error
 */
export function setJobFailed(id: string, error: string): void {
  updateJob(id, { status: 'failed', error });
}
