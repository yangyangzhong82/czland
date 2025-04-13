const { loadAreaData, saveAreaData } = require('./config');
const { showCreateAreaForm } = require('./form');
const { isInArea } = require('./utils');
const { getPlayerData } = require('./playerDataManager');
const { initDatabase } = require('./database');
const { getDbSession } = require('./database');
const { loadConfig } = require('./configManager'); // 加载主配置文件的函数
const { buildSpatialIndex } = require('./spatialIndex'); // 引入空间索引构建函数
const { initLogger, logDebug, logInfo, logWarning, logError } = require('./logger'); // 导入日志记录器初始化函数
const { checkPermission } = require('./permission'); // 导入权限检查函数
const { getHighestPriorityArea } = require('./utils'); // 导入获取最高优先级区域函数
const iListenAttentively = require('../iListenAttentively-LseExport/lib/iListenAttentively.js'); // 导入 ila
let playerCurrentAreas = {}; // 存储玩家当前所在区域ID
let areaData = {}; // 存储所有区域数据
let spatialIndex = {}; // 存储空间索引
let config = {}; // 存储加载的配置
let playerSettingsCache = {}; // 缓存玩家设置 { uuid: { settings: {}, timestamp: Date.now() } }
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 玩家设置缓存有效期 (5分钟)

// 初始化插件
function initializePlugin() {
    // 1. 加载配置
    config = loadConfig(); 
    initLogger(config);

    logInfo("区域保护插件开始初始化..."); 

    // 3. 初始化数据库
    if (initDatabase()) {
        logger.info("区域系统数据库初始化成功");
        areaData = loadAreaData(); // 加载区域数据
        spatialIndex = buildSpatialIndex(areaData); // 初始化时构建空间索引
        logInfo(`空间索引构建完成，包含 ${Object.keys(spatialIndex).length} 个区块条目。`); // 添加日志

        // 4. 初始化其他模块、
        const { init: initToolSelector } = require('./toolSelector');
        initToolSelector(config); // 将配置传递给需要它的模块
        const { loadAreaAdmins } = require('./areaAdmin');
        loadAreaAdmins(); // 加载区域管理员数据

        // 5. 加载事件处理器 (在配置和核心模块初始化后)
        // 这些文件内部会根据 config 决定是否注册监听器
        logInfo("正在加载事件处理器 (基于配置)...");
        require('./eventHandler'); // 加载事件处理逻辑
        require('./customevent'); // 加载自定义事件处理、
        logInfo("事件处理器加载完成。");

    } else {
        logError("区域系统数据库初始化失败！插件功能将受限。");
    }
}

function getAreaData() {
    return areaData;
}

function initializeCommands() {
    const { registerCommands } = require('./command');
    registerCommands(areaData,
        (pl, point1, point2) => {
            showCreateAreaForm(pl, point1, point2, areaData, getPlayerData(), saveAreaData, updateAreaData, checkPlayerArea);
        },
        saveAreaData
    );
    // 事件处理器已在 initializePlugin 中加载
}

// 更新区域数据并重建空间索引
function updateAreaData(newAreaData) {
    areaData = newAreaData;
    spatialIndex = buildSpatialIndex(areaData); // 更新数据时重建索引
    logDebug(`区域数据已更新，空间索引已重建，包含 ${Object.keys(spatialIndex).length} 个区块条目。`);

    // 自动检查所有在线玩家的位置以更新显示
    let players = mc.getOnlinePlayers();
    players.forEach(checkPlayerArea);
}

// 服务器启动后稍作延迟再注册命令，确保其他插件或系统初始化完成
setTimeout(initializeCommands, 0);

