<script>
  import HexCanvas from './HexCanvas.svelte';

  function clearSavedState() {
    localStorage.clear();
    location.reload(); // Reload to get initial state back
  }
</script>



<main style="position: fixed; inset: 0; overflow: hidden;">
  <HexCanvas />
  <button style="position: fixed; top: 10px; right: 10px; color:white" on:click={clearSavedState}>
    Clear Saved State
  </button>
</main>