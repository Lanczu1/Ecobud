"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const authRoutes_1 = require("./routes/authRoutes");
const userRoutes_1 = require("./routes/userRoutes");
const lessonRoutes_1 = require("./routes/lessonRoutes");
const challengeRoutes_1 = require("./routes/challengeRoutes");
const habitRoutes_1 = require("./routes/habitRoutes");
const eventRoutes_1 = require("./routes/eventRoutes");
const transparencyRoutes_1 = require("./routes/transparencyRoutes");
const experienceRoutes_1 = require("./routes/experienceRoutes");
const adminRoutes_1 = require("./routes/adminRoutes");
const errorResponder_1 = require("./http/errorResponder");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: '*',
}));
app.use(express_1.default.json());
app.get('/api/health', (_req, res) => {
    return res.json({
        status: 'ok',
        platform: 'ECOBUD API',
        timestamp: new Date().toISOString(),
    });
});
app.use('/api/auth', authRoutes_1.authRoutes);
app.use('/api/users', userRoutes_1.userRoutes);
app.use('/api/lessons', lessonRoutes_1.lessonRoutes);
app.use('/api/challenges', challengeRoutes_1.challengeRoutes);
app.use('/api/habits', habitRoutes_1.habitRoutes);
app.use('/api/events', eventRoutes_1.eventRoutes);
app.use('/api/transparency', transparencyRoutes_1.transparencyRoutes);
app.use('/api/experience', experienceRoutes_1.experienceRoutes);
app.use('/api/admin', adminRoutes_1.adminRoutes);
app.use(errorResponder_1.errorResponder);
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
    console.log(`ECOBUD API running at http://localhost:${port}`);
});
