import * as crypto from 'crypto';

export interface TransparencyPayload {
  userId: string;
  actionType: string;
  pointsAwarded: number;
  metadata?: string;
  timestamp: string; // ISO String
}

/**
 * Blockchain-inspired hash utility to ensure log integrtiy.
 * The currentHash of a new log entry is calculated using its own data 
 * combined with the currentHash of the chronologically previous log entry.
 */
export class TransparencyHasher {
  
  /**
   * Generates a SHA-256 hash for a new log entry
   * @param payload The data of the environmental action
   * @param previousHash The hash of the last entry in the DB, or 'GENESIS' for the first ever entry
   * @returns Generated hex string hash
   */
  static generateBlockHash(payload: TransparencyPayload, previousHash: string): string {
    // 1. Create a deterministic string representation of the payload
    const payloadString = JSON.stringify({
      u: payload.userId,
      a: payload.actionType,
      p: payload.pointsAwarded,
      m: payload.metadata || '',
      t: payload.timestamp
    });

    // 2. Concatenate with previous hash to create the chain link
    const dataToHash = `${previousHash}|${payloadString}`;

    // 3. Compute SHA-256 Hash
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  /**
   * Helper to anonymize user data before making logs public
   * @param userId The actual UUID
   * @returns A shortened deterministic string for public view e.g., "EcoWarrior#A4F1"
   */
  static anonymizeUserForPublicBoard(userId: string): string {
    const shortHash = crypto.createHash('md5').update(userId).digest('hex').substring(0, 4).toUpperCase();
    return `EcoWarrior#${shortHash}`;
  }
}
