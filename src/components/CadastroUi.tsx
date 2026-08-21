"use client";

import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Pencil, Trash2, X } from "lucide-react";

type CadastroRowActionsProps = {
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function CadastroRowActions({
  disabled,
  onEdit,
  onDelete,
}: CadastroRowActionsProps) {
  return (
    <div className="cadastro-row-actions">
      <button
        type="button"
        className="cadastro-btn-edit"
        onClick={onEdit}
        disabled={disabled}
        title="Editar"
      >
        <Pencil size={12} />
        Editar
      </button>
      <button
        type="button"
        className="cadastro-btn-delete"
        onClick={onDelete}
        disabled={disabled}
        title="Excluir"
      >
        <Trash2 size={12} />
        Excluir
      </button>
    </div>
  );
}

type CadastroModalProps = {
  title: string;
  titleId: string;
  subtitle?: ReactNode;
  onClose: () => void;
  disabled?: boolean;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
  asForm?: boolean;
  onSubmit?: (e: FormEvent) => void;
};

export function CadastroModal({
  title,
  titleId,
  subtitle,
  onClose,
  disabled,
  width = 440,
  children,
  footer,
  asForm,
  onSubmit,
}: CadastroModalProps) {
  const panelStyle: CSSProperties = {
    width: `min(${width}px, 100%)`,
  };

  const body = (
    <>
      <div className="cadastro-modal-header">
        <div>
          <h2 id={titleId} className="cadastro-modal-title">
            {title}
          </h2>
          {subtitle ? <div className="cadastro-modal-subtitle">{subtitle}</div> : null}
        </div>
        <button
          type="button"
          className="cadastro-modal-close"
          onClick={onClose}
          aria-label="Fechar"
          disabled={disabled}
        >
          <X size={16} />
        </button>
      </div>
      {children}
      {footer}
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="cadastro-modal-backdrop"
      onClick={onClose}
    >
      {asForm ? (
        <form
          className="cadastro-modal-panel"
          style={panelStyle}
          onClick={(e) => e.stopPropagation()}
          onSubmit={onSubmit}
        >
          {body}
        </form>
      ) : (
        <div
          className="cadastro-modal-panel"
          style={panelStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {body}
        </div>
      )}
    </div>
  );
}

export function CadastroField({
  label,
  htmlFor,
  children,
  span,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  span?: boolean | 2 | "full";
}) {
  const className =
    span === "full" || span === true
      ? "cadastro-field cadastro-field-full"
      : span === 2
        ? "cadastro-field cadastro-field-span-2"
        : "cadastro-field";

  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="cadastro-label">
        {label}
      </label>
      {children}
    </div>
  );
}

export function CadastroFormGrid({ children }: { children: ReactNode }) {
  return <div className="cadastro-form-grid">{children}</div>;
}

export function CadastroFormError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="cadastro-form-error">{message}</div>;
}

export function CadastroFormActions({
  onCancel,
  disabled,
  submitLabel = "Salvar",
  busyLabel = "Aguarde...",
  busy,
  danger,
  onConfirm,
}: {
  onCancel: () => void;
  disabled?: boolean;
  submitLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm?: () => void;
}) {
  return (
    <div className="cadastro-form-actions">
      <button
        type="button"
        className="cadastro-btn-secondary"
        onClick={onCancel}
        disabled={disabled}
      >
        Cancelar
      </button>
      {danger && onConfirm ? (
        <button
          type="button"
          className="cadastro-btn-danger"
          onClick={onConfirm}
          disabled={disabled}
        >
          {busy ? busyLabel : submitLabel}
        </button>
      ) : (
        <button type="submit" className="btn-primary btn-compact" disabled={disabled}>
          {busy ? busyLabel : submitLabel}
        </button>
      )}
    </div>
  );
}
