<script lang="ts">
  import OutputView from '../output/OutputView.svelte';
</script>

<main id="main-content" class="main-panel">
  <OutputView />
</main>

<style>
  .main-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--bg-primary);
    min-width: 0;
  }
</style>
