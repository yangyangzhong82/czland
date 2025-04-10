// apiExports.js - 使用 ll.exports 导出 API 函数

const { logDebug, logInfo, logWarning, logError } = require('./logger'); // 导入日志记录器用于输出导出信息
const { getAreaData, getSpatialIndex } = require('./czareaprotection'); // 从主模块导入函数
const { checkPermission } = require('./permission'); // 从 permission.js 导入 checkPermission
const apiFuncs = require('./api'); // 导入整个 api 模块
const { getHighestPriorityArea } = require('./utils'); // 导入工具函数

const API_NAMESPACE = "CzAreaProtection"; // API 命名空间

logInfo(`[API 导出] 初始化命名空间 ${API_NAMESPACE} 的 API 导出...`);

// --- 导出函数 ---

// 导出 getAreaData (假设来自 czareaprotection 而非 api.js - 保持原样)
if (typeof getAreaData === 'function') {
    ll.exports(getAreaData, API_NAMESPACE, "getAreaData");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getAreaData`);
} else {
    logError(`[API 导出] 导出 getAreaData 失败: 函数未找到或无效。`);
}

// 导出 getSpatialIndex (假设来自 czareaprotection 而非 api.js - 保持原样)
if (typeof getSpatialIndex === 'function') {
    ll.exports(getSpatialIndex, API_NAMESPACE, "getSpatialIndex");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getSpatialIndex`);
} else {
    logError(`[API 导出] 导出 getSpatialIndex 失败: 函数未找到或无效。`);
}

// 导出 checkPermission (假设来自 permission.js 而非 api.js - 保持原样)
if (typeof checkPermission === 'function') {
    ll.exports(checkPermission, API_NAMESPACE, "checkPermission");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.checkPermission`);
} else {
    logError(`[API 导出] 导出 checkPermission 失败: 函数未找到或无效。`);
}

// 导出 getHighestPriorityArea 
if (typeof getHighestPriorityArea === 'function') {
    ll.exports(getHighestPriorityArea, API_NAMESPACE, "getHighestPriorityArea");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getHighestPriorityArea`);
} else {
    logError(`[API 导出] 导出 getHighestPriorityArea 失败: 函数未找到或无效。`);
}

// 导出 getPlayerAreaGroup (来自 api.js)
if (apiFuncs && typeof apiFuncs.getPlayerAreaGroup === 'function') {
    ll.exports(apiFuncs.getPlayerAreaGroup, API_NAMESPACE, "getPlayerAreaGroup");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getPlayerAreaGroup`);
} else {
    logError(`[API 导出] 导出 getPlayerAreaGroup 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 getGroupPermissions (来自 api.js)
if (apiFuncs && typeof apiFuncs.getGroupPermissions === 'function') {
    ll.exports(apiFuncs.getGroupPermissions, API_NAMESPACE, "getGroupPermissions");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getGroupPermissions`);
} else {
    logError(`[API 导出] 导出 getGroupPermissions 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 createArea (来自 api.js)
if (apiFuncs && typeof apiFuncs.createArea === 'function') {
    ll.exports(apiFuncs.createArea, API_NAMESPACE, "createArea");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.createArea`);
} else {
    logError(`[API 导出] 导出 createArea 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 modifyArea (来自 api.js)
if (apiFuncs && typeof apiFuncs.modifyArea === 'function') {
    ll.exports(apiFuncs.modifyArea, API_NAMESPACE, "modifyArea");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.modifyArea`);
} else {
    logError(`[API 导出] 导出 modifyArea 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 getAreaInfo (来自 api.js)
if (apiFuncs && typeof apiFuncs.getAreaInfo === 'function') {
    ll.exports(apiFuncs.getAreaInfo, API_NAMESPACE, "getAreaInfo");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getAreaInfo`);
} else {
    logError(`[API 导出] 导出 getAreaInfo 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 _internal_createAreaFromData (来自 api.js)
if (apiFuncs && typeof apiFuncs._internal_createAreaFromData === 'function') {
    ll.exports(apiFuncs._internal_createAreaFromData, API_NAMESPACE, "_internal_createAreaFromData");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}._internal_createAreaFromData`);
} else {
    logError(`[API 导出] 导出 _internal_createAreaFromData 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 deleteArea (来自 api.js)
if (apiFuncs && typeof apiFuncs.deleteArea === 'function') {
    ll.exports(apiFuncs.deleteArea, API_NAMESPACE, "deleteArea");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.deleteArea`);
} else {
    logError(`[API 导出] 导出 deleteArea 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 getAreasByOwner (来自 api.js)
if (apiFuncs && typeof apiFuncs.getAreasByOwner === 'function') {
    ll.exports(apiFuncs.getAreasByOwner, API_NAMESPACE, "getAreasByOwner");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getAreasByOwner`);
} else {
    logError(`[API 导出] 导出 getAreasByOwner 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 getAreaAtPosition (来自 api.js)
if (apiFuncs && typeof apiFuncs.getAreaAtPosition === 'function') {
    ll.exports(apiFuncs.getAreaAtPosition, API_NAMESPACE, "getAreaAtPosition");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getAreaAtPosition`);
} else {
    logError(`[API 导出] 导出 getAreaAtPosition 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 getAllAreaIds (来自 api.js)
if (apiFuncs && typeof apiFuncs.getAllAreaIds === 'function') {
    ll.exports(apiFuncs.getAllAreaIds, API_NAMESPACE, "getAllAreaIds");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getAllAreaIds`);
} else {
    logError(`[API 导出] 导出 getAllAreaIds 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 checkAreaPermission (来自 api.js 的包装器)
// 注意: 来自 permission.js 的核心 checkPermission 函数已在上面导出。
// 导出此包装器提供了通过 api 模块本身访问的另一种方式。
if (apiFuncs && typeof apiFuncs.checkAreaPermission === 'function') {
    ll.exports(apiFuncs.checkAreaPermission, API_NAMESPACE, "checkAreaPermission");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.checkAreaPermission (包装器)`);
} else {
    logError(`[API 导出] 导出 checkAreaPermission 失败: 函数未找到或在 api.js 模块中无效。`);
}

// 导出 getAreasByOwnerUuid (来自 api.js)
if (apiFuncs && typeof apiFuncs.getAreasByOwnerUuid === 'function') {
    ll.exports(apiFuncs.getAreasByOwnerUuid, API_NAMESPACE, "getAreasByOwnerUuid");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getAreasByOwnerUuid`);
} else {
    logError(`[API 导出] 导出 getAreasByOwnerUuid 失败: 函数未找到或在 api.js 模块中无效。`);
}


// 导出经济相关函数的示例 (如果需要，取消注释)
/*
if (typeof getPlayerBalance === 'function') {
    ll.exports(getPlayerBalance, API_NAMESPACE, "getPlayerBalance");
    logInfo(`[API 导出] 已导出: ${API_NAMESPACE}.getPlayerBalance`);
} else {
    logError(`[API 导出] 导出 getPlayerBalance 失败: 函数未找到或无效。`);
}
*/

logInfo(`[API 导出] 完成命名空间 ${API_NAMESPACE} 的 API 导出。`);

// 此模块本身无需通过 module.exports 导出任何内容
// 其目的仅在于被 require 时执行 ll.exports 调用。
