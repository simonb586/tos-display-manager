import React from 'react';

export default function DisplayInheritanceChoice({
  legend,
  name,
  value,
  onChange,
  disabled,
  descriptionId,
  labels = ['Hériter', 'Afficher', 'Masquer']
}) {
  const values = [null, true, false];
  return <fieldset className="field-display-choice" disabled={disabled} aria-describedby={descriptionId}>
    <legend>{legend}</legend>
    <div>
      {values.map((item, index) => <label key={labels[index]}>
        <input
          type="radio"
          name={name}
          checked={value === item}
          onChange={() => onChange(item)}
        />
        <span>{labels[index]}</span>
      </label>)}
    </div>
  </fieldset>;
}
