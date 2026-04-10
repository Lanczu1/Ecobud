"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransparencyHasher = void 0;
const crypto = __importStar(require("crypto"));
/**
 * Blockchain-inspired hash utility to ensure log integrtiy.
 * The currentHash of a new log entry is calculated using its own data
 * combined with the currentHash of the chronologically previous log entry.
 */
class TransparencyHasher {
    /**
     * Generates a SHA-256 hash for a new log entry
     * @param payload The data of the environmental action
     * @param previousHash The hash of the last entry in the DB, or 'GENESIS' for the first ever entry
     * @returns Generated hex string hash
     */
    static generateBlockHash(payload, previousHash) {
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
    static anonymizeUserForPublicBoard(userId) {
        const shortHash = crypto.createHash('md5').update(userId).digest('hex').substring(0, 4).toUpperCase();
        return `EcoWarrior#${shortHash}`;
    }
}
exports.TransparencyHasher = TransparencyHasher;
