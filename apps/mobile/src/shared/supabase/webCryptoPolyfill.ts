import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';
import { Platform } from 'react-native';

// Hermes has no WebCrypto. Without it, supabase-js silently weakens PKCE:
// the verifier comes from Math.random and the challenge method becomes "plain".
if (Platform.OS !== 'web') {
  const webCrypto = (globalThis.crypto ?? {}) as any;

  webCrypto.getRandomValues ??= getRandomValues;
  webCrypto.subtle ??= {
    digest: async (algorithm: string, data: BufferSource) => {
      if (algorithm !== 'SHA-256') {
        throw new Error(`Unsupported digest algorithm: ${algorithm}`);
      }
      return digest(CryptoDigestAlgorithm.SHA256, data);
    },
  };

  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', { value: webCrypto, configurable: true });
  }
}
