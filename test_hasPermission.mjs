const userRoleId = '0958cdaa-7dd0-48bd-a80d-21d856d2526b';
const normalizedRoleId = userRoleId.toLowerCase();

const permission = 'settings:view';

const settings = {
  restricted_permissions: [
    'settings:view', 'settings:edit'
  ]
};

// 2. GLOBAL FEATURE CONTROL
if (settings?.restricted_permissions && settings.restricted_permissions.length > 0) {
    if (permission.startsWith('settings:')) {
        if (!settings.restricted_permissions.includes(permission)) {
            console.log("Failed restricted");
        } else {
            console.log("Passed restricted");
        }
    }
}
