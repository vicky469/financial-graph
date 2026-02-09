import { useState } from "react";
import styles from "./LandingPage.module.css";

const DATA_INTERESTS = [
  "SEC Filings",
  "Corporate Subsidiaries",
  "Brand-to-Entity Mapping",
  "Custom Data Extraction",
];

interface FormData {
  name: string;
  email: string;
  linkedinUrl: string;
  company: string;
  dataInterests: string[];
  requirements: string;
}

const INITIAL_FORM: FormData = {
  name: "",
  email: "",
  linkedinUrl: "",
  company: "",
  dataInterests: [],
  requirements: "",
};

export function ContactForm() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleInterest = (interest: string) => {
    setForm((prev) => ({
      ...prev,
      dataInterests: prev.dataInterests.includes(interest)
        ? prev.dataInterests.filter((i) => i !== interest)
        : [...prev.dataInterests, interest],
    }));
  };

  const submitForm = async () => {
    setSubmitError(null);

    if (!form.name.trim() || !form.email.trim()) {
      setSubmitError("Please fill in your name and email.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to submit form.");
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  if (submitted) {
    return (
      <div className={styles.contactFormSuccess}>
        <div className={styles.successIcon}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(52, 211, 153, 0.8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h3 className={styles.successTitle}>Thank you!</h3>
        <p className={styles.successText}>
          We&apos;ll review your interests and get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form className={styles.contactForm} onSubmit={handleSubmit}>
      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Name *</label>
          <input
            type="text"
            required
            className={styles.formInput}
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Email *</label>
          <input
            type="email"
            required
            className={styles.formInput}
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>LinkedIn Profile</label>
          <input
            type="url"
            className={styles.formInput}
            placeholder="https://linkedin.com/in/yourprofile"
            value={form.linkedinUrl}
            onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
          />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Company</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="Your organization"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Financial Data Interests</label>
        <div className={styles.interestChips}>
          {DATA_INTERESTS.map((interest) => (
            <button
              key={interest}
              type="button"
              className={`${styles.interestChip} ${
                form.dataInterests.includes(interest) ? styles.interestChipActive : ""
              }`}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Requirements / Use Case</label>
        <textarea
          className={styles.formTextarea}
          placeholder="Describe what you're looking for — specific companies, data points, integrations, or research goals..."
          rows={4}
          value={form.requirements}
          onChange={(e) => setForm({ ...form, requirements: e.target.value })}
        />
      </div>

      {submitError && (
        <div className={styles.errorMessage}>
          <p className={styles.errorText}>{submitError}</p>
        </div>
      )}

      <button type="submit" disabled={submitting} className={styles.submitButton}>
        {submitting ? (
          <>
            <span className={styles.submitSpinner} />
            Submitting...
          </>
        ) : (
          "Submit Interest"
        )}
      </button>
    </form>
  );
}
