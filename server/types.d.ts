import "express-session";
import { User } from "@shared/schema";

declare module "express-session" {
    interface SessionData {
        user: {
            id: string;
            role: string;
            firstName: string;
            lastName: string;
            email: string;
            organizationId: string; // Added validation requirement
            settings?: any;
        };
    }
}
