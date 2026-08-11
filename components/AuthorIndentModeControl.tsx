import React from 'react';
import type { AuthorIndentMode } from '../types';

interface AuthorIndentModeControlProps {
  mode: AuthorIndentMode;
  onChange: (mode: AuthorIndentMode) => void;
  name: string;
  note: string;
}

export const AuthorIndentModeControl: React.FC<AuthorIndentModeControlProps> = ({ mode, onChange, name, note }) => (
  <fieldset className="indent-mode-control author-indent-mode-control" data-testid="author-indent-mode-control">
    <legend>本文の字下げ</legend>
    <label>
      <input
        type="radio"
        name={name}
        value="none"
        checked={mode !== 'jisage'}
        onChange={() => onChange('none')}
      />
      自動字下げなし（手動空白は保持）
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
