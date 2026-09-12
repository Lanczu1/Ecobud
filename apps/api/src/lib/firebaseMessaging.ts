import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'node:fs';

type FirebaseCredentialJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function serviceAccountFromEnvironment(): FirebaseCredentialJson | undefined {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (inline) return JSON.parse(inline) as FirebaseCredentialJson;
  if (encoded) {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as FirebaseCredentialJson;
  }
  if (credentialPath) {
    return JSON.parse(fs.readFileSync(credentialPath, 'utf8')) as FirebaseCredentialJson;
  }
  return undefined;
}

function initializeFirebaseMessaging() {
  if (!getApps().length) {
    const serviceAccount = serviceAccountFromEnvironment();
    initializeApp({
      credential: serviceAccount ? cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }) : applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id,
    });
  }
  return getMessaging();
}

export const firebaseMessaging = {
  async send(params: {
    token: string;
    title: string;
    body: string;
    notificationId: string;
    priority: string;
  }) {
    return initializeFirebaseMessaging().send({
      token: params.token,
      notification: { title: params.title, body: params.body },
      data: { notificationId: params.notificationId },
      android: {
        priority: params.priority === 'high' ? 'high' : 'normal',
        notification: {
          channelId: 'ecobud',
          sound: 'default',
          color: '#16A34A',
        },
      },
      apns: {
        payload: { aps: { sound: 'default' } },
      },
    });
  },
};
