"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.faqRoutes = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const errorResponder_1 = require("../http/errorResponder");
const faqRoutes = (0, express_1.Router)();
exports.faqRoutes = faqRoutes;
faqRoutes.get('/', (0, errorResponder_1.errorBoundary)(async (_req, res) => {
    const items = await prismaClient_1.prisma.faq.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return res.json({ items });
}));
