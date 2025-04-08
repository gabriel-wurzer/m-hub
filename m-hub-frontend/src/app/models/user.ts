import { Building } from "./building";

/**
 * Interface of user.
 */
export interface User {
    id: string;
    username?: string;
    email?: string;
    buildings?: Building[];
}