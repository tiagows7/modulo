"use client";

import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CircleAlert, Pencil, Trash2, X } from "lucide-react";

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
    <div className="cadastro-row-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="cadastro-btn-edit"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit();
        }}
        disabled={disabled}
        title="Editar"
      >
        <Pencil size={12} />
        Editar
      </button>
      <button
        type="button"
        className="cadastro-btn-delete"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        disabled={disabled}
        title="Excluir"
      >
        <Trash2 size={12} />
        Excluir
      </button>
    </div>
  );
}

function usePortalTarget() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.body);
  }, []);
  return target;
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
  const portalTarget = usePortalTarget();
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

  const dialog = (
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

  if (!portalTarget) return null;
  return createPortal(dialog, portalTarget);
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

export type CadastroMessageType = "error" | "warning";

type CadastroMessageDialogProps = {
  type?: CadastroMessageType;
  title?: string;
  message: string;
  onClose: () => void;
  confirmLabel?: string;
};

/** Mensagem padronizada na frente da tela (alerta / erro). */
export function CadastroMessageDialog({
  type = "error",
  title,
  message,
  onClose,
  confirmLabel = "OK",
}: CadastroMessageDialogProps) {
  const portalTarget = usePortalTarget();
  if (!message) return null;

  const isWarning = type === "warning";
  const resolvedTitle = title ?? (isWarning ? "Atenção" : "Erro");
  const Icon = isWarning ? AlertTriangle : CircleAlert;

  const dialog = (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cadastro-message-title"
      aria-describedby="cadastro-message-body"
      className={`cadastro-message-backdrop cadastro-message-${type}`}
      onClick={onClose}
    >
      <div
        className="cadastro-message-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`cadastro-message-icon cadastro-message-icon-${type}`}>
          <Icon size={22} strokeWidth={2.2} />
        </div>
        <div className="cadastro-message-content">
          <h2 id="cadastro-message-title" className="cadastro-message-title">
            {resolvedTitle}
          </h2>
          <p id="cadastro-message-body" className="cadastro-message-text">
            {message}
          </p>
        </div>
        <div className="cadastro-message-actions">
          <button
            type="button"
            className={`cadastro-message-btn cadastro-message-btn-${type}`}
            onClick={onClose}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (!portalTarget) return null;
  return createPortal(dialog, portalTarget);
}

/** Atalho para erro/aviso com o layout padrão na frente da tela. */
export function CadastroFormError({
  message,
  onClose,
  type = "error",
  title,
}: {
  message: string;
  onClose: () => void;
  type?: CadastroMessageType;
  title?: string;
}) {
  if (!message) return null;
  return (
    <CadastroMessageDialog
      type={type}
      title={title}
      message={message}
      onClose={onClose}
    />
  );
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
