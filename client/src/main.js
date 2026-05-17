// Entry point.
import { showTitle } from './phases.js';
import { startServerStatus } from './serverStatus.js';

window.addEventListener('DOMContentLoaded', () => {
  startServerStatus();
  showTitle();
});
