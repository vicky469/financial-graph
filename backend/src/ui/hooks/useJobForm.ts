import { useState } from 'react';
import { JobFormData, TypeOption } from '../types/job.types';
import {
  createEmptyFormData,
  jobToFormData,
  formDataToJobPayload,
} from '../utils/formHelpers';
import { computeSourceName } from '../utils/jobHelpers';
import * as jobService from '../services/jobService';
import { MessageType } from './useJobActions';
import { JobConfigurationSchema } from '@financial-graph/shared';

/**
 * Hook to manage job form state and operations
 */
export function useJobForm(
  showMessage: (msg: string, type: MessageType) => void
) {
  const [formData, setFormData] = useState<JobFormData>(createEmptyFormData());
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'basic' | 'sources' | 'destinations'
  >('basic');
  const [showSourceDescription, setShowSourceDescription] = useState(false);
  const [sourceTypes, setSourceTypes] = useState<TypeOption[]>([]);
  const [sourceLocationTypes, setSourceLocationTypes] = useState<TypeOption[]>(
    []
  );
  const [destinationTypes, setDestinationTypes] = useState<TypeOption[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isEditMode = editingJobId !== null;

  const clearForm = () => {
    setFormData(createEmptyFormData());
    setEditingJobId(null);
    setShowSourceDescription(false);
    setValidationErrors({});
  };

  const openEditModal = (job: any) => {
    const formData = jobToFormData(job);
    setFormData(formData);
    setEditingJobId(job.id);
    
    // Populate type options from the job data
    if (job.job_type) {
      const jobTypeOption = { value: job.job_type, label: job.job_type.replace(/_/g, ' ') };
      setSourceTypes(prev => {
        if (!prev.find(t => t.value === job.job_type)) {
          return [...prev, jobTypeOption];
        }
        return prev;
      });
    }
    
    if (job.sources?.[0]?.parameters?.location_type) {
      const locType = job.sources[0].parameters.location_type;
      const option = { value: locType, label: locType.replace(/_/g, ' ') };
      setSourceLocationTypes(prev => {
        if (!prev.find(t => t.value === locType)) {
          return [...prev, option];
        }
        return prev;
      });
    }
    
    if (job.destinations) {
      setDestinationTypes(prev => {
        const newTypes = [...prev];
        let updated = false;
        
        for (const dest of job.destinations) {
          if (dest.parameters?.location_type) {
            const locType = dest.parameters.location_type;
            if (!newTypes.find(t => t.value === locType)) {
              newTypes.push({ value: locType, label: locType.replace(/_/g, ' ') });
              updated = true;
            }
          }
        }
        
        return updated ? newTypes : prev;
      });
    }
    
    setShowCreateModal(true);
    setActiveTab('basic');
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingJobId(null);
    clearForm();
  };

  const updateFormField = (field: keyof JobFormData, value: any) => {
    if (field === 'name') {
      setFormData((prev) => ({ ...prev, [field]: value, nameOverride: true }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const updateSource = (field: string, value: string) => {
    setFormData((prev) => {
      const newSource = prev.source
        ? { ...prev.source, [field]: value }
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
          };

      // Auto-compute name if not manually overridden
      if (
        !prev.nameOverride &&
        (field === 'year' || field === 'quarter' || field === 'month' || field === 'day' || field === 'type')
      ) {
        const newName = computeSourceName(
          field === 'type' ? value : prev.job_type,
          field === 'year' ? value : newSource.year,
          field === 'quarter' ? value : newSource.quarter,
          field === 'month' ? value : newSource.month,
          field === 'day' ? value : newSource.day,
          sourceTypes
        );
        return { ...prev, name: newName, source: newSource };
      }

      return { ...prev, source: newSource };
    });
  };

  const addSourceFilter = () => {
    setFormData((prev) => ({
      ...prev,
      source: prev.source
        ? {
            ...prev.source,
            filters: [
              ...prev.source.filters,
              { field: 'limit', operator: 'equals', value: '' },
            ],
          }
        : prev.source,
    }));
  };

  const updateSourceFilter = (
    index: number,
    field: 'field' | 'operator' | 'value',
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      source: prev.source
        ? {
            ...prev.source,
            filters: prev.source.filters.map((filter, i) =>
              i === index ? { ...filter, [field]: value } : filter
            ),
          }
        : prev.source,
    }));
  };

  const removeSourceFilter = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      source: prev.source
        ? {
            ...prev.source,
            filters: prev.source.filters.filter((_, i) => i !== index),
          }
        : prev.source,
    }));
  };

  const addDestination = () => {
    setFormData((prev) => ({
      ...prev,
      destinations: [
        ...prev.destinations,
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
    }));
  };

  const updateDestination = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      destinations: prev.destinations.map((dest, i) =>
        i === index ? { ...dest, [field]: value } : dest
      ),
    }));
  };

  const removeDestination = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      destinations: prev.destinations.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Clear previous validation errors
      setValidationErrors({});

      // Convert form data to job payload
      const jobData = formDataToJobPayload(formData);

      console.log('[handleSubmit] Form data:', formData);
      console.log('[handleSubmit] Job payload:', jobData);

      // Validate using shared schema
      const validationData: any = {
        name: jobData.name,
        description: jobData.description,
        job_type: jobData.job_type,
        enabled: jobData.enabled,
        schedule_type: jobData.schedule_type,
        created_by: 'ui-user',
      };

      // Only include cron_expression if schedule_type is 'cron' and it's not empty
      if (jobData.schedule_type === 'cron' && jobData.cron_expression) {
        validationData.cron_expression = jobData.cron_expression;
      }

      // Only include interval_minutes if schedule_type is 'interval'
      if (jobData.schedule_type === 'interval' && jobData.interval_minutes) {
        validationData.interval_minutes = jobData.interval_minutes;
      }

      const validationResult = JobConfigurationSchema.safeParse(validationData);

      console.log('[handleSubmit] Validation result:', validationResult);

      if (!validationResult.success) {
        // Map validation errors to field names
        const errors: Record<string, string> = {};
        validationResult.error.issues.forEach((issue: any) => {
          const fieldPath = issue.path.join('.');
          errors[fieldPath] = issue.message;
        });
        console.log('[handleSubmit] Validation errors:', errors);
        setValidationErrors(errors);
        showMessage('Please fix the validation errors', 'error');
        return;
      }

      showMessage(isEditMode ? 'Updating job...' : 'Creating job...', 'info');

      if (isEditMode) {
        await jobService.updateJob(editingJobId!, jobData);
        showMessage('Job updated successfully', 'success');
      } else {
        await jobService.createJob(jobData);
        showMessage('Job created successfully', 'success');
      }

      closeModal();
    } catch (error: any) {
      console.error(
        isEditMode ? 'Failed to update job:' : 'Failed to create job:',
        error
      );
      showMessage(
        `Failed to ${isEditMode ? 'update' : 'create'} job: ${error.message}`,
        'error'
      );
    }
  };

  return {
    formData,
    setFormData,
    editingJobId,
    showCreateModal,
    setShowCreateModal,
    activeTab,
    setActiveTab,
    showSourceDescription,
    setShowSourceDescription,
    sourceTypes,
    setSourceTypes,
    sourceLocationTypes,
    setSourceLocationTypes,
    destinationTypes,
    setDestinationTypes,
    validationErrors,
    isEditMode,
    clearForm,
    openEditModal,
    closeModal,
    updateFormField,
    updateSource,
    addSourceFilter,
    updateSourceFilter,
    removeSourceFilter,
    addDestination,
    updateDestination,
    removeDestination,
    handleSubmit,
    computeSourceName: (type: string, year: string, quarter: string, month: string, day: string) =>
      computeSourceName(type, year, quarter, month, day, sourceTypes),
  };
}
