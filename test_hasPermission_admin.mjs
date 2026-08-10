const userRoleId = '0958cdaa-7dd0-48bd-a80d-21d856d2526b'; // Admin role ID
const permission = 'settings:view';
const settings = {
  restricted_permissions: [
    'settings:view', 'settings:edit'
  ]
};
const role = {
  id: userRoleId,
  name: 'Admin',
  permissions: ['settings:view']
};

const hasPermission = (userRoleId, permission) => {
    if (!userRoleId) return false;
    const normalizedRoleId = userRoleId.toLowerCase();

    // 2. GLOBAL FEATURE CONTROL
    if (settings?.restricted_permissions && settings.restricted_permissions.length > 0) {
        if (permission.startsWith('settings:')) {
            if (!settings.restricted_permissions.includes(permission)) {
                return false;
            }
        }
    }

    if (normalizedRoleId === 'admin' || normalizedRoleId === 'system_admin') return true;

    // 3. ROLE-BASED DEFINITIONS
    if (role.id.toLowerCase() === normalizedRoleId || role.name.toLowerCase() === normalizedRoleId) {
        return role.permissions.includes(permission);
    }
    return false;
};

console.log("hasPermission:", hasPermission(userRoleId, permission));
