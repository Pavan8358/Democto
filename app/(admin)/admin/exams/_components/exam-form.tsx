"use client";

import { useTransition, type CSSProperties } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExamStatus } from "@prisma/client";
import { toast } from "sonner";

import type { ActionResult } from "../actions";
import {
  examDefaultValues,
  examFormSchema,
  type ExamFormValues
} from "@/lib/exams/validation";

type CreateExamFormProps = {
  mode: "create";
  onSubmit: (values: ExamFormValues) => Promise<ActionResult<{ id: string }>>;
};

type EditExamFormProps = {
  mode: "edit";
  examId: string;
  initialValues: ExamFormValues;
  onSubmit: (values: ExamFormValues & { id: string }) => Promise<ActionResult<{ id: string }>>;
  onDelete?: (examId: string) => Promise<ActionResult<{ id: string }>>;
  onClose?: () => void;
};

type ExamFormProps = CreateExamFormProps | EditExamFormProps;

const statusLabels: Record<ExamStatus, string> = {
  [ExamStatus.DRAFT]: "Draft",
  [ExamStatus.ACTIVE]: "Active",
  [ExamStatus.ARCHIVED]: "Archived"
};

export function ExamForm(props: ExamFormProps) {
  const isEditMode = props.mode === "edit";
  const defaultValues = isEditMode ? props.initialValues : examDefaultValues;

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues
  });

  const {
    handleSubmit,
    register,
    reset,
    setError,
    clearErrors,
    formState: { errors }
  } = form;

  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const submitLabel = isEditMode ? "Save changes" : "Create exam";
  const submittingLabel = isEditMode ? "Saving..." : "Creating...";

  const onSubmit = handleSubmit((values) => {
    clearErrors("root");

    startSubmitTransition(async () => {
      const result = isEditMode
        ? await props.onSubmit({ ...values, id: props.examId })
        : await props.onSubmit(values);

      if (result.success) {
        toast.success(isEditMode ? "Exam updated" : "Exam created");

        if (isEditMode) {
          reset(values);
          props.onClose?.();
        } else {
          reset(examDefaultValues);
        }

        return;
      }

      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([key, messages]) => {
          const message = messages[0];
          if (!message) return;

          if (key in defaultValues) {
            setError(key as keyof ExamFormValues, { type: "server", message });
          }
        });
      }

      setError("root", { type: "server", message: result.message });
      toast.error(result.message);
    });
  });

  const handleDelete = () => {
    if (!isEditMode || !props.onDelete) {
      return;
    }

    const confirmed = window.confirm("Are you sure you want to delete this exam? This action cannot be undone.");

    if (!confirmed) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await props.onDelete?.(props.examId);

      if (result?.success) {
        toast.success("Exam deleted");
        props.onClose?.();
        return;
      }

      if (result) {
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label htmlFor="title" style={{ fontWeight: 600 }}>
          Title
        </label>
        <input
          id="title"
          type="text"
          {...register("title")}
          placeholder="e.g. Remote Accounting Certification"
          disabled={isSubmitting}
          style={inputStyles(errors.title)}
        />
        {errors.title && <FieldError message={errors.title.message} />}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label htmlFor="description" style={{ fontWeight: 600 }}>
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          {...register("description")}
          placeholder="Short summary for internal administrators"
          disabled={isSubmitting}
          style={textareaStyles(errors.description)}
        />
        {errors.description && <FieldError message={errors.description.message} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label htmlFor="durationMinutes" style={{ fontWeight: 600 }}>
            Duration (minutes)
          </label>
          <input
            id="durationMinutes"
            type="number"
            min={5}
            max={480}
            step={5}
            {...register("durationMinutes", { valueAsNumber: true })}
            disabled={isSubmitting}
            style={inputStyles(errors.durationMinutes)}
          />
          {errors.durationMinutes && <FieldError message={errors.durationMinutes.message} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label htmlFor="retentionDays" style={{ fontWeight: 600 }}>
            Retention (days)
          </label>
          <input
            id="retentionDays"
            type="number"
            min={30}
            max={3650}
            step={1}
            {...register("retentionDays", { valueAsNumber: true })}
            disabled={isSubmitting}
            style={inputStyles(errors.retentionDays)}
          />
          {errors.retentionDays && <FieldError message={errors.retentionDays.message} />}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label htmlFor="status" style={{ fontWeight: 600 }}>
          Status
        </label>
        <select id="status" {...register("status")} disabled={isSubmitting} style={inputStyles(errors.status)}>
          {Object.values(ExamStatus).map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        {errors.status && <FieldError message={errors.status.message} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
        <CheckboxField
          id="requiresScreenShare"
          label="Requires screen share"
          description="Collect and stream the candidate's screen during the exam."
          register={register("requiresScreenShare")}
          disabled={isSubmitting}
        />
        <CheckboxField
          id="requiresIdCapture"
          label="Requires ID capture"
          description="Capture and verify a government ID before the exam begins."
          register={register("requiresIdCapture")}
          disabled={isSubmitting}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label htmlFor="instructions" style={{ fontWeight: 600 }}>
          Candidate instructions
        </label>
        <textarea
          id="instructions"
          rows={5}
          {...register("instructions")}
          placeholder="Provide setup expectations, rules, and escalation details for candidates."
          disabled={isSubmitting}
          style={textareaStyles(errors.instructions)}
        />
        {errors.instructions && <FieldError message={errors.instructions.message} />}
      </div>

      {errors.root && (
        <div style={{ color: "#b91c1c", fontWeight: 600 }}>{errors.root.message}</div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: "0.6rem 1.25rem",
            borderRadius: "0.75rem",
            border: "none",
            backgroundColor: "#111827",
            color: "white",
            fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer"
          }}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>

        {isEditMode && props.onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isSubmitting}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "0.75rem",
              border: "1px solid #ef4444",
              backgroundColor: "white",
              color: "#b91c1c",
              fontWeight: 600,
              cursor: isDeleting ? "not-allowed" : "pointer"
            }}
          >
            {isDeleting ? "Deleting..." : "Delete exam"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

type FieldErrorProps = {
  message?: string;
};

function FieldError({ message }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return <span style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{message}</span>;
}

type CheckboxFieldProps = {
  id: string;
  label: string;
  description: string;
  disabled: boolean;
  registration: UseFormRegisterReturn;
};

function CheckboxField({ id, label, description, disabled, registration }: CheckboxFieldProps) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        padding: "1rem",
        borderRadius: "0.85rem",
        border: "1px solid #e5e7eb",
        backgroundColor: "#f9fafb",
        cursor: disabled ? "not-allowed" : "pointer"
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input type="checkbox" id={id} {...registration} disabled={disabled} />
        <strong>{label}</strong>
      </span>
      <span style={{ fontSize: "0.85rem", color: "#4b5563" }}>{description}</span>
    </label>
  );
}

function inputStyles(error: unknown): CSSProperties {
  return {
    padding: "0.6rem 0.8rem",
    borderRadius: "0.75rem",
    border: `1px solid ${error ? "#ef4444" : "#d1d5db"}`,
    backgroundColor: "white",
    fontSize: "1rem"
  };
}

function textareaStyles(error: unknown): CSSProperties {
  return {
    padding: "0.6rem 0.8rem",
    borderRadius: "0.75rem",
    border: `1px solid ${error ? "#ef4444" : "#d1d5db"}`,
    backgroundColor: "white",
    fontSize: "1rem",
    resize: "vertical"
  };
}
