"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAccess = exports.requireModeratorAccess = exports.requireUserAccess = exports.requireRoles = exports.authenticateRequest = void 0;
const prismaClient_1 = require("../prismaClient");
const tokenService_1 = require("../security/tokenService");
const getInactiveStatusMessage = (status) => {
    if (status === 'suspended') {
        return 'Your ECOBUD account is suspended. Please contact an administrator.';
    }
    return 'Your ECOBUD account is pending activation.';
};
const authenticateRequest = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'A bearer token is required.' });
    }
    const token = authorization.replace('Bearer ', '').trim();
    try {
        const session = tokenService_1.TokenService.verify(token);
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
            },
        });
        if (!user) {
            return res.status(401).json({ message: 'The access token is no longer valid.' });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ message: getInactiveStatusMessage(user.status) });
        }
        req.auth = {
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
        };
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
exports.requireUserAccess = (0, exports.requireRoles)('user', 'moderator', 'admin');
exports.requireModeratorAccess = (0, exports.requireRoles)('moderator', 'admin');
exports.requireAdminAccess = (0, exports.requireRoles)('admin');
