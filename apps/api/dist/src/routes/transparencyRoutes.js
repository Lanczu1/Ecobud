"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transparencyRoutes = void 0;
const express_1 = require("express");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const TransparencyLedgerService_1 = require("../services/TransparencyLedgerService");
const transparencyRoutes = (0, express_1.Router)();
exports.transparencyRoutes = transparencyRoutes;
const ledgerService = new TransparencyLedgerService_1.TransparencyLedgerService();
transparencyRoutes.get('/metrics', (0, errorResponder_1.errorBoundary)(async (_req, res) => {
    return res.json(await ledgerService.getPublicMetrics());
}));
transparencyRoutes.get('/logs', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const page = Number(req.query.page ?? '1');
    const pageSize = Number(req.query.pageSize ?? '10');
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    return res.json(await ledgerService.getLogs(page, pageSize, userId));
}));
transparencyRoutes.get('/mine', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    return res.json(await ledgerService.getLogs(1, 20, req.auth.userId));
}));
