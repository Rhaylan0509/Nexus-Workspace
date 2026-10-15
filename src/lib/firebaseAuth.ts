import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

/** Turn Firebase/Google OAuth failures into actionable messages for the user. */
export function getGoogleAuthErrorMessage(error: unknown): string {
  const authError = error as { code?: string; message?: string };
  const code = authError?.code || '';
  const message = authError?.message || '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `O Firebase não autorizou o domínio ${hostname}. No Firebase Console, abra Authentication → Settings → Authorized domains e adicione ${hostname} (sem https://).`;
    case 'auth/operation-not-allowed':
      return 'O login com Google está desativado. Ative o provedor Google em Firebase Console → Authentication → Sign-in method.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente.';
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação foi fechada antes da conclusão. Tente novamente e conclua o acesso ao Google.';
    case 'auth/cancelled-popup-request':
      return 'Já existe uma autenticação Google em andamento. Termine ou feche a outra janela antes de tentar novamente.';
    case 'auth/network-request-failed':
      return 'Não foi possível alcançar o Firebase. Verifique sua conexão, bloqueadores de rede ou VPN e tente novamente.';
    case 'auth/invalid-api-key':
      return 'A chave do Firebase é inválida. Confira a configuração do app web no Firebase Console.';
    case 'auth/invalid-credential':
      return 'O Google recusou as credenciais OAuth. Confirme se o provedor Google está habilitado no Firebase e se a tela de consentimento inclui esta conta.';
    case 'auth/tenant-id-mismatch':
      return 'O provedor Google está configurado para outro tenant Firebase. Confira a configuração multi-tenant do projeto.';
    default:
      return [code, message].filter(Boolean).join(': ') || 'Erro inesperado na autenticação Google.';
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Drive');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/** Requests a separate Google consent grant for Calendar event access. */
export const googleCalendarSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const calendarProvider = new GoogleAuthProvider();
    calendarProvider.addScope('https://www.googleapis.com/auth/drive.file');
    calendarProvider.addScope('https://www.googleapis.com/auth/calendar.events.owned');
    calendarProvider.setCustomParameters({ prompt: 'consent' });
    const result = await signInWithPopup(auth, calendarProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter autorização para o Google Agenda.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error) {
    console.error('Google Calendar authorization error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/** Returns a Firebase session token for authenticated app-server requests. */
export const getFirebaseIdToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
