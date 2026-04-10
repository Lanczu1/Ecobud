"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorBoundary = exports.errorResponder = exports.HttpError = void 0;
const zod_1 = require("zod");
class HttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'HttpError';
    }
}
exports.HttpError = HttpError;
const errorResponder = (error, _req, res, _next) => {
    if (error instanceof zod_1.ZodError) {
        return res.status(400).json({
            message: 'The request payload is invalid.',
            issues: error.flatten(),
        });
    }
    if (error instanceof HttpError) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: 'Unexpected server error.' });
};
exports.errorResponder = errorResponder;
const errorBoundary = (handler) => (req, res, next) => void Promise.resolve(handler(req, res, next)).catch(next);
exports.errorBoundary = errorBoundary;
