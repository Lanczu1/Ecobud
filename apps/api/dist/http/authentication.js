"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.authenticateRequest = void 0;
const tokenService_1 = require("../security/tokenService");
const authenticateRequest = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'A bearer token is required.' });
    }
    const token = authorization.replace('Bearer ', '').trim();
    try {
        req.auth = tokenService_1.TokenService.verify(token);
        return next();
    }
    catch {
        return res.status(401).json({ message: 'The access token is invalid or expired.' });
    }
};
exports.authenticateRequest = authenticateRequest;
const requireRoles = (...roles) => (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
        return res.status(403).json({ message: 'You do not have access to this resource.' });
    }
    return next();
};
exports.requireRoles = requireRoles;
