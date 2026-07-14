import React from 'react';
import { inferInputType } from '../services/universalEditorService';

export default function EditableField({
  column,
  value,
  onChange,
  disabled = false,
  compact = false
}) {
  const type = inferInputType(value, column);

  if (type === 'boolean') {
    return (
      <select
        className={compact ? 'universal-input compact' : 'universal-input'}
        value={value === true ? 'true' : value === false ? 'false' : ''}
        disabled={disabled}
        onChange={event => {
          const next = event.target.value;
          onChange(next === '' ? null : next === 'true');
        }}
      >
        <option value="">—</option>
        <option value="true">Vrai</option>
        <option value="false">Faux</option>
      </select>
    );
  }

  if (type === 'textarea' && !compact) {
    return (
      <textarea
        className="universal-input"
        rows="4"
        value={value ?? ''}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className={compact ? 'universal-input compact' : 'universal-input'}
      type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
      value={
        type === 'date' && value
          ? String(value).slice(0, 10)
          : value ?? ''
      }
      disabled={disabled}
      onChange={event => onChange(
        type === 'number' && event.target.value !== ''
          ? Number(event.target.value)
          : event.target.value
      )}
    />
  );
}
