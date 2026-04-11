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
    displayName: zod_1.z.string().min(2).max(50),
    otpCode: zod_1.z.string().length(6),
});
const otpSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
const toAuthResponse = (user) => {
    const role = (['USER', 'MODERATOR', 'ADMIN'].includes(user.role)
        ? user.role
        : 'USER');
    const token = tokenService_1.TokenService.sign({
        userId: user.id,
        email: user.email,
        role,
    });
    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            role,
            points: user.points,
            currentStreak: user.currentStreak,
            displayName: user.profile?.displayName ?? user.email,
            avatarUrl: user.profile?.avatarUrl ?? null,
        },
    };
};
authRoutes.use(authLimiter);
authRoutes.post('/register', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const existingUser = await prismaClient_1.prisma.user.findUnique({ where: { email: payload.email } });
    if (existingUser) {
        throw new errorResponder_1.HttpError(409, 'An ECOBUD account already exists for this email.');
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
            email: payload.email,
            passwordHash,
            profile: {
                create: {
                    displayName: payload.displayName,
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
    return res.json(toAuthResponse(user));
}));
