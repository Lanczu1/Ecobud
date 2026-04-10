"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'ecobud-local-development-secret';
exports.TokenService = {
    sign: (session) => jsonwebtoken_1.default.sign(session, JWT_SECRET, {
        expiresIn: '7d',
    }),
    verify: (token) => jsonwebtoken_1.default.verify(token, JWT_SECRET),
};
