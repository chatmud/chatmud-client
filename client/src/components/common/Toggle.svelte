<script lang="ts">
  let {
    checked,
    onchange,
    label,
    disabled = false,
  } = $props<{
    checked: boolean;
    onchange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
  }>();

  const id = `toggle-${Math.random().toString(36).slice(2, 9)}`;

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    onchange(target.checked);
  }
</script>

<label class="toggle" for={id}>
  <input
    {id}
    type="checkbox"
    role="switch"
    {checked}
    {disabled}
    onchange={handleChange}
    class="toggle-input"
  />
  <span class="toggle-track" aria-hidden="true">
    <span class="toggle-thumb"></span>
  </span>
  <span class="toggle-label">{label}</span>
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .toggle:has(.toggle-input:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .toggle-track {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    background-color: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    transition: background-color var(--transition-speed);
  }

  .toggle-input:checked + .toggle-track {
    background-color: var(--accent);
    border-color: var(--accent);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background-color: var(--text-primary);
    border-radius: 50%;
    transition: transform var(--transition-speed);
  }

  .toggle-input:checked + .toggle-track .toggle-thumb {
    transform: translateX(16px);
    background-color: #ffffff;
  }

  .toggle-input:focus-visible + .toggle-track {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: 1px;
  }

  .toggle-label {
    color: var(--text-primary);
    font-size: var(--font-size);
  }
</style>
