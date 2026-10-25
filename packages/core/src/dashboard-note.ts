/**
 * Appended when a step waits on a person. The team settles it on the dashboard; asking in the terminal would
 * split the decision across sessions and leave the dashboard stale.
 */
export const DASHBOARD_DECIDES =
  "A teammate settles this on the Little Brother dashboard, not in this terminal, so don't ask the user here. Work on other parts meanwhile; the decision arrives as a message, and then the step goes through.";
