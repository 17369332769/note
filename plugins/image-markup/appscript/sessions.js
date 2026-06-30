const SESSION_STORE_KEY = 'annotationSessions';
const SESSION_RECORD_PREFIX = 'annotationSession:';
const OUTPUT_FOLDER_NAME = 'Image Markup Outputs';
const SESSION_TTL_HOURS = 24;

/**
 * Creates a session, persists the source image in Drive, and returns editor metadata.
 *
 * @param {string} host Host key.
 * @param {Object} source ImageSource.
 * @return {Object}
 */
function createSessionForSource_(host, source) {
  const blob = getSourceImageBlob_(host, source);
  const folder = getOutputFolder_();
  const sourceLabel = source.filename || source.label || 'workspace-image';
  const originalFile = folder.createFile(blob.setName(sourceLabel));
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  const session = {
    id: id,
    userEmailHash: hashUserEmail_(),
    host: host,
    source: source,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    originalImageFileId: originalFile.getId(),
    editorUrl: buildEditorUrl_(id, sourceLabel)
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
  if (source.type === 'drive-file') return getDriveImageBlob_(source);
  if (source.type === 'docs-inline-image') return getDocsImageBlob_(source);
  if (source.type === 'slides-image') return getSlidesImageBlob_(source);
  if (source.type === 'image-url') return getImageUrlBlob_(source);
  if (host === 'drive') return getDriveImageBlob_(source);
  if (host === 'docs') return getDocsImageBlob_(source);
  if (host === 'slides') return getSlidesImageBlob_(source);
  throw new Error('Unsupported image source.');
}

/**
 * Builds the external editor URL for a session.
 *
 * @param {string} sessionId Session ID.
 * @param {string} sourceLabel Label.
 * @return {string}
 */
function buildEditorUrl_(sessionId, sourceLabel) {
  const params = [
    'sessionId=' + encodeURIComponent(sessionId),
    'sourceLabel=' + encodeURIComponent(sourceLabel)
  ];

  return getEditorBaseUrl_() + '/image-markup?' + params.join('&');
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
    throw new Error('Annotation session was not found.');
  }
  return session;
}

/**
 * Returns or creates the output folder.
 *
 * @return {GoogleAppsScript.Drive.Folder}
 */
function getOutputFolder_() {
  const folders = DriveApp.getFoldersByName(OUTPUT_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(OUTPUT_FOLDER_NAME);
}

/**
 * Hashes the current user email when available.
 *
 * @return {string}
 */
function hashUserEmail_() {
  const email = Session.getActiveUser().getEmail() || 'unknown-user';
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email);
  return digest.map(function (byte) {
    const value = (byte + 256) % 256;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}
