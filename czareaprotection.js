const { loadAreaData, saveAreaData } = require('./config');
const { showCreateAreaForm } = require('./form');
const { isInArea } = require('./utils');
const { getPlayerData } = require('./playerDataManager');
const { initDatabase } = require('./database');
const { getDbSession } = require('./database');
const { loadConfig } = require('./configManager'); // 加载主配置文件的函数
const { buildSpatialIndex } = require('./spatialIndex'); // 引入空间索引构建函数
const { initLogger, logDebug, logInfo, logWarning, logError } = require('./logger'); // 导入 initLogger
let playerCurrentAreas = {};
let areaData = {};
let spatialIndex = {}; // 添加变量来存储空间索引
let config = {}; // 添加变量来存储加载的配置
// 初始化时连接数据库
function initializePlugin() {
    // 1. 加载配置
    config = loadConfig(); // 加载主配置文件 config.json
    // 2. 初始化 Logger (必须在加载配置之后！)
    initLogger(config);

    logInfo("区域保护插件开始初始化..."); // 现在可以安全使用 logInfo/logDebug 了

    // 3. 初始化数据库
    if (initDatabase()) {
        logger.info("区域系统数据库初始化成功");
        areaData = loadAreaData(); // 加载区域数据
        spatialIndex = buildSpatialIndex(areaData); // 初始化时构建索引
        logInfo(`空间索引构建完成，包含 ${Object.keys(spatialIndex).length} 个区块条目。`); // 添加日志

        // 4. 初始化其他模块 (现在可以安全地依赖已初始化的 logger 和 config)
        const { init: initToolSelector } = require('./toolSelector');
        initToolSelector(config); // 将配置传递给需要它的模块
        const { loadAreaAdmins } = require('./areaAdmin');
        loadAreaAdmins();
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
    require('./eventHandler');
}

function updateAreaData(newAreaData) {
    areaData = newAreaData;
    spatialIndex = buildSpatialIndex(areaData); // 更新数据时重建索引

    // 自动检查所有在线玩家的位置
    let players = mc.getOnlinePlayers();
    players.forEach(checkPlayerArea);
}

// 服务器启动时注册命令
setTimeout(initializeCommands, 0);

function checkPlayerArea(pl) {
    const { getPlayerSettings } = require('./playerSettings');
    const { getPriorityAreasAtPosition } = require('./utils'); 
    const settings = getPlayerSettings(pl.uuid);

    const pos = pl.pos;
    if (!pos || pos.dimid === undefined || pos.dimid === null) { // 增加玩家位置有效性检查
        // logDebug(`玩家 ${pl.name} 位置无效或缺少维度，跳过区域检查`);
        return; // 如果位置无效，则不进行检查
    }

    // 检查上次显示时间
    const now = Date.now();
    if (!pl._lastAreaDisplay) {
        pl._lastAreaDisplay = 0;
    }
    const previousAreaId = playerCurrentAreas[pl.uuid];

    // 使用空间索引查询获取该位置的所有区域（已按优先级排序）
    // 注意：这里需要将 spatialIndex 传递给 getPriorityAreasAtPosition
    // 我们将在下一步修改 utils.js 中的 getPriorityAreasAtPosition 函数来接收它
    const areasAtPos = getPriorityAreasAtPosition(pos, areaData, spatialIndex); // 传递 spatialIndex

    if(areasAtPos.length > 0) {
        // 获取优先级最高的区域（子区域）
        const priorityArea = areasAtPos[0];
        const currentAreaId = priorityArea.id;
        const currentAreaName = priorityArea.area.name;
        const areaRules = priorityArea.area.rules || {}; // 获取区域规则，如果不存在则为空对象

        // 检查区域规则是否允许显示 (默认允许)
        const areaAllowsTitle = areaRules.displayTitle !== false; // 如果规则不存在或为 true，则允许
        const areaAllowsActionBar = areaRules.displayActionBar !== false; // 如果规则不存在或为 true，则允许

        // 区域变化时更新玩家当前区域ID
        if(previousAreaId !== currentAreaId) {
            playerCurrentAreas[pl.uuid] = currentAreaId;

            // 标题显示 - 区域规则和玩家设置都允许时才显示
            if(areaAllowsTitle && settings.displayTitle) {
                pl.setTitle(`§e你已进入区域`, 2, 10, 40, 10);
                pl.setTitle(`§b${currentAreaName}`, 3, 10, 40, 10);
                pl._lastAreaDisplay = now; // 更新显示时间（放在显示之后）
            }
        }

        // ActionBar显示 - 区域规则和玩家设置都允许时才显示
        if(areaAllowsActionBar && settings.displayActionBar) {
            // --- 调试日志 ---
            try {
                //logDebug(`[AreaCheck] Player ${pl.name} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}, dim ${pos.dimid})`);
                //logDebug(`[AreaCheck] Areas at pos (sorted): ${areasAtPos.map(a => `${a.id}(${a.area.name}, depth ${a.depth})`).join('; ')}`);
                //logDebug(`[AreaCheck] Priority Area Selected: ${priorityArea.id}(${priorityArea.area.name}, depth ${priorityArea.depth})`);
            } catch (e) {
                logError(`Error during area check debug logging: ${e.message}`);
            }
            // --- 调试日志结束 ---

            let displayText = `§e当前位置: §b${currentAreaName}`;

            // 构建区域层级显示 (最多显示到祖父区域)
            let currentParentId = priorityArea.parentAreaId;
            let hierarchyString = "";
            let level = 0;
            const maxDisplayLevels = 2; // 最多显示父级和祖父级

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

            if (hierarchyString) {
                hierarchyString += "§7)"; // 添加结尾括号
                displayText += hierarchyString;
            }

            pl.setTitle(displayText, 4, 3, 50, 4); // 使用 type 4 (ActionBar)
        }
    } else {
        // 离开所有区域
        
        // 清除ActionBar
        if(settings.displayActionBar) {
            pl.sendText("", 4); // 使用 type 4 清除 action bar
        }
        // 重置玩家当前区域状态，以便下次进入时能触发标题显示
        if (playerCurrentAreas[pl.uuid] !== undefined) {
             playerCurrentAreas[pl.uuid] = undefined;
             // 可选：如果离开区域也需要提示，可以在这里添加 pl.setTitle("", 0); 来清除标题
        }
    }
}

mc.listen("onLeft", (pl) => {
    delete playerCurrentAreas[pl.uuid];
});

// 定时检查玩家位置并显示区域信息
setInterval(() => {
    let players = mc.getOnlinePlayers();
    players.forEach(checkPlayerArea);
}, 2000);

initializePlugin();

// 添加一个函数来获取当前的 spatialIndex
function getSpatialIndex() {
    return spatialIndex;
}

module.exports = {
    getAreaData,
    updateAreaData,
    checkPlayerArea,
    getSpatialIndex, // 导出获取索引的函数
};
