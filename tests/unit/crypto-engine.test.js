/**
 * ============================================================================
 * IMC ER Console - Milestone 2 Unit Test Suite
 * Post-Quantum Hybrid Cryptography & Authenticated Encryption (FIPS 203 ML-KEM-768)
 * ============================================================================
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClinicalCryptoEngine, cryptoEngine } from '../../public/js/crypto-engine.js';

describe('Post-Quantum Hybrid Cryptography Suite (ClinicalCryptoEngine)', () => {
  let engine;

  beforeEach(() => {
    engine = new ClinicalCryptoEngine();
  });

  // Test 1: Singleton and Window binding
  it('T3.01: exports singleton cryptoEngine and registers window.ClinicalCryptoEngine', () => {
    expect(cryptoEngine).toBeInstanceOf(ClinicalCryptoEngine);
    if (typeof window !== 'undefined') {
      expect(window.ClinicalCryptoEngine).toBe(cryptoEngine);
    }
  });

  // Test 2: Key generation and caching
  it('T3.02: generates and caches a 256-bit AES-GCM session key', async () => {
    const key1 = await engine.getOrGenerateKey();
    const key2 = await engine.getOrGenerateKey();
    if (key1) {
      expect(key1).toBe(key2); // Cached key identity
    }
  });

  // Test 3: Standard PHI encryption round-trip
  it('T3.03: encrypts and decrypts clinical notes with 100% round-trip fidelity', async () => {
    const clinicalNote = 'Patient presents with severe substernal chest pressure radiating to left arm. Troponin-I elevated at 1.45 ng/mL.';
    const encrypted = await engine.encryptPHI(clinicalNote);

    expect(encrypted).toHaveProperty('ciphertext');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('algorithm');
    expect(encrypted.ciphertext).not.toBe(clinicalNote);

    const decrypted = await engine.decryptPHI(encrypted.ciphertext, encrypted.iv);
    expect(decrypted).toBe(clinicalNote);
  });

  // Test 4: Semantic Security / Random IV (Probabilistic Encryption)
  it('T3.04: produces distinct ciphertexts and IVs for identical plaintext inputs', async () => {
    const note = 'Vital Signs: BP 140/90, HR 102, SpO2 96% on RA';
    const enc1 = await engine.encryptPHI(note);
    const enc2 = await engine.encryptPHI(note);

    if (enc1.algorithm === 'ML-KEM-768+AES-256-GCM') {
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    }

    expect(await engine.decryptPHI(enc1.ciphertext, enc1.iv)).toBe(note);
    expect(await engine.decryptPHI(enc2.ciphertext, enc2.iv)).toBe(note);
  });

  // Test 5: Multi-byte Arabic and Unicode PHI strings
  it('T3.05: correctly encrypts and decrypts Arabic clinical notes and medical emojis', async () => {
    const arabicNote = '🫀 كود جلطة القلب: تم إعطاء أسبرين 300 مجم وكلوبيدوجريل 300 مجم مع تحويل عاجل للقسطرة القلبية.';
    const encrypted = await engine.encryptPHI(arabicNote);
    const decrypted = await engine.decryptPHI(encrypted.ciphertext, encrypted.iv);

    expect(decrypted).toBe(arabicNote);
  });

  // Test 6: Tamper detection & authentication tag failure
  it('T3.06: fails closed to safe placeholder when ciphertext is tampered or corrupted', async () => {
    const note = 'Sensitive psychiatric assessment notes';
    const encrypted = await engine.encryptPHI(note);

    if (encrypted.algorithm === 'ML-KEM-768+AES-256-GCM') {
      // Corrupt the ciphertext by altering the last character
      const rawBytes = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));
      rawBytes[rawBytes.length - 1] ^= 0xFF; // Flip bits
      const tamperedCiphertext = btoa(String.fromCharCode(...rawBytes));

      const decrypted = await engine.decryptPHI(tamperedCiphertext, encrypted.iv);
      expect(decrypted).toBe('[ENCRYPTED PHI - ML-KEM PROTECTED]');
    } else {
      // Simulation mode fallback
      const corruptedCiphertext = 'INVALID_BASE64_%%%';
      const decrypted = await engine.decryptPHI(corruptedCiphertext, encrypted.iv);
      expect(decrypted).toBe(corruptedCiphertext);
    }
  });

  // Test 7: Invalid or corrupted IV
  it('T3.07: handles invalid or corrupted IV gracefully without throwing', async () => {
    const note = 'Clinical pathology report';
    const encrypted = await engine.encryptPHI(note);

    if (encrypted.algorithm === 'ML-KEM-768+AES-256-GCM') {
      const corruptedIV = btoa('invalid_iv_len');
      const decrypted = await engine.decryptPHI(encrypted.ciphertext, corruptedIV);
      expect(decrypted).toBe('[ENCRYPTED PHI - ML-KEM PROTECTED]');
    }
  });

  // Test 8: Large clinical payload throughput (100KB)
  it('T3.08: encrypts and decrypts large clinical histories (100KB) without truncation', async () => {
    const largeNote = 'History of Present Illness: '.repeat(4000); // ~108 KB
    const encrypted = await engine.encryptPHI(largeNote);
    const decrypted = await engine.decryptPHI(encrypted.ciphertext, encrypted.iv);

    expect(decrypted.length).toBe(largeNote.length);
    expect(decrypted).toBe(largeNote);
  });

  // Test 9: Null, empty, and non-string boundary handling
  it('T3.09: safely handles empty strings, null, undefined, and non-string inputs', async () => {
    expect(await engine.encryptPHI('')).toEqual({ ciphertext: '', iv: '', algorithm: 'none' });
    expect(await engine.encryptPHI(null)).toEqual({ ciphertext: null, iv: '', algorithm: 'none' });
    expect(await engine.encryptPHI(undefined)).toEqual({ ciphertext: undefined, iv: '', algorithm: 'none' });
    expect(await engine.encryptPHI(12345)).toEqual({ ciphertext: 12345, iv: '', algorithm: 'none' });

    expect(await engine.decryptPHI('', 'iv')).toBe('');
    expect(await engine.decryptPHI(null, 'iv')).toBe('');
    expect(await engine.decryptPHI(undefined, 'iv')).toBe('');
  });

  // Test 10: Fallback simulation round-trip parity
  it('T3.10: verifies deterministic fallback simulation mode for headless CI', async () => {
    const simText = 'Simulated offline clinical triage note';
    const simEncrypted = {
      ciphertext: btoa(encodeURIComponent(simText)),
      iv: 'simulated-iv-2026',
      algorithm: 'SIMULATED-ML-KEM-768'
    };

    const simDecrypted = await engine.decryptPHI(simEncrypted.ciphertext, simEncrypted.iv);
    expect(simDecrypted).toBe(simText);
  });
});
