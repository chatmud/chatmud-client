<script lang="ts">
  let {
    value,
    onchange,
    options,
    label,
  } = $props<{
    value: string;
    onchange: (value: string) => void;
    options: { value: string; label: string }[];
    label: string;
  }>();

  const id = `select-${Math.random().toString(36).slice(2, 9)}`;

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    onchange(target.value);
  }
</script>

<div class="select-group">
  <label class="select-label" for={id}>{label}</label>
  <select
    {id}
    class="select-input"
    {value}
    onchange={handleChange}
  >
    {#each options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</div>

<style>
  .select-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .select-label {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .select-input {
    padding: 6px 8px;
    background-color: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: var(--font-family);
    font-size: var(--font-size);
    cursor: pointer;
    appearance: auto;
  }

  .select-input:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: 1px;
  }
</style>
