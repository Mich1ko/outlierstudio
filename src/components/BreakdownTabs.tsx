'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './icons';

const tabs = ['Write a script like this', 'Write hooks like this'];

export function BreakdownTabs({ onScript, onHooks }: { onScript: () => void; onHooks: () => void }) {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  function onKeyDown(event: KeyboardEvent) {
    let next = selected;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - selected;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    else return;
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  }
  return (
    <div className="breakdown-workflow">
      <div className="breakdown-tabs" role="tablist" aria-label="Create from this breakdown" onKeyDown={onKeyDown}>
        {tabs.map((label, index) => (
          <button type="button" role="tab" id={`${id}-tab-${index}`} key={label} ref={(element) => { buttons.current[index] = element; }} aria-selected={selected === index} aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)}>
            {index === 0 ? <Icon.scripts /> : <Icon.hooks />}{label}
          </button>
        ))}
      </div>
      {tabs.map((_, index) => (
        <div key={index} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={selected !== index} className="workflow-panel bg-surface-sunken" tabIndex={0}>
          <div><strong>{index === 0 ? 'Make the structure your own' : 'Find your next opening line'}</strong><p className="text-muted">{index === 0 ? 'Start a new script using this video as your reference.' : 'Explore new hooks using this video as your reference.'}</p></div>
          <button type="button" className="btn btn-primary" onClick={index === 0 ? onScript : onHooks}>{index === 0 ? 'Open script writer' : 'Open hook writer'}<Icon.external /></button>
        </div>
      ))}
    </div>
  );
}
