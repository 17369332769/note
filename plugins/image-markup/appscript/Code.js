const ADDON_NAME = 'Image Markup';
const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp'
];

/**
 * Adds the Editor add-on menu under Extensions.
 *
 * @param {Object=} event Editor open event.
 */
function onOpen(event) {
  const ui = getEditorUi_();
  if (!ui) return;

  ui.createAddonMenu()
    .addItem('Start', 'showImageMarkupDialog')
    .addToUi();
}

/**
 * Runs when the Editor add-on is installed.
 *
 * @param {Object=} event Editor install event.
 */
function onInstall(event) {
  onOpen(event);
}

/**
 * Opens the Image Markup editor from the Extensions menu.
 */
function showImageMarkupDialog() {
  const ui = getEditorUi_();
  if (!ui) {
    throw new Error('Open this add-on from Google Docs or Slides.');
  }

  const html = HtmlService.createHtmlOutputFromFile('Editor')
    .setTitle(ADDON_NAME);

  ui.showSidebar(html);
}

/**
 * Returns the active editor UI for Docs or Slides.
 *
 * @return {GoogleAppsScript.Base.Ui|null}
 */
function getEditorUi_() {
  const uiFactories = [
    function () { return DocumentApp.getUi(); },
    function () { return SlidesApp.getUi(); }
  ];

  for (let index = 0; index < uiFactories.length; index += 1) {
    try {
      return uiFactories[index]();
    } catch (error) {
      // Try the next host app.
    }
  }

  return null;
}

/**
 * Handles action exceptions without exposing stack traces in cards.
 *
 * @param {Error} error Error raised by an action.
 * @return {CardService.ActionResponse}
 */
function buildErrorResponse_(error) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(error.message || 'Something went wrong.'))
    .build();
}

/**
 * Returns the editor origin configured for this deployment.
 *
 * @return {string}
 */
function getEditorBaseUrl_() {
  const configured = PropertiesService.getScriptProperties().getProperty('EDITOR_BASE_URL');
  return configured || 'https://note-bice-seven.vercel.app';
}

/**
 * Creates a card navigation action response.
 *
 * @param {CardService.Card} card Card to show.
 * @return {CardService.ActionResponse}
 */
function navigateToCard_(card) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * Rebuilds the current card.
 *
 * @param {CardService.Card} card Card to update.
 * @return {CardService.ActionResponse}
 */
function updateCard_(card) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}

/**
 * Converts form input values into a plain map.
 *
 * @param {Object} event Workspace action event.
 * @return {Object<string, string>}
 */
function getFormValues_(event) {
  const inputs = event && event.commonEventObject && event.commonEventObject.formInputs
    ? event.commonEventObject.formInputs
    : {};
  const values = {};

  Object.keys(inputs).forEach(function (key) {
    const input = inputs[key];
    if (input && input.stringInputs && input.stringInputs.value && input.stringInputs.value.length) {
      values[key] = input.stringInputs.value[0];
    }
  });

  return values;
}

/**
 * Safely checks whether a MIME type is supported by the v1 editor.
 *
 * @param {string} mimeType MIME type.
 * @return {boolean}
 */
function isSupportedImageMimeType_(mimeType) {
  return SUPPORTED_IMAGE_MIME_TYPES.indexOf(String(mimeType || '').toLowerCase()) !== -1;
}
