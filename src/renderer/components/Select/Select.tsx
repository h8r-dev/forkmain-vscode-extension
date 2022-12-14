import React, { useEffect, useRef } from "react";

interface ISelectProps {
  className?: string;
  value: string;
  onChange: (v: string) => void;
  options: {
    label: string;
    value: string;
  }[];
}

const Select: React.FC<ISelectProps> = (props) => {
  const { options, value, onChange, className } = props;
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (onChange) {
      const selectedIndex = e.target.options.selectedIndex;
      onChange(options[selectedIndex].value);
    }
  }
  const input = useRef<HTMLSelectElement>();

  useEffect(() => {
    if (input?.current) {
      input.current.value = value ?? "disabled";
    }
  }, [value]);

  return (
    <select
      ref={input}
      defaultValue={(options.length && value) || "disabled"}
      placeholder="select context"
      onChange={handleChange}
      className={className}
    >
      {options.length === 0 && (
        <option disabled value="disabled">
          select context
        </option>
      )}

      {options.map((it) => {
        return (
          <option key={it.value} value={it.value}>
            {it.label}
          </option>
        );
      })}
    </select>
  );
};

export default Select;
