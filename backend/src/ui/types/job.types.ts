import { NotionOption } from '../NotionCombobox';

export interface JobStatus {
  text: string;
  icon: string;
  class: string;
}

export interface JobFilter {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface JobSource {
  year: string;
  quarter: string;
  month: string;
  day: string;
  description: string;
  url: string;
  location_type: string;
  location: string;
  filters: JobFilter[];
}

export interface JobTransformation {
  location_type: string;
  location: string;
}

export interface JobDestination {
  year: string;
  quarter: string;
  month: string;
  day: string;
  description: string;
  location_type: string;
  location: string;
}

export interface JobFormData {
  name: string;
  nameOverride: boolean;
  description: string;
  job_type: string;
  enabled: boolean;
  schedule_type: 'manual' | 'cron' | 'interval';
  cron_expression: string;
  interval_minutes: number;
  source: JobSource | null;
  destinations: JobDestination[];
}

export interface TypeOption extends NotionOption {}

export interface Job {
  id: string;
  name: string;
  description?: string;
  job_type?: string;
  enabled: boolean;
  schedule_type: 'manual' | 'cron' | 'interval';
  cron_expression?: string;
  interval_minutes?: number;
  sources?: Array<{
    parameters?: {
      year?: string;
      quarter?: string;
      month?: string;
      day?: string;
      description?: string;
      url?: string;
      location_type?: string;
      location?: string;
    };
    filters?: JobFilter[];
  }>;
  transformations?: Array<{
    parameters?: {
      location_type?: string;
      location?: string;
    };
  }>;
  transformations?: Array<{
    parameters?: {
      location_type?: string;
      location?: string;
    };
  }>;
  destinations?: Array<{
    parameters?: {
      year?: string;
      quarter?: string;
      month?: string;
      day?: string;
      description?: string;
      location_type?: string;
      location?: string;
    };
  }>;
  executions?: Array<{
    id: string;
    status: 'running' | 'completed' | 'failed';
    started_at: string;
    completed_at?: string;
  }>;
}
