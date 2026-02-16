/**
 * Google Drive Picker integration: sign in with Google, open Drive file picker,
 * download selected file(s) and return as blobs for upload to our storage.
 * Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID and (optional) NEXT_PUBLIC_GOOGLE_APP_ID in env.
 */

const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';
const GAPI_SCRIPT = 'https://apis.google.com/js/api.js';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export interface PickedDriveFile {
  name: string;
  mimeType: string;
  blob: Blob;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; error?: unknown }) => void;
          }) => { requestAccessToken: (overwrite?: { prompt?: string }) => void };
        };
      };
      picker?: {
        ViewId: { DOCS: string; DOCS_IMAGES: string; DOCS_VIDEOS: string };
        Action: { PICKED: string; CANCEL: string };
        PickerBuilder: new () => {
          setOAuthToken: (token: string) => unknown;
          setAppId: (id: string) => unknown;
          addView: (view: unknown) => unknown;
          setCallback: (cb: (data: { action: string; docs: Array<{ id: string; name: string; mimeType?: string }> }) => void) => unknown;
          build: () => { setVisible: (v: boolean) => void };
        };
        DocsView: new (id: string) => unknown;
      };
    };
    gapi?: {
      load: (name: string, callback: () => void) => void;
    };
  }
}

function getClientId(): string | null {
  return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    : null;
}

function getAppId(): string | null {
  return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_APP_ID
    ? process.env.NEXT_PUBLIC_GOOGLE_APP_ID
    : null;
}

export function isGoogleDrivePickerAvailable(): boolean {
  return !!getClientId();
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadGsi(): Promise<void> {
  return loadScript(GSI_SCRIPT);
}

function loadGapi(): Promise<void> {
  return loadScript(GAPI_SCRIPT);
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve) => {
    if (!window.gapi) {
      resolve();
      return;
    }
    window.gapi.load('picker', () => resolve());
  });
}

async function getAccessToken(): Promise<string> {
  await loadGsi();
  const clientId = getClientId();
  if (!clientId) throw new Error('Google Drive is not configured (missing client ID)');
  const google = window.google;
  if (!google?.accounts?.oauth2) throw new Error('Google Sign-In failed to load');
  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response: { access_token?: string; error?: unknown }) => {
        if (response.error) {
          reject(new Error('Google Drive access was denied or failed'));
          return;
        }
        if (response.access_token) resolve(response.access_token);
        else reject(new Error('No access token from Google'));
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

async function downloadDriveFile(fileId: string, accessToken: string): Promise<Blob> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  return res.blob();
}

export interface OpenPickerOptions {
  multiple?: boolean;
  /** Restrict to images and/or video (default: images and video) */
  type?: 'image' | 'video' | 'all';
}

/**
 * Open Google Drive Picker, let user select file(s), download them and call onSelect with blobs.
 * Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID. Optional NEXT_PUBLIC_GOOGLE_APP_ID for Picker (project number).
 * onCancel is called when the user closes the picker without selecting.
 */
export async function openGoogleDrivePicker(
  options: OpenPickerOptions,
  onSelect: (files: PickedDriveFile[]) => void,
  onCancel?: () => void
): Promise<void> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google Drive is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable.');
  }
  const accessToken = await getAccessToken();
  await loadGapi();
  await loadPickerApi();
  const google = window.google;
  if (!google?.picker) {
    throw new Error('Google Picker failed to load');
  }
  const viewId =
    options.type === 'image'
      ? google.picker.ViewId.DOCS_IMAGES
      : options.type === 'video'
        ? google.picker.ViewId.DOCS_VIDEOS
        : google.picker.ViewId.DOCS;
  const view = new google.picker.DocsView(viewId as unknown as string);
  const token = accessToken;
  const builder = new google.picker.PickerBuilder()
    .setOAuthToken(token)
    .addView(view)
    .setCallback((data: { action: string; docs: Array<{ id: string; name: string; mimeType?: string }> }) => {
      if (data.action === google.picker!.Action.CANCEL) {
        onCancel?.();
        return;
      }
      if (data.action !== google.picker!.Action.PICKED || !data.docs?.length) return;
      (async () => {
        const files: PickedDriveFile[] = [];
        for (const doc of data.docs) {
          try {
            const blob = await downloadDriveFile(doc.id, token);
            files.push({
              name: doc.name || 'file',
              mimeType: doc.mimeType || 'application/octet-stream',
              blob,
            });
          } catch (err) {
            console.error('[GoogleDrivePicker] Download failed for', doc.name, err);
          }
        }
        if (files.length) onSelect(files);
      })();
    });
  const appId = getAppId();
  if (appId) builder.setAppId(appId as unknown as string);
  const picker = builder.build();
  picker.setVisible(true);
}
