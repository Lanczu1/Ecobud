"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const prismaClient_1 = require("../prismaClient");
const passwordService_1 = require("../security/passwordService");
const tokenService_1 = require("../security/tokenService");
const errorResponder_1 = require("../http/errorResponder");
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'demo@gmail.com',
        pass: process.env.GMAIL_PASS || 'demo1234',
    },
});
const authRoutes = (0, express_1.Router)();
exports.authRoutes = authRoutes;
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
});
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    name: zod_1.z.string().min(2).max(50).optional(),
    displayName: zod_1.z.string().min(2).max(50).optional(),
    otpCode: zod_1.z.string().length(6),
}).refine((payload) => Boolean(payload.name ?? payload.displayName), {
    message: 'A display name is required.',
    path: ['displayName'],
});
const otpSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
const usernameAvailabilitySchema = zod_1.z.object({
    displayName: zod_1.z.string().trim().min(2).max(50),
});
const toAuthResponse = (user) => {
    const token = tokenService_1.TokenService.sign({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
    });
    return {
        token,
        redirectPath: (0, tokenService_1.getRoleRedirectPath)(user.role),
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            points: user.points,
            currentStreak: user.currentStreak,
            displayName: user.profile?.displayName ?? user.name,
            avatarUrl: user.profile?.avatarUrl ?? null,
        },
    };
};
const getInactiveStatusMessage = (status) => status === 'suspended'
    ? 'Your ECOBUD account is suspended. Please contact an administrator.'
    : 'Your ECOBUD account is pending activation.';
const findProfileByDisplayName = (displayName) => prismaClient_1.prisma.profile.findFirst({
    where: {
        displayName: displayName.trim(),
    },
    select: {
        id: true,
    },
});
authRoutes.use(authLimiter);
authRoutes.get('/check-username', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const { displayName } = usernameAvailabilitySchema.parse(req.query);
    const existingProfile = await findProfileByDisplayName(displayName);
    return res.json({
        available: !existingProfile,
        message: existingProfile
            ? 'That username is already in use.'
            : 'That username is available.',
    });
}));
authRoutes.post('/register', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const displayName = payload.name ?? payload.displayName;
    const existingUser = await prismaClient_1.prisma.user.findUnique({ where: { email: payload.email } });
    const existingProfile = await findProfileByDisplayName(displayName);
    if (existingUser) {
        throw new errorResponder_1.HttpError(409, 'An ECOBUD account already exists for this email.');
    }
    if (existingProfile) {
        throw new errorResponder_1.HttpError(409, 'That username is already taken. Please choose another one.');
    }
    const otpRecord = await prismaClient_1.prisma.otpCode.findUnique({ where: { email: payload.email } });
    if (!otpRecord) {
        throw new errorResponder_1.HttpError(400, 'No verification code requested for this email.');
    }
    if (otpRecord.code !== payload.otpCode) {
        throw new errorResponder_1.HttpError(400, 'Invalid verification code.');
    }
    if (new Date() > otpRecord.expiresAt) {
        throw new errorResponder_1.HttpError(400, 'Verification code expired. Please request a new one.');
    }
    // Clean up used OTP
    await prismaClient_1.prisma.otpCode.delete({ where: { email: payload.email } });
    const passwordHash = await passwordService_1.PasswordService.hash(payload.password);
    const user = await prismaClient_1.prisma.user.create({
        data: {
            name: displayName,
            email: payload.email,
            passwordHash,
            role: 'user',
            status: 'active',
            stats: {
                create: {
                    currentStreak: 0,
                    ecoPoints: 0,
                    knowledgePoints: 0,
                },
            },
            weeklyGoal: {
                create: {
                    weeklyGoal: 5,
                },
            },
            profile: {
                create: {
                    displayName,
                    headline: 'Growing sustainable habits every day.',
                },
            },
        },
        include: {
            profile: true,
        },
    });
    return res.status(201).json(toAuthResponse(user));
}));
authRoutes.post('/send-otp', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const { email } = otpSchema.parse(req.body);
    const existingUser = await prismaClient_1.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new errorResponder_1.HttpError(409, 'An ECOBUD account already exists for this email.');
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await prismaClient_1.prisma.otpCode.upsert({
        where: { email },
        update: { code, expiresAt },
        create: { email, code, expiresAt },
    });
    try {
        await transporter.sendMail({
            from: '"ECOBUD Auth" <no-reply@ecobud.app>',
            to: email,
            subject: 'Your ECOBUD Verification Code',
            text: `Your ECOBUD verification code is: ${code}. It expires in 10 minutes.`,
        });
    }
    catch (e) {
        console.error('Failed to send OTP email', e);
        // Even if mock email fails, we return success for demo purporses if no valid credentials
    }
    return res.json({ success: true, message: 'OTP sent successfully.' });
}));
authRoutes.post('/login', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await prismaClient_1.prisma.user.findUnique({
        where: { email: payload.email },
        include: { profile: true },
    });
    if (!user) {
        throw new errorResponder_1.HttpError(401, 'Incorrect email or password.');
    }
    const passwordMatches = await passwordService_1.PasswordService.compare(payload.password, user.passwordHash);
    if (!passwordMatches) {
        throw new errorResponder_1.HttpError(401, 'Incorrect email or password.');
    }
    if (user.status !== 'active') {
        throw new errorResponder_1.HttpError(403, getInactiveStatusMessage(user.status));
    }
    return res.json(toAuthResponse(user));
}));
