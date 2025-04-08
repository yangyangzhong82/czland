// apiExports.js - Handles the export of API functions using ll.exports

const { logDebug, logInfo, logWarning, logError } = require('./logger'); // Import logger for export messages
const { getAreaData, getSpatialIndex } = require('./czareaprotection'); // Import functions from main module
const { checkPermission } = require('./permission'); // Import checkPermission from permission.js
const apiFuncs = require('./api'); // Import the entire api module
const { getHighestPriorityArea } = require('./utils'); // Import utility function

const API_NAMESPACE = "CzAreaProtection";

logInfo(`[API Exports] Initializing API exports for namespace: ${API_NAMESPACE}`);

// --- Export Functions ---

// Export getAreaData (Assuming this comes from czareaprotection, not api.js - keeping as is)
if (typeof getAreaData === 'function') {
    ll.exports(getAreaData, API_NAMESPACE, "getAreaData");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.getAreaData`);
} else {
    logError(`[API Exports] Failed to export getAreaData: Function not found or invalid.`);
}

// Export getSpatialIndex (Assuming this comes from czareaprotection, not api.js - keeping as is)
if (typeof getSpatialIndex === 'function') {
    ll.exports(getSpatialIndex, API_NAMESPACE, "getSpatialIndex");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.getSpatialIndex`);
} else {
    logError(`[API Exports] Failed to export getSpatialIndex: Function not found or invalid.`);
}

// Export checkPermission (Assuming this comes from permission.js, not api.js - keeping as is)
if (typeof checkPermission === 'function') {
    ll.exports(checkPermission, API_NAMESPACE, "checkPermission");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.checkPermission`);
} else {
    logError(`[API Exports] Failed to export checkPermission: Function not found or invalid.`);
}

// Export getHighestPriorityArea (Assuming this comes from utils.js, not api.js - keeping as is)
if (typeof getHighestPriorityArea === 'function') {
    ll.exports(getHighestPriorityArea, API_NAMESPACE, "getHighestPriorityArea");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.getHighestPriorityArea`);
} else {
    logError(`[API Exports] Failed to export getHighestPriorityArea: Function not found or invalid.`);
}

// Export getPlayerAreaGroup (from api.js)
if (apiFuncs && typeof apiFuncs.getPlayerAreaGroup === 'function') {
    ll.exports(apiFuncs.getPlayerAreaGroup, API_NAMESPACE, "getPlayerAreaGroup");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.getPlayerAreaGroup`);
} else {
    logError(`[API Exports] Failed to export getPlayerAreaGroup: Function not found or invalid in api.js module.`);
}

// Export getGroupPermissions (from api.js)
if (apiFuncs && typeof apiFuncs.getGroupPermissions === 'function') {
    ll.exports(apiFuncs.getGroupPermissions, API_NAMESPACE, "getGroupPermissions");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.getGroupPermissions`);
} else {
    logError(`[API Exports] Failed to export getGroupPermissions: Function not found or invalid in api.js module.`);
}

// Export createArea (from api.js)
if (apiFuncs && typeof apiFuncs.createArea === 'function') {
    ll.exports(apiFuncs.createArea, API_NAMESPACE, "createArea");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.createArea`);
} else {
    logError(`[API Exports] Failed to export createArea: Function not found or invalid in api.js module.`);
}

// Export modifyArea (from api.js)
if (apiFuncs && typeof apiFuncs.modifyArea === 'function') {
    ll.exports(apiFuncs.modifyArea, API_NAMESPACE, "modifyArea");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.modifyArea`);
} else {
    logError(`[API Exports] Failed to export modifyArea: Function not found or invalid in api.js module.`);
}

// Export getAreaInfo (from api.js)
if (apiFuncs && typeof apiFuncs.getAreaInfo === 'function') {
    ll.exports(apiFuncs.getAreaInfo, API_NAMESPACE, "getAreaInfo");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.getAreaInfo`);
} else {
    logError(`[API Exports] Failed to export getAreaInfo: Function not found or invalid in api.js module.`);
}

// Export _internal_createAreaFromData (from api.js)
if (apiFuncs && typeof apiFuncs._internal_createAreaFromData === 'function') {
    ll.exports(apiFuncs._internal_createAreaFromData, API_NAMESPACE, "_internal_createAreaFromData");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}._internal_createAreaFromData`);
} else {
    logError(`[API Exports] Failed to export _internal_createAreaFromData: Function not found or invalid in api.js module.`);
}

// Example for exporting economy function (uncomment if needed)
/*
if (typeof getPlayerBalance === 'function') {
    ll.exports(getPlayerBalance, API_NAMESPACE, "getPlayerBalance");
    logInfo(`[API Exports] Exported: ${API_NAMESPACE}.getPlayerBalance`);
} else {
    logError(`[API Exports] Failed to export getPlayerBalance: Function not found or invalid.`);
}
*/

logInfo(`[API Exports] Finished API exports for namespace: ${API_NAMESPACE}`);

// No need to export anything from this module itself via module.exports
// Its purpose is solely to execute the ll.exports calls when required.
