/** Background Service Worker
 * 
 * The brains of our operation currently does only one thing:
 * 
 * 1. When a Chrome user clicks on our panel in the extensions tab,
 *    it opens our side panel.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});