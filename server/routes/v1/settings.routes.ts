/**
 * Settings Routes Module (v1)
 * 
 * Handles company and receipt settings:
 * - Get/update company settings
 * - Get/update receipt settings
 */

import { Router } from 'express';
import { z } from 'zod';
import { settingsService } from '../../services/settings.service';
import { isAuthenticated, checkPermission } from '../../auth-middleware';
import { insertCompanySettingsSchema, insertReceiptSettingsSchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/settings/company
 * Get company settings
 */
router.get('/company', async (req, res) => {
    try {
        // Allow header or session
        const organizationId = req.session?.user?.organizationId || req.headers['x-organization-id'];
        if (!organizationId) return res.status(400).json({ message: "Organization context required" });

        const settings = await settingsService.getCompanySettings(organizationId as string);
        res.json(settings || {});
    } catch (error) {
        console.error('Error fetching company settings:', error);
        res.status(500).json({ message: 'Failed to fetch company settings' });
    }
});

/**
 * POST /api/settings/company
 * Update company settings (admin only)
 */
router.post('/company', isAuthenticated, checkPermission('settings:manage'), async (req, res) => {
    try {
        console.log('Received company settings update:', req.body);
        const settingsData = insertCompanySettingsSchema.parse(req.body);
        const updatedSettings = await settingsService.updateCompanySettings(req.session.user!.organizationId, settingsData);
        res.json(updatedSettings);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Validation error updating company settings:', JSON.stringify(error.errors, null, 2));
            res.status(400).json({ message: 'Validation failed', errors: error.errors });
        } else {
            console.error('Error updating company settings:', error);
            res.status(500).json({ message: 'Failed to update company settings', error: (error as Error).message });
        }
    }
});

/**
 * GET /api/settings/receipt
 * Get receipt settings
 */
router.get('/receipt', async (req, res) => {
    try {
        const organizationId = req.session?.user?.organizationId || req.headers['x-organization-id'];
        if (!organizationId) return res.status(400).json({ message: "Organization context required" });

        const settings = await settingsService.getReceiptSettings(organizationId as string);
        res.json(settings || {});
    } catch (error) {
        console.error('Error fetching receipt settings:', error);
        res.status(500).json({ message: 'Failed to fetch receipt settings' });
    }
});

/**
 * POST /api/settings/receipt
 * Update receipt settings (admin only)
 */
router.post('/receipt', isAuthenticated, checkPermission('settings:manage'), async (req, res) => {
    try {
        const settingsData = insertReceiptSettingsSchema.parse(req.body);
        const updatedSettings = await settingsService.updateReceiptSettings(req.session.user!.organizationId, settingsData);
        res.json(updatedSettings);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Validation error updating receipt settings:', JSON.stringify(error.errors, null, 2));
            res.status(400).json({ message: 'Validation failed', errors: error.errors });
        } else {
            console.error('Error updating receipt settings:', error);
            res.status(500).json({ message: 'Failed to update receipt settings' });
        }
    }
});

export default router;
