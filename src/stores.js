// src/stores.js
import { writable } from 'svelte/store';

/**
 * Creates a persistent Svelte store that automatically saves to localStorage.
 * @param {string} key - The key used in localStorage.
 * @param {*} initialValue - The initial value if nothing is stored.
 */
function persistentWritable(key, initialValue) {
  let storedValue;
  try {
    storedValue = localStorage.getItem(key);
  } catch (e) {
    console.warn('Local storage not available', e);
  }
  
  const parsed = storedValue !== null ? JSON.parse(storedValue) : initialValue;
  const store = writable(parsed);
  
  store.subscribe(value => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Could not save state', e);
    }
  });
  
  return store;
}

/**
 * A special persistent store for a Set.
 * Stored in localStorage as an array.
 * @param {string} key - The key used in localStorage.
 * @param {Set} initialSet - The initial Set if nothing is stored.
 */
function persistentSet(key, initialSet) {
  let storedValue;
  try {
    storedValue = localStorage.getItem(key);
  } catch (e) {
    console.warn('Local storage not available', e);
  }

  // If there is a stored value, parse it as an array and create a new Set
  const parsed = storedValue !== null ? new Set(JSON.parse(storedValue)) : initialSet;
  const { subscribe, set, update } = writable(parsed);
  
  subscribe(value => {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(value)));
    } catch (e) {
      console.warn('Could not save state', e);
    }
  });
  
  return { subscribe, set, update };
}

/**
 * A special persistent store for a Map.
 * Stored in localStorage as an array of [key, value] pairs.
 * @param {string} key - The key used in localStorage.
 * @param {Map} initialMap - The initial Map if nothing is stored.
 */
function persistentMap(key, initialMap) {
  let storedValue;
  try {
    storedValue = localStorage.getItem(key);
  } catch (e) {
    console.warn('Local storage not available', e);
  }

  // If there is a stored value, parse it as an array and create a new Map
  const parsed = storedValue !== null ? new Map(JSON.parse(storedValue)) : initialMap;
  const { subscribe, set, update } = writable(parsed);

  subscribe(value => {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(value)));
    } catch (e) {
      console.warn('Could not save state', e);
    }
  });

  return { subscribe, set, update };
}

// Use the persistent stores instead of plain writables.
export const cameraX = persistentWritable('cameraX', 0);
export const cameraY = persistentWritable('cameraY', 0);
export const scale   = persistentWritable('scale', 1);

// Store selectedSegments as a set.
export const selectedSegments = persistentSet('selectedSegments', new Set());

// Store segment colors as a map (segment key -> color)
export const segmentColors = persistentMap('segmentColors', new Map());

// Current selected color for new selections
export const currentColor = persistentWritable('currentColor', '#f33');
