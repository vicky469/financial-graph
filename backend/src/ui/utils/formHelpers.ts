import { JobFormData, Job } from '../types/job.types';

/**
 * Creates an empty form data object with default values
 */
export function createEmptyFormData(): JobFormData {
  return {
    name: '',
    nameOverride: false,
    description: '',
    job_type: '',
    enabled: true,
    schedule_type: 'manual',
    cron_expression: '',
    interval_minutes: 60, // Default to 1 hour
    source: {
      year: '',
      quarter: '',
      month: '',
      day: '',
      description: '',
      url: '',
      location_type: '',
      location: '',
      filters: [],
    },
    destinations: [
      {
        year: '',
        quarter: '',
        month: '',
        day: '',
        description: '',
        location_type: '',
        location: '',
      },
    ],
  };
}

/**
 * Converts a Job object to JobFormData for editing
 */
export function jobToFormData(job: Job): JobFormData {
  return {
    name: job.name,
    nameOverride: false,
    description: job.description || '',
    job_type: job.job_type || '',
    enabled: job.enabled,
    schedule_type: job.schedule_type,
    cron_expression: job.cron_expression || '',
    interval_minutes: job.interval_minutes || 60,
    source: job.sources?.[0]
      ? {
          year: job.sources[0].parameters?.year || '',
          quarter: job.sources[0].parameters?.quarter || '',
          month: job.sources[0].parameters?.month || '',
          day: job.sources[0].parameters?.day || '',
          description: job.sources[0].parameters?.description || '',
          url: job.sources[0].parameters?.url || '',
          location_type: job.sources[0].parameters?.location_type || '',
          location: job.sources[0].parameters?.location || '',
          filters: job.sources[0].filters || [],
        }
      : {
          year: '',
          quarter: '',
          month: '',
          day: '',
          description: '',
          url: '',
          location_type: '',
          location: '',
          filters: [],
        },
    destinations:
      job.destinations && job.destinations.length > 0
        ? job.destinations.map((dest) => ({
            year: dest.parameters?.year || '',
            quarter: dest.parameters?.quarter || '',
            month: dest.parameters?.month || '',
            day: dest.parameters?.day || '',
            description: dest.parameters?.description || '',
            location_type: dest.parameters?.location_type || '',
            location: dest.parameters?.location || '',
          }))
        : [
            {
              year: '',
              quarter: '',
              month: '',
              day: '',
              description: '',
              location_type: '',
              location: '',
            },
          ],
  };
}

/**
 * Extract type options from a job for populating NotionCombobox
 */
export function extractTypeOptionsFromJob(job: Job): {
  jobType?: string;
  sourceLocationType?: string;
  destinationLocationTypes: string[];
} {
  return {
    jobType: job.job_type,
    sourceLocationType: job.sources?.[0]?.parameters?.location_type,
    destinationLocationTypes: (job.destinations || [])
      .map(d => d.parameters?.location_type)
      .filter((t): t is string => !!t),
  };
}

/**
 * Converts JobFormData to API payload format
 */
export function formDataToJobPayload(formData: JobFormData) {
  const source = formData.source
    ? {
        parameters: {
          description: formData.source.description,
          year: formData.source.year,
          quarter: formData.source.quarter,
          month: formData.source.month,
          day: formData.source.day,
          url: formData.source.url,
          location_type: formData.source.location_type,
          location: formData.source.location,
        },
        filters: formData.source.filters || [],
        order_index: 0,
      }
    : undefined;

  const destinations = formData.destinations
    .filter(dest => dest.location_type || dest.location) // Only include destinations with data
    .map((dest, index) => ({
      parameters: {
        year: dest.year,
        quarter: dest.quarter,
        month: dest.month,
        day: dest.day,
        description: dest.description,
        location_type: dest.location_type,
        location: dest.location,
      },
      order_index: index,
    }));

  return {
    name: formData.name,
    description: formData.description,
    job_type: formData.job_type,
    enabled: formData.enabled,
    schedule_type: formData.schedule_type,
    cron_expression: formData.cron_expression,
    interval_minutes: formData.interval_minutes,
    sources: source ? [source] : undefined,
    destinations: destinations.length > 0 ? destinations : undefined,
  };
}
