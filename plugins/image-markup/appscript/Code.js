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
    .addItem('Help', 'showImageMarkupHelp')
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
 * Opens Image Markup help from the Extensions menu.
 */
function showImageMarkupHelp() {
  const ui = getEditorUi_();
  if (!ui) {
    throw new Error('Open Image Markup from Google Docs.');
  }

  ui.showModalDialog(buildHelpHtml_(), ADDON_NAME + ' Help');
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
 * Builds the help dialog.
 *
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function buildHelpHtml_() {
  return HtmlService
    .createHtmlOutput([
      '<!doctype html>',
      '<html><head><base target="_top"><meta charset="utf-8">',
      '<style>',
      'body{box-sizing:border-box;margin:0;padding:20px;font:14px/1.55 Arial,"Microsoft YaHei",sans-serif;color:#1f2937;background:#fff;}',
      'h1{margin:0 0 12px;font-size:20px;line-height:1.25;}',
      'h2{margin:18px 0 8px;font-size:14px;}',
      'ol,ul{margin:8px 0 0 20px;padding:0;}',
      'li{margin:6px 0;}',
      '.note{margin-top:14px;padding:10px 12px;border:1px solid #dbeafe;border-radius:8px;background:#eff6ff;color:#1e40af;}',
      '</style></head><body>',
      '<h1>Image Markup Help</h1>',
      '<h2>Document image</h2>',
      '<ol>',
      '<li>Select an inline image in the Google Doc.</li>',
      '<li>Open Image Markup and click <strong>Select image</strong>.</li>',
      '<li>After the preview appears, click <strong>Edit</strong>.</li>',
      '</ol>',
      '<h2>In the editor</h2>',
      '<ul>',
      '<li>Use arrows, boxes, freehand marks, and notes to describe the change.</li>',
      '<li>Click <strong>Generate</strong> to create a clean revision.</li>',
      '<li>Click <strong>Download canvas PNG</strong> to export the full canvas.</li>',
      '</ul>',
      '<h2>Upload</h2>',
      '<p>Use the Upload tab for PNG, JPEG, or WebP files that are not already in the document.</p>',
      '<div class="note">If Select image does not find anything, click directly on an inline image in the Doc and try again.</div>',
      '</body></html>'
    ].join(''))
    .setWidth(460)
    .setHeight(430);
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

  return getEditorBaseUrl_().replace(/\/+$/, '') + '/image-markup/editor?' + query.join('&');
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
