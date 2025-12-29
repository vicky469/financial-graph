// Entity creation form with React Hook Form + Zod validation

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { entitySchema, type EntityFormData } from "../../schemas";
import { createEntity } from "../../db";

interface EntityFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function EntityForm({ onSuccess, onCancel }: EntityFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema),
    defaultValues: {
      name: "",
      type: "",
    },
  });

  const onSubmit = async (data: EntityFormData) => {
    await createEntity({ ...data, properties: {} });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="add-form">
      <input
        type="text"
        placeholder="Name (e.g. SVB)"
        className={`input ${errors.name ? "error" : ""}`}
        {...register("name")}
      />
      {errors.name && <span className="error-text">{errors.name.message}</span>}

      <input
        type="text"
        placeholder="Type (e.g. Bank)"
        className={`input ${errors.type ? "error" : ""}`}
        {...register("type")}
      />
      {errors.type && <span className="error-text">{errors.type.message}</span>}

      <div className="button-group">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add Entity"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default EntityForm;
