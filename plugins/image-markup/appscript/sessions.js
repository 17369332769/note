const SESSION_STORE_KEY = 'annotationSessions';
const SESSION_RECORD_PREFIX = 'annotationSession:';
const ANONYMOUS_USER_KEY = 'anonymousUserKey';
const SESSION_TTL_HOURS = 24;

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
  const session = {
    id: id,
    userKey: getAnonymousUserKey_(),
    host: host,
    source: source,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    editorUrl: buildHostedEditorUrl_({
      sessionId: id,
      sourceLabel: sourceLabel,
      apptype: getPluginAppTypeForHost_(host),
      localUpload: source.type === 'local-upload' ? 1 : 0
    })
  };

  saveSession_(session);
  return session;
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
  if (source.type === 'local-upload') throw new Error('Local uploads are saved after the editor uploads an image.');
  if (host === 'docs') return getDocsImageBlob_(source);
  throw new Error('当前版本只支持 Google Docs 中的图片。');
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
  PropertiesService.getScriptProperties().setProperty(SESSION_RECORD_PREFIX + session.id, JSON.stringify(session));

  const sessions = listSessions_().filter(function (item) {
    return item.id !== session.id;
  });
  sessions.unshift(session);

  PropertiesService.getUserProperties().setProperty(SESSION_STORE_KEY, JSON.stringify(sessions.slice(0, 20)));
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
  const raw = PropertiesService.getScriptProperties().getProperty(SESSION_RECORD_PREFIX + sessionId);
  if (raw) {
    try {
      const session = JSON.parse(raw);
      if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
        PropertiesService.getScriptProperties().deleteProperty(SESSION_RECORD_PREFIX + sessionId);
        return null;
      }
      return session;
    } catch (error) {
      return null;
    }
  }

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
    throw new Error('找不到标注会话。');
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
