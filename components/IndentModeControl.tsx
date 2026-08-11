import React from 'react';
import type { ReaderIndentMode } from '../types';

interface IndentModeControlProps {
  mode: ReaderIndentMode;
  onChange: (mode: ReaderIndentMode) => void;
  name: string;
  note: string;
}

export const IndentModeControl: React.FC<IndentModeControlProps> = ({ mode, onChange, name, note }) => (
  <fieldset className="indent-mode-control" data-testid="indent-mode-control">
    <legend>本文表示</legend>
    <label>
      <input
        type="radio"
        name={name}
        value="none"
        checked={mode === 'none'}
        onChange={() => onChange('none')}
      />
      自動字下げなし
    </label>
    <label>
      <input
        type="radio"
        name={name}
        value="jisage"
        checked={mode === 'jisage'}
        onChange={() => onChange('jisage')}
      />
      自動字下げあり
    </label>
    <span className="indent-mode-note">{note}</span>
  </fieldset>
);
