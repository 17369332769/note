const SESSION_STORE_KEY = 'annotationSessions';
const ANONYMOUS_USER_KEY = 'anonymousUserKey';
const SESSION_TTL_HOURS = 24;
const SESSION_LIST_LIMIT = 20;

/**
 * Creates a session and returns editor metadata.
 *
 * @param {string} host Host key.
 * @param {Object} source ImageSource.
 * @return {Object}
 */
function createSessionForSource_(host, source) {
  const sourceLabel = source.filename || source.label || 'workspace-image';
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  const tokenPayload = createHostedSessionToken_(id, host, source, sourceLabel);
  const accessToken = tokenPayload.sessionToken;
  const session = {
    id: id,
    accessToken: accessToken,
    accessTokenExpiresAt: tokenPayload.expiresAt,
    userKey: getAnonymousUserKey_(),
    host: host,
    source: source,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    editorUrl: buildHostedEditorUrl_({
      sessionId: id,
      sessionToken: accessToken,
      sourceLabel: sourceLabel,
      apptype: getPluginAppTypeForHost_(host),
      localUpload: source.type === 'local-upload' ? 1 : 0
    })
  };

  saveSession_(session);
  return session;
}

/**
 * Exchanges a trusted Apps Script session for a hosted editor token.
 *
 * @param {string} sessionId Session ID.
 * @param {string} host Host key.
 * @param {Object} source Image source.
 * @param {string} sourceLabel User-facing source label.
 * @return {{sessionToken:string,expiresAt:string}}
 */
function createHostedSessionToken_(sessionId, host, source, sourceLabel) {
  const exchangeSecret = PropertiesService.getScriptProperties().getProperty('IMAGE_MARKUP_SESSION_EXCHANGE_SECRET');
  if (!exchangeSecret) {
    throw new Error('IMAGE_MARKUP_SESSION_EXCHANGE_SECRET is not configured in Apps Script properties.');
  }

  const response = UrlFetchApp.fetch(getEditorBaseUrl_().replace(/\/+$/, '') + '/api/image-markup/session-token', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-image-markup-exchange-secret': exchangeSecret
    },
    payload: JSON.stringify({
      sessionId: sessionId,
      documentId: source && source.documentId ? String(source.documentId) : '',
      sourceType: source && source.type ? String(source.type) : host,
      sourceHash: buildSourceHash_(source),
      sourceLabel: sourceLabel,
      expiresInSeconds: 7200
    }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const json = JSON.parse(response.getContentText() || '{}');
  if (status < 200 || status >= 300 || !json.ok || !json.sessionToken) {
    throw new Error(json.error || 'Could not create editing session token.');
  }
  return {
    sessionToken: String(json.sessionToken),
    expiresAt: json.expiresAt ? String(json.expiresAt) : ''
  };
}

/**
 * Builds a stable non-secret source fingerprint for token metadata.
 *
 * @param {Object} source Image source.
 * @return {string}
 */
function buildSourceHash_(source) {
  const raw = JSON.stringify({
    type: source && source.type || '',
    documentId: source && source.documentId || '',
    imageIndex: source && source.imageIndex !== undefined ? source.imageIndex : '',
    r2Key: source && source.r2Key || '',
    width: source && source.width || '',
    height: source && source.height || '',
    size: source && source.size || ''
  });
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest);
}

/**
 * Loads the source image blob for any supported host.
 *
 * @param {string} host Host.
 * @param {Object} source ImageSource.
 * @return {Blob}
 */
function getSourceImageBlob_(host, source) {
  if (source.type === 'docs-inline-image') return getDocsImageBlob_(source);
  if (source.type === 'local-upload') throw new Error('Upload the image in the editor before saving.');
  if (host === 'docs') return getDocsImageBlob_(source);
  throw new Error('Image Markup currently supports Google Docs images only.');
}

/**
 * Maps Workspace host keys into the plugin environment model.
 *
 * @param {string} host Workspace host key.
 * @return {string}
 */
function getPluginAppTypeForHost_(host) {
  return 'addon';
}

/**
 * Normalizes external app type values.
 *
 * @param {string=} appType Plugin app type.
 * @return {string}
 */
function normalizePluginAppType_(appType) {
  return 'addon';
}

/**
 * Saves a session in user properties.
 *
 * @param {Object} session AnnotationSession.
 */
function saveSession_(session) {
  const sessions = listSessions_().filter(function (item) {
    return item.id !== session.id;
  });
  sessions.unshift(session);

  PropertiesService.getUserProperties().setProperty(SESSION_STORE_KEY, JSON.stringify(sessions.slice(0, SESSION_LIST_LIMIT)));
}

/**
 * Returns all stored sessions for the current user.
 *
 * @return {Array<Object>}
 */
function listSessions_() {
  const raw = PropertiesService.getUserProperties().getProperty(SESSION_STORE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function (session) {
      return !session.expiresAt || new Date(session.expiresAt).getTime() >= Date.now();
    });
  } catch (error) {
    return [];
  }
}

/**
 * Returns recent sessions.
 *
 * @return {Array<Object>}
 */
function listRecentSessions_() {
  return listSessions_().slice(0, 10);
}

/**
 * Loads a session by ID.
 *
 * @param {string} sessionId Session ID.
 * @return {Object|null}
 */
function getSession_(sessionId) {
  const sessions = listSessions_();
  for (let index = 0; index < sessions.length; index += 1) {
    if (sessions[index].id === sessionId) return sessions[index];
  }
  return null;
}

/**
 * Loads a session or throws.
 *
 * @param {Object} event Workspace action event.
 * @return {Object}
 */
function requireSessionFromEvent_(event) {
  const parameters = event && event.parameters ? event.parameters : {};
  const session = getSession_(parameters.sessionId);
  if (!session) {
    throw new Error('This editing session is no longer available. Please start again.');
  }
  return session;
}

/**
 * Returns a per-user anonymous key without requesting email scopes.
 *
 * @return {string}
 */
function getAnonymousUserKey_() {
  const properties = PropertiesService.getUserProperties();
  const existing = properties.getProperty(ANONYMOUS_USER_KEY);
  if (existing) return existing;

  const created = Utilities.getUuid();
  properties.setProperty(ANONYMOUS_USER_KEY, created);
  return created;
}
