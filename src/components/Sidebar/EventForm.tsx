// Event creation form with React Hook Form + Zod validation

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventSchema } from "../../schemas";
import { createEvent } from "../../db";
import type { z } from "zod";

interface EventFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type EventFormData = z.input<typeof eventSchema>;

export function EventForm({ onSuccess, onCancel }: EventFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      date: "",
      description: "",
      link: "",
      isTrigger: false,
    },
  });

  const onSubmit = async (data: EventFormData) => {
    await createEvent({
      title: data.title,
      date: data.date,
      description: data.description || "",
      link: data.link || "",
      isTrigger: data.isTrigger || false,
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="add-form">
      <input
        type="text"
        placeholder="Title..."
        className={`input ${errors.title ? "error" : ""}`}
        {...register("title")}
      />
      {errors.title && <span className="error-text">{errors.title.message}</span>}

      <input type="date" className={`input ${errors.date ? "error" : ""}`} {...register("date")} />
      {errors.date && <span className="error-text">{errors.date.message}</span>}

      <input
        type="url"
        placeholder="Link (https://...)"
        className={`input ${errors.link ? "error" : ""}`}
        {...register("link")}
      />
      {errors.link && <span className="error-text">{errors.link.message}</span>}

      <label className="checkbox-label">
        <input type="checkbox" {...register("isTrigger")} />
        Is a trigger
      </label>

      <div className="button-group">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add Event"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default EventForm;
