const ADDON_NAME = 'Image Markup';
const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
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
    .addItem('Start', 'showImageMarkupSidebar')
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
 * Opens the Image Markup launcher sidebar from the Extensions menu.
 */
function showImageMarkupSidebar() {
  const ui = getEditorUi_();
  if (!ui) {
    throw new Error('Open Image Markup from Google Docs.');
  }

  ui.showSidebar(buildLauncherSidebarHtml_());
}

/**
 * Backward-compatible menu entry for older deployments.
 */
function showImageMarkupDialog() {
  showImageMarkupSidebar();
}

/**
 * Opens the full editor in a Docs dialog.
 *
 * @param {Object=} params Editor query parameters.
 */
function openImageMarkupEditorDialog(params) {
  const ui = getEditorUi_();
  if (!ui) {
    throw new Error('Open Image Markup from Google Docs.');
  }

  const html = buildEditorHtml_(Object.assign({ apptype: 'addon' }, params || {}))
    .setWidth(1180)
    .setHeight(760);

  ui.showModalDialog(html, ADDON_NAME);
}

/**
 * Opens the default full editor dialog from HtmlService callbacks.
 */
function openDefaultImageMarkupEditorDialog() {
  openImageMarkupEditorDialog({ apptype: 'addon' });
}

/**
 * Opens a prepared editor session from the launcher sidebar.
 *
 * @param {string} sessionId Prepared session ID.
 */
function openPreparedImageMarkupEditorDialog(sessionId) {
  const session = getSession_(sessionId);
  if (!session) {
    throw new Error('This editing session is no longer available. Please choose or upload the image again.');
  }

  openImageMarkupEditorDialog({
    sessionId: session.id,
    sessionToken: session.accessToken,
    sourceLabel: session.source && (session.source.originalFilename || session.source.filename || session.source.label),
    apptype: 'addon',
    localUpload: session.source && session.source.type === 'local-upload' ? 1 : 0
  });
}

/**
 * Builds the lightweight launcher sidebar.
 *
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function buildLauncherSidebarHtml_() {
  const template = HtmlService.createTemplateFromFile('Sidebar');
  template.sidebarUrl = buildHostedSidebarUrl_();

  return template
    .evaluate()
    .setTitle(ADDON_NAME);
}

/**
 * Builds the lightweight HtmlService shell that loads the deployed editor.
 *
 * @param {Object=} params Editor query parameters.
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function buildEditorHtml_(params) {
  const template = HtmlService.createTemplateFromFile('Dialog');
  template.editorUrl = buildHostedEditorUrl_(params || {});

  return template
    .evaluate()
    .setTitle(ADDON_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Builds a hosted editor URL without depending on compiled Next.js assets.
 *
 * @param {Object} params Editor query parameters.
 * @return {string}
 */
function buildHostedEditorUrl_(params) {
  const query = [];
  const appType = normalizePluginAppType_(params.apptype || params.appType);

  query.push('apptype=' + encodeURIComponent(appType));
  query.push('bridge=1');

  if (params.sessionId) query.push('sessionId=' + encodeURIComponent(params.sessionId));
  if (params.sessionToken) query.push('sessionToken=' + encodeURIComponent(params.sessionToken));
  if (params.sourceLabel) query.push('sourceLabel=' + encodeURIComponent(params.sourceLabel));
  if (params.localUpload === '1' || params.localUpload === 1 || params.localUpload === true) {
    query.push('localUpload=1');
  }

  return getEditorBaseUrl_().replace(/\/+$/, '') + '/image-markup?' + query.join('&');
}

/**
 * Builds the hosted sidebar URL for the HtmlService launcher iframe.
 *
 * @return {string}
 */
function buildHostedSidebarUrl_() {
  return getEditorBaseUrl_().replace(/\/+$/, '') + '/image-markup/sidebar?apptype=addon&bridge=1';
}

/**
 * Returns the active Google Docs UI.
 *
 * @return {GoogleAppsScript.Base.Ui|null}
 */
function getEditorUi_() {
  try {
    return DocumentApp.getUi();
  } catch (error) {
    return null;
  }
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
