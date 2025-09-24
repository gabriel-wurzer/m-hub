/**
 * Interface for users.
 */
export interface User {
    id: string;
    username?: string;
    email?: string;
    // buildings?: string[]; // array of bw_geb_id -> (user_id, building_id) entry in user_buildings table exists
}