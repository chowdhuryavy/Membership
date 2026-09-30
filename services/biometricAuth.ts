// Mobile Biometric Authentication Service (Face ID, Touch ID & Android Fingerprint/Face Unlock)
// Uses WebAuthn (Web Authentication API) for iOS Safari/PWA & Android Chrome/PWA

export interface BiometricRecord {
  id: string; // WebAuthn Credential ID
  type: 'guest' | 'staff';
  identifier: string; // Email for guest, Employee Number for staff
  name: string;
  registeredAt: string;
}

class BiometricAuthService {
  private static instance: BiometricAuthService;

  public static getInstance(): BiometricAuthService {
    if (!BiometricAuthService.instance) {
      BiometricAuthService.instance = new BiometricAuthService();
    }
    return BiometricAuthService.instance;
  }

  /**
   * Strictly checks if the current client is a Mobile device (iOS iPhone/iPad or Android Phone/Tablet)
   */
  public isMobileDevice(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
    const isTouchTablet = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 1024;
    return isMobileUA || isTouchTablet;
  }

  /**
   * Checks if Biometric Hardware (Face ID / Touch ID / Fingerprint) is supported on this mobile device
   */
  public async isBiometricSupported(): Promise<boolean> {
    if (!this.isMobileDevice()) return false;
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;

    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
      }
      return true;
    } catch {
      return true;
    }
  }

  private getStorageKey(type: 'guest' | 'staff', identifier?: string): string {
    if (identifier) {
      return `hcm_biometric_${type}_${identifier.trim().toLowerCase()}`;
    }
    return `hcm_biometric_${type}_last`;
  }

  /**
   * Check if a biometric key is already registered for this device & user
   */
  public hasRegisteredBiometric(type: 'guest' | 'staff', identifier?: string): boolean {
    if (!this.isMobileDevice()) return false;
    
    if (identifier) {
      const key = this.getStorageKey(type, identifier);
      return Boolean(localStorage.getItem(key));
    }

    // Check if any last registered biometric exists for this portal type
    const lastKey = localStorage.getItem(this.getStorageKey(type));
    if (lastKey) {
      const recordKey = this.getStorageKey(type, lastKey);
      return Boolean(localStorage.getItem(recordKey));
    }

    return false;
  }

  /**
   * Get the identifier (email/employee number) associated with the last biometric registration
   */
  public getRegisteredIdentifier(type: 'guest' | 'staff'): string | null {
    if (!this.isMobileDevice()) return null;
    return localStorage.getItem(this.getStorageKey(type));
  }

  /**
   * Register Face ID / Touch ID / Fingerprint for a Guest or Staff member on this mobile device
   */
  public async registerBiometric(
    type: 'guest' | 'staff',
    identifier: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isMobileDevice()) {
      return { success: false, error: 'Biometric authentication is only available on mobile devices.' };
    }

    const cleanId = identifier.trim().toLowerCase();
    const challenge = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(challenge);
    }

    const userId = new TextEncoder().encode(cleanId);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: challenge,
      rp: {
        name: 'HCM Member & Staff Mobile Portal',
        id: typeof window !== 'undefined' ? window.location.hostname : 'perfection.my',
      },
      user: {
        id: userId,
        name: cleanId,
        displayName: name || cleanId,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required', // Changed from preferred to required
        residentKey: 'preferred', // Modern equivalent for discoverable credentials
      },
      timeout: 60000,
      attestation: 'none',
    };

    try {
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      });

      const credentialId = (credential as PublicKeyCredential).id;

      const record: BiometricRecord = {
        id: credentialId,
        type,
        identifier: cleanId,
        name,
        registeredAt: new Date().toISOString(),
      };

      // Save to localStorage
      localStorage.setItem(this.getStorageKey(type, cleanId), JSON.stringify(record));
      localStorage.setItem(this.getStorageKey(type), cleanId);

      return { success: true };
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        return { success: false, error: 'Biometric setup cancelled by user.' };
      }
      console.error('[BiometricAuth] Error registering biometric:', err);
      return { success: false, error: err?.message || 'Failed to register biometric lock.' };
    }
  }

  /**
   * Authenticate using Face ID / Touch ID / Fingerprint on Mobile
   */
  public async authenticateBiometric(
    type: 'guest' | 'staff',
    targetIdentifier?: string
  ): Promise<{ success: boolean; identifier?: string; error?: string }> {
    if (!this.isMobileDevice()) {
      return { success: false, error: 'Biometric login is enabled for mobile devices only.' };
    }

    const identifier = (targetIdentifier || this.getRegisteredIdentifier(type) || '').trim().toLowerCase();
    if (!identifier) {
      return { success: false, error: 'No biometric credential found on this device.' };
    }

    const key = this.getStorageKey(type, identifier);
    const rawRecord = localStorage.getItem(key);
    if (!rawRecord) {
      return { success: false, error: 'Biometric registration not found for this account on this phone.' };
    }

    const record: BiometricRecord = JSON.parse(rawRecord);

    const challenge = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(challenge);
    }

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challenge,
      timeout: 60000,
      userVerification: 'required', // Changed from preferred to required
      rpId: typeof window !== 'undefined' ? window.location.hostname : 'perfection.my',
    };

    try {
      await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      return { success: true, identifier: record.identifier };
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        return { success: false, error: 'Biometric verification cancelled.' };
      }
      console.error('[BiometricAuth] Error verifying biometric:', err);
      return { success: false, error: err?.message || 'Biometric authentication failed.' };
    }
  }

  /**
   * Remove biometric registration from this device
   */
  public removeBiometric(type: 'guest' | 'staff', identifier: string): void {
    const cleanId = identifier.trim().toLowerCase();
    localStorage.removeItem(this.getStorageKey(type, cleanId));
    if (this.getRegisteredIdentifier(type) === cleanId) {
      localStorage.removeItem(this.getStorageKey(type));
    }
  }
}

export const biometricAuth = BiometricAuthService.getInstance();
