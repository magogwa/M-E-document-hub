import { useState, type FormEvent, type ReactNode } from 'react';
import { FileText } from 'lucide-react';

export function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800">
      <div className="m-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">M&E Document Hub</h1>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
  );
}

export function InfoAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>
  );
}

export function SpinnerButton({ submitting, label, submittingLabel, icon }: { submitting: boolean; label: string; submittingLabel?: string; icon?: ReactNode }) {
  return (
    <button type="submit" disabled={submitting} className="btn-primary w-full">
      {submitting ? <span className="inline-flex items-center gap-2">{submittingLabel ?? 'Working…'}</span> : (
        <span className="inline-flex items-center gap-2">{icon}{label}</span>
      )}
    </button>
  );
}