// 检查玩家当前位置所在的区域，并根据设置显示信息 - 优化：增加设置缓存
function checkPlayerArea(pl) {
    const { getPlayerSettings } = require('./playerSettings'); // 获取玩家个人设置
    const { getPriorityAreasAtPosition } = require('./utils'); // 获取指定位置的区域列表（按优先级）
    const now = Date.now();
    const uuid = pl.uuid;

    // --- 获取玩家设置 (带缓存) ---
    let settings;
    if (playerSettingsCache[uuid] && (now - playerSettingsCache[uuid].timestamp < SETTINGS_CACHE_TTL)) {
        settings = playerSettingsCache[uuid].settings;
        // logDebug(`[Cache Hit] getPlayerSettings for ${pl.name}`); // Optional: Cache hit log
    } else {
        settings = getPlayerSettings(uuid); // 读取该玩家的显示设置
        playerSettingsCache[uuid] = { settings: settings, timestamp: now }; // 更新缓存
        // logDebug(`[Cache Miss] getPlayerSettings for ${pl.name}`); // Optional: Cache miss log
    }
    // --- 结束获取玩家设置 ---

    const pos = pl.pos;
    // 检查玩家位置数据是否有效（有时玩家刚加入或传送时可能暂时无效）
    if (!pos || pos.dimid === undefined || pos.dimid === null) {
        // logDebug(`玩家 ${pl.name} 位置无效或缺少维度，跳过区域检查`);
        return; // 如果位置无效，则不进行检查
    }

    // 检查上次显示标题的时间，避免过于频繁的闪烁（如果需要）
    // const now = Date.now(); // now 变量已在上面定义
    if (!pl._lastAreaDisplay) {
        pl._lastAreaDisplay = 0; // 初始化上次显示时间戳
    }
    const previousAreaId = playerCurrentAreas[uuid]; // 获取玩家上次所在的区域ID (使用 uuid)

    // 使用空间索引查询获取该位置的所有区域（已按优先级排序）
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex); // 传递 areaData 和 spatialIndex

    if(areasAtPos.length > 0) {
        // 存在区域，获取优先级最高的区域（通常是最内层的子区域）
        const priorityArea = areasAtPos[0];
        const currentAreaId = priorityArea.id;
        const currentAreaName = priorityArea.area.name;
        const areaRules = priorityArea.area.rules || {}; // 获取区域规则，如果不存在则为空对象

        // 检查区域规则是否允许显示标题和ActionBar (默认允许)
        const areaAllowsTitle = areaRules.displayTitle !== false; // 如果规则不存在或为 true，则允许
        const areaAllowsActionBar = areaRules.displayActionBar !== false; // 如果规则不存在或为 true，则允许

        // 如果玩家进入了新的区域或离开了之前的区域
        if(previousAreaId !== currentAreaId) {
            // --- 推送离开事件 (如果之前在区域内) ---
            if (previousAreaId) {
                try {
                    const leaveEventData = {
                        playerUuid: uuid,
                        areaId: previousAreaId
                    };
                    iListenAttentively.publish("czareaprotection::playerLeaveArea", leaveEventData);
                    logDebug(`Published czareaprotection::playerLeaveArea for player ${pl.name}, area ${previousAreaId}`);
                } catch (e) {
                    logError(`Error publishing "czareaprotection::playerLeaveArea": ${e.message}`);
                }
            }

            // --- 推送进入事件 (如果现在在区域内) ---
            if (currentAreaId) {
                try {
                    const enterEventData = {
                        playerUuid: uuid,
                        areaId: currentAreaId
                    };
                    iListenAttentively.publish("czareaprotection::playerEnterArea", enterEventData);
                    logDebug(`Published czareaprotection::playerEnterArea for player ${pl.name}, area ${currentAreaId}`);
                } catch (e) {
                    logError(`Error publishing "czareaprotection::playerEnterArea": ${e.message}`);
                }
            }

            // 更新玩家当前区域ID
            playerCurrentAreas[uuid] = currentAreaId;

            // 标题显示 - 区域规则和玩家设置都允许时才显示 (仅在进入新区域时)
            if(currentAreaId && areaAllowsTitle && settings.displayTitle) {
                pl.setTitle(`§e你已进入区域`, 2, 10, 40, 10); // 副标题
                pl.setTitle(`§b${currentAreaName}`, 3, 10, 40, 10); // 主标题
                pl._lastAreaDisplay = now; // 更新显示时间（放在显示之后）
            }
        }

        // ActionBar显示 - 区域规则和玩家设置都允许时才显示
        if(areaAllowsActionBar && settings.displayActionBar) {
            // --- 调试日志 ---
            try {
                //logDebug(`[区域检查] 玩家 ${pl.name} 位于 (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}, 维度 ${pos.dimid})`);
                //logDebug(`[区域检查] 位置所在区域 (排序后): ${areasAtPos.map(a => `${a.id}(${a.area.name}, 深度 ${a.depth})`).join('; ')}`);
                //logDebug(`[区域检查] 选定优先区域: ${priorityArea.id}(${priorityArea.area.name}, 深度 ${priorityArea.depth})`);
            } catch (e) {
                logError(`区域检查调试日志记录出错: ${e.message}`);
            }
            // --- 调试日志结束 ---

            let displayText = `§e当前位置: §b${currentAreaName}`; // ActionBar 显示文本

            // 构建区域层级显示 (最多显示到祖父区域)
            let currentParentId = priorityArea.parentAreaId;
            let hierarchyString = "";
            let level = 0;
            const maxDisplayLevels = 2; // 最多显示父级和祖父级

            // 向上追溯父区域
            while (currentParentId && areaData[currentParentId] && level < maxDisplayLevels) {
                const parentArea = areaData[currentParentId];
                if (level === 0) {
                    hierarchyString = ` §7(属于 §f${parentArea.name}`; // 第一级父区域
                } else {
                    hierarchyString += ` §7/ §f${parentArea.name}`; // 更高层级的父区域用 / 分隔
                }
                currentParentId = parentArea.parentAreaId; // 移动到上一级
                level++;
            }

            // 如果存在父区域信息，添加到显示文本中
            if (hierarchyString) {
                hierarchyString += "§7)"; // 添加结尾括号
                displayText += hierarchyString;
            }

            pl.setTitle(displayText, 4, 3, 50, 4); // 使用 type 4 (ActionBar) 显示
        }
    } else {
        // 玩家离开了所有已知区域

        // 如果玩家设置允许显示ActionBar，则清除它
        if(settings.displayActionBar) {
            pl.sendText("", 4); // 使用 type 4 发送空文本来清除 action bar
        }
        // 如果玩家之前在某个区域内，现在离开了 (currentAreaId is null)
        if (previousAreaId && !currentAreaId) {
            // --- 推送离开事件 --- (已在上面处理)
            // if (previousAreaId) { ... }

            // 重置玩家当前区域状态
            playerCurrentAreas[uuid] = undefined; // 标记玩家不在任何区域内
            logDebug(`Player ${pl.name} left area ${previousAreaId}, now in wilderness.`);
            // 可选：如果离开区域也需要提示，可以在这里添加 pl.setTitle("", 0); 来清除标题
        }
    }
}


// 玩家离开服务器时，清理其区域状态和设置缓存
mc.listen("onLeft", (pl) => {
    const uuid = pl.uuid;
    delete playerCurrentAreas[uuid]; // 从缓存中移除玩家区域状态数据
    delete playerSettingsCache[uuid]; // 从缓存中移除玩家设置数据
    logDebug(`Cleared area state and settings cache for player ${pl.name} (UUID: ${uuid}) on leave.`);
});

// 定时任务：每隔一段时间检查所有在线玩家的位置并更新区域显示
setInterval(() => {
    let players = mc.getOnlinePlayers();
    players.forEach(checkPlayerArea);
}, 2000); // 每 2 秒检查一次

initializePlugin(); // 运行插件初始化函数

// 获取当前的 spatialIndex
function getSpatialIndex() {
    return spatialIndex;
}

module.exports = {
    getAreaData, // 导出获取所有区域数据的函数
    updateAreaData, // 导出更新区域数据的函数
    checkPlayerArea, // 导出检查单个玩家区域的函数
    getSpatialIndex, // 导出获取空间索引的函数
};

require('./apiExports.js');
