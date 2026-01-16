import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface DebouncedQuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  className?: string;
}

export function DebouncedQuantityInput({ 
  value, 
  onChange, 
  min = 1,
  className 
}: DebouncedQuantityInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  // Sync local value when external value changes (e.g., SKU change)
  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    const numValue = parseInt(localValue) || 0;
    const finalValue = numValue < min ? min : numValue;
    setLocalValue(finalValue.toString());
    onChange(finalValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <Input
      type="number"
      min={min}
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
}